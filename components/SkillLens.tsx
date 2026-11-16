"use client";

import { useEffect, useRef, useState } from "react";
import { languages, t, type MessageKey } from "../lib/i18n";
import type { Lang, PracticeSample, YomaSkill } from "../lib/schema";
import { AnswerInput } from "./AnswerInput";
import { FeedbackPanels, type LearnerFeedback } from "./FeedbackPanels";

interface Challenge {
  templateId: string;
  lang: Lang;
  values: Record<string, string>;
  text: string;
}

type OkFeedback = { status: "ok"; answer: string; redacted: string[]; skills: YomaSkill[] } & LearnerFeedback;
type FeedbackResponse = OkFeedback | { status: "flagged" } | { status: "too_short" };
type YomaResponse = { status: "ok"; mode: "mock" | "live" } | { status: "flagged" };
interface Opportunity {
  id: string;
  title: string;
  type: string;
  organization: string;
  url: string;
}

type Step = "lang" | "scenario" | "answer" | "feedback" | "saved";

/** Everything needed to pick up where the learner left off after a reload or a dropped connection. */
interface Draft {
  lang: Lang;
  step: Step;
  level: 1 | 2;
  challenge: Challenge | null;
  answer: string;
  feedback: OkFeedback | null;
}

// Where the host page lives. Set NEXT_PUBLIC_P2E_ORIGIN to the real P2E origin when embedding; defaults to same origin.
const HOST_ORIGIN = process.env.NEXT_PUBLIC_P2E_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");
const SLOW_AFTER_MS = 8_000;

export class SlowError extends Error {}

/** POST with a timeout and one retry for network errors and 5xx, since learners are often on weak mobile data. */
export async function post<T>(url: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res.json();
      last = new Error(`${url} failed: ${res.status}`);
      if (res.status < 500) break; // the request itself is wrong; retrying will not help
    } catch (e) {
      last = e instanceof DOMException && e.name === "TimeoutError" ? new SlowError() : e;
      if (last instanceof SlowError) break; // a second 90-second wait is worse than a clear "try again"
    }
  }
  throw last;
}

// Session storage: survives a reload or a dropped tab on the same phone, gone when the browser closes (shared phones).
const draftKey = (courseId: string) => `skilllens:draft:${courseId}`;
function readDraft(courseId: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(courseId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(courseId: string, draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(draftKey(courseId), JSON.stringify(draft));
    else sessionStorage.removeItem(draftKey(courseId));
  } catch {
    // Storage blocked (private mode): the journey still works, it just will not survive a reload.
  }
}

function saveSample(sample: PracticeSample) {
  try {
    const key = "skilllens:samples";
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) ?? "[]"), sample]));
  } catch {
    // Storage can be blocked (private mode); the host still gets the message below.
  }
  window.parent.postMessage({ type: "skilllens:saved", sample }, HOST_ORIGIN);
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function Rating({ lang, onRate }: { lang: Lang; onRate: (n: number) => void }) {
  const [done, setDone] = useState(false);
  if (done) return <p role="status">{t(lang, "rateThanks")}</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="font-bold">{t(lang, "rateQuestion")}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} / 5`}
            className="min-h-12 flex-1 border-2 border-brand bg-white text-lg font-bold text-brand"
            onClick={() => { setDone(true); onRate(n); }}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function NextSteps({ courseId, lang }: { courseId: string; lang: Lang }) {
  const [list, setList] = useState<{ source: "live" | "snapshot"; items: Opportunity[] } | null>(null);
  useEffect(() => {
    fetch(`/api/yoma/opportunities?course=${encodeURIComponent(courseId)}`, { signal: AbortSignal.timeout(20_000) })
      .then((r) => (r.ok ? r.json() : null))
      .then(setList)
      .catch(() => setList(null)); // optional extra: the saved sample matters more than this list
  }, [courseId]);
  if (!list || list.items.length === 0) return null;
  return (
    <section aria-labelledby="next-steps" className="space-y-2">
      <h2 id="next-steps" className="font-bold">{t(lang, "nextSteps")}</h2>
      <p className="text-sm">{t(lang, "nextStepsIntro")}</p>
      <ul className="space-y-2">
        {list.items.map((o) => (
          <li key={o.id} className="border-l-4 border-brand bg-surface p-3">
            <a className="font-bold text-brand underline" href={o.url} target="_blank" rel="noopener noreferrer">{o.title}</a>
            <p className="text-sm">{o.type}{o.organization && ` · ${o.organization}`}</p>
          </li>
        ))}
      </ul>
      {list.source === "snapshot" && <p className="text-sm">{t(lang, "nextStepsSnapshot")}</p>}
    </section>
  );
}

export function SkillLens({ courseId, courseTitle, initialLang }: { courseId: string; courseTitle: Record<Lang, string>; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [step, setStep] = useState<Step>("lang");
  const [level, setLevel] = useState<1 | 2>(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<OkFeedback | null>(null);
  const [notice, setNotice] = useState<"flagged" | "too_short" | "resumed" | null>(null);
  const [saved, setSaved] = useState<PracticeSample | null>(null);
  const [yoma, setYoma] = useState<"idle" | "sending" | "sent" | "demo">("idle");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<{ key: MessageKey; retry: () => void } | null>(null);
  const online = useOnline();
  const heading = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  // Resume an unfinished challenge after a reload (once, on mount).
  useEffect(() => {
    const draft = readDraft(courseId);
    if (draft?.challenge) {
      setLang(draft.lang);
      setStep(draft.step === "saved" ? "lang" : draft.step);
      setLevel(draft.level);
      setChallenge(draft.challenge);
      setAnswer(draft.answer);
      setFeedback(draft.feedback);
      if (draft.answer) setNotice("resumed");
    }
    restored.current = true;
  }, [courseId]);

  useEffect(() => {
    if (!restored.current) return;
    writeDraft(courseId, step === "saved" || !challenge ? null : { lang, step, level, challenge, answer, feedback });
  }, [courseId, lang, step, level, challenge, answer, feedback]);

  // Move focus to each new screen's heading, so screen-reader and keyboard users know the page changed.
  // Not on first load: the host page keeps focus until the learner acts.
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    heading.current?.focus();
  }, [step, level]);

  async function run(action: () => Promise<void>, retry: () => void) {
    setBusy(true);
    setSlow(false);
    setError(null);
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      await action();
    } catch (e) {
      setError({ key: !navigator.onLine ? "offline" : e instanceof SlowError ? "slow" : "error", retry });
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  const chooseLang = (l: Lang) =>
    run(async () => {
      setLang(l);
      setChallenge(await post<Challenge>("/api/challenge", { course: courseId, lang: l }));
      setStep("scenario");
    }, () => chooseLang(l));

  const getFeedback = () =>
    run(async () => {
      const res = await post<FeedbackResponse>("/api/feedback", { ...challenge, answer });
      if (res.status !== "ok") return setNotice(res.status);
      setNotice(null);
      setFeedback(res);
      setAnswer(res.answer); // continue from the version with personal details removed
      setStep("feedback");
    }, getFeedback);

  // Fire and forget: a lost rating must never block the learner.
  const rate = (rating: number) => void post("/api/rating", { templateId: challenge!.templateId, level, rating }).catch(() => {});

  function save() {
    const sample: PracticeSample = {
      courseId,
      templateId: challenge!.templateId,
      lang,
      scenario: challenge!.text,
      answer: feedback!.answer,
      skills: feedback!.skills,
      savedAt: new Date().toISOString(),
      label: t(lang, "practiceLabel"),
    };
    saveSample(sample);
    setSaved(sample);
    setStep("saved");
  }

  function startOver() {
    setLevel(1);
    setChallenge(null);
    setAnswer("");
    setFeedback(null);
    setSaved(null);
    setYoma("idle");
    setNotice(null);
    setStep("lang");
  }

  const sendToYoma = () =>
    run(async () => {
      setYoma("sending");
      try {
        const res = await post<YomaResponse>("/api/yoma", { sample: saved });
        if (res.status === "flagged") throw new Error("flagged");
        setYoma(res.mode === "live" ? "sent" : "demo");
      } catch (e) {
        setYoma("idle");
        throw e;
      }
    }, sendToYoma);

  const scenarioCard = challenge && (
    <section aria-labelledby="scenario" className="border-l-4 border-yellow bg-yellow/20 p-4">
      <h2 id="scenario" className="text-sm font-bold uppercase">{t(lang, "yourChallenge")}</h2>
      <p className="mt-1 text-lg">{challenge.text}</p>
    </section>
  );

  // One focusable heading per screen (tabIndex -1: focusable by script, not a tab stop).
  const h1 = (text: string, srOnly = false) => (
    <h1 ref={heading} tabIndex={-1} className={srOnly ? "sr-only" : "text-2xl font-bold outline-none"}>{text}</h1>
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" lang={lang}>
      <header>
        <p className="text-sm font-bold text-brand">{courseTitle[lang]} · {t(lang, "levelUp")}</p>
        {step !== "lang" && step !== "saved" && <p className="text-sm">{t(lang, "level")} {level} / 2</p>}
      </header>

      {!online && <p role="status" className="border-l-4 border-coral bg-coral/10 p-3">{t(lang, "offline")}</p>}

      {step === "lang" && (
        <section className="space-y-3">
          {h1(t(lang, "chooseLang"))}
          <p>{t(lang, "lowStakes")}</p>
          {languages.map((l) => (
            <button key={l} type="button" className="btn" disabled={busy || !online} onClick={() => chooseLang(l)}>
              {t(l, "langName")}
            </button>
          ))}
        </section>
      )}

      {step === "scenario" && (
        <>
          {h1(`${t(lang, "level")} ${level} / 2: ${t(lang, "yourChallenge")}`, true)}
          {scenarioCard}
          <p>{t(lang, "lowStakes")}</p>
          <button type="button" className="btn" onClick={() => setStep("answer")}>
            {t(lang, "startAnswer")}
          </button>
        </>
      )}

      {step === "answer" && (
        <>
          {h1(`${t(lang, "level")} ${level} / 2: ${t(lang, "answerLabel")}`, true)}
          {scenarioCard}
          {level === 2 && feedback && (
            <section aria-labelledby="tip" className="border-l-4 border-coral bg-coral/10 p-3">
              <h3 id="tip" className="font-bold">{t(lang, "level2Intro")}</h3>
              <p className="mt-1">{feedback.suggestion.text}</p>
            </section>
          )}
          {notice === "resumed" && <p role="status" className="bg-surface p-3 text-sm">{t(lang, "resumed")}</p>}
          {notice === "too_short" && <p role="alert" className="border-l-4 border-yellow bg-yellow/20 p-3">{t(lang, "tooShort")}</p>}
          {notice === "flagged" && (
            <section role="alert" aria-labelledby="safety" className="border-l-4 border-coral bg-coral/10 p-3">
              <h3 id="safety" className="font-bold">{t(lang, "safetyTitle")}</h3>
              <p className="mt-1">{t(lang, "safetyBody")}</p>
            </section>
          )}
          <AnswerInput lang={lang} value={answer} onChange={(v) => { setAnswer(v); if (notice !== "resumed") setNotice(null); }} />
          <button type="button" className="btn" disabled={busy || !online || !answer.trim()} onClick={getFeedback}>
            {busy ? t(lang, "thinking") : t(lang, "getFeedback")}
          </button>
        </>
      )}

      {step === "feedback" && feedback && (
        <>
          {h1(`${t(lang, "level")} ${level} / 2: ${t(lang, "didWell")} / ${t(lang, "toImprove")}`, true)}
          {scenarioCard}
          {feedback.redacted.length > 0 && <p role="status" className="bg-surface p-3 text-sm">{t(lang, "privacyNote")}</p>}
          <FeedbackPanels feedback={feedback} lang={lang} />
          <Rating key={level} lang={lang} onRate={rate} />
          {level === 1 ? (
            <button type="button" className="btn" onClick={() => { setLevel(2); setNotice(null); setStep("answer"); }}>
              {t(lang, "tryLevel2")}
            </button>
          ) : (
            <button type="button" className="btn" onClick={save}>
              {t(lang, "save")}
            </button>
          )}
        </>
      )}

      {step === "saved" && saved && (
        <section className="space-y-3">
          {h1(`✓ ${t(lang, "saved")}`)}
          <p className="inline-block bg-brand px-2 py-1 text-sm font-bold text-white">{t(lang, "practiceLabel")}</p>
          {scenarioCard}
          <p className="border-2 border-brand p-3">{saved.answer}</p>
          <section aria-labelledby="skills">
            <h2 id="skills" className="font-bold">{t(lang, "skillsPractised")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {saved.skills.map((s) => <li key={s.id} className="bg-surface px-2 py-1 text-sm">{s.name}</li>)}
            </ul>
          </section>
          {yoma === "idle" || yoma === "sending" ? (
            <button type="button" className="btn-secondary" disabled={busy || !online} onClick={sendToYoma}>
              {yoma === "sending" ? t(lang, "sendingYoma") : t(lang, "addToYoma")}
            </button>
          ) : (
            <p role="status" className="font-bold">✓ {t(lang, yoma === "sent" ? "sentYoma" : "sentYomaDemo")}</p>
          )}
          <NextSteps courseId={courseId} lang={lang} />
          <button type="button" className="btn-secondary" onClick={startOver}>{t(lang, "tryAnother")}</button>
        </section>
      )}

      {busy && slow && <p role="status" className="text-sm">{t(lang, "stillWorking")}</p>}

      {error && (
        <div role="alert" className="space-y-2 border-l-4 border-coral p-3">
          <p>{t(lang, error.key)}</p>
          <button type="button" className="btn-secondary" disabled={busy || !online} onClick={error.retry}>{t(lang, "retry")}</button>
        </div>
      )}
    </main>
  );
}
