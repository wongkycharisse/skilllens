"use client";

import { useState } from "react";
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

type FeedbackResponse =
  | ({ status: "ok"; answer: string; redacted: string[]; skills: YomaSkill[] } & LearnerFeedback)
  | { status: "flagged" };

type YomaResponse = { status: "ok"; mode: "mock" | "live" } | { status: "flagged" };

type Step = "lang" | "scenario" | "answer" | "feedback" | "saved";

// Where the host page lives. Set NEXT_PUBLIC_P2E_ORIGIN to the real P2E origin when embedding; defaults to same origin.
const HOST_ORIGIN = process.env.NEXT_PUBLIC_P2E_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");

export class SlowError extends Error {}

/** POST with a timeout and one retry for network errors and 5xx, since learners are often on weak mobile data. */
export async function post<T>(url: string, body: unknown, timeoutMs = 45_000): Promise<T> {
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
    }
  }
  throw last;
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

export function SkillLens({ courseId, courseTitle, initialLang }: { courseId: string; courseTitle: Record<Lang, string>; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [step, setStep] = useState<Step>("lang");
  const [level, setLevel] = useState<1 | 2>(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Extract<FeedbackResponse, { status: "ok" }> | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [saved, setSaved] = useState<PracticeSample | null>(null);
  const [yoma, setYoma] = useState<"idle" | "sending" | "sent" | "demo">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ key: MessageKey; retry: () => void } | null>(null);

  async function run(action: () => Promise<void>, retry: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError({ key: e instanceof SlowError ? "slow" : "error", retry });
    } finally {
      setBusy(false);
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
      setFlagged(res.status === "flagged");
      if (res.status !== "ok") return;
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

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" lang={lang}>
      <header>
        <p className="text-sm font-bold text-brand">{courseTitle[lang]} · {t(lang, "levelUp")}</p>
        {step !== "lang" && step !== "saved" && <p className="text-sm">{t(lang, "level")} {level} / 2</p>}
      </header>

      {step === "lang" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">{t(lang, "chooseLang")}</h1>
          <p>{t(lang, "lowStakes")}</p>
          {languages.map((l) => (
            <button key={l} type="button" className="btn" disabled={busy} onClick={() => chooseLang(l)}>
              {t(l, "langName")}
            </button>
          ))}
        </section>
      )}

      {step === "scenario" && (
        <>
          {scenarioCard}
          <p>{t(lang, "lowStakes")}</p>
          <button type="button" className="btn" onClick={() => setStep("answer")}>
            {t(lang, "startAnswer")}
          </button>
        </>
      )}

      {step === "answer" && (
        <>
          {scenarioCard}
          {level === 2 && feedback && (
            <section aria-labelledby="tip" className="border-l-4 border-coral bg-coral/10 p-3">
              <h3 id="tip" className="font-bold">{t(lang, "level2Intro")}</h3>
              <p className="mt-1">{feedback.suggestion.text}</p>
            </section>
          )}
          {flagged && (
            <section role="alert" aria-labelledby="safety" className="border-l-4 border-coral bg-coral/10 p-3">
              <h3 id="safety" className="font-bold">{t(lang, "safetyTitle")}</h3>
              <p className="mt-1">{t(lang, "safetyBody")}</p>
            </section>
          )}
          <AnswerInput lang={lang} value={answer} onChange={(v) => { setAnswer(v); setFlagged(false); }} />
          <button type="button" className="btn" disabled={busy || !answer.trim()} onClick={getFeedback}>
            {busy ? t(lang, "thinking") : t(lang, "getFeedback")}
          </button>
        </>
      )}

      {step === "feedback" && feedback && (
        <>
          {scenarioCard}
          {feedback.redacted.length > 0 && <p role="status" className="bg-surface p-3 text-sm">{t(lang, "privacyNote")}</p>}
          <FeedbackPanels feedback={feedback} lang={lang} />
          <Rating key={level} lang={lang} onRate={rate} />
          {level === 1 ? (
            <button type="button" className="btn" onClick={() => { setLevel(2); setStep("answer"); }}>
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
          <h1 className="text-2xl font-bold">✓ {t(lang, "saved")}</h1>
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
            <button type="button" className="btn-secondary" disabled={busy} onClick={sendToYoma}>
              {yoma === "sending" ? t(lang, "sendingYoma") : t(lang, "addToYoma")}
            </button>
          ) : (
            <p role="status" className="font-bold">✓ {t(lang, yoma === "sent" ? "sentYoma" : "sentYomaDemo")}</p>
          )}
        </section>
      )}

      {error && (
        <div role="alert" className="space-y-2 border-l-4 border-coral p-3">
          <p>{t(lang, error.key)}</p>
          <button type="button" className="btn-secondary" disabled={busy} onClick={error.retry}>{t(lang, "retry")}</button>
        </div>
      )}
    </main>
  );
}
