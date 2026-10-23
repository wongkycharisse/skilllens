"use client";

import { useState } from "react";
import { languages, t } from "../lib/i18n";
import type { Lang } from "../lib/schema";
import { AnswerInput } from "./AnswerInput";
import { FeedbackPanels, type LearnerFeedback } from "./FeedbackPanels";

interface Challenge {
  templateId: string;
  lang: Lang;
  values: Record<string, string>;
  text: string;
}

export interface SavedSample {
  courseId: string;
  templateId: string;
  scenario: string;
  answer: string;
  savedAt: string;
  label: string;
}

type Step = "lang" | "scenario" | "answer" | "feedback" | "saved";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

function saveSample(sample: SavedSample) {
  try {
    const key = "skilllens:samples";
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key) ?? "[]"), sample]));
  } catch {
    // Storage can be blocked (private mode); the host still gets the message below.
  }
  // shortcut: host must be same origin; set the real P2E origin here when embedding in P2E.
  window.parent.postMessage({ type: "skilllens:saved", sample }, window.location.origin);
}

export function SkillLens({ courseId, courseTitle, initialLang }: { courseId: string; courseTitle: Record<Lang, string>; initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [step, setStep] = useState<Step>("lang");
  const [level, setLevel] = useState<1 | 2>(1);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<LearnerFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const chooseLang = (l: Lang) =>
    run(async () => {
      setLang(l);
      setChallenge(await post<Challenge>("/api/challenge", { course: courseId, lang: l }));
      setStep("scenario");
    });

  const getFeedback = () =>
    run(async () => {
      setFeedback(await post<LearnerFeedback>("/api/feedback", { ...challenge, answer }));
      setStep("feedback");
    });

  function save() {
    saveSample({
      courseId,
      templateId: challenge!.templateId,
      scenario: challenge!.text,
      answer,
      savedAt: new Date().toISOString(),
      label: t(lang, "practiceLabel"),
    });
    setStep("saved");
  }

  const scenarioCard = challenge && (
    <section aria-labelledby="scenario" className="border-l-4 border-yellow bg-yellow/20 p-4">
      <h2 id="scenario" className="text-sm font-bold uppercase">{t(lang, "yourChallenge")}</h2>
      <p className="mt-1 text-lg">{challenge.text}</p>
    </section>
  );

  return (
    <main className="mx-auto max-w-md space-y-4 p-4" lang={lang}>
      <header>
        <p className="text-sm font-bold text-navy/80">{courseTitle[lang]} · {t(lang, "levelUp")}</p>
        {step !== "lang" && step !== "saved" && (
          <p className="text-sm">{t(lang, "level")} {level} / 2</p>
        )}
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
          <AnswerInput lang={lang} value={answer} onChange={setAnswer} />
          <button type="button" className="btn" disabled={busy || !answer.trim()} onClick={getFeedback}>
            {busy ? t(lang, "thinking") : t(lang, "getFeedback")}
          </button>
        </>
      )}

      {step === "feedback" && feedback && (
        <>
          {scenarioCard}
          <FeedbackPanels feedback={feedback} lang={lang} />
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

      {step === "saved" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">✓ {t(lang, "saved")}</h1>
          <p className="inline-block bg-navy px-2 py-1 text-sm font-bold text-white">{t(lang, "practiceLabel")}</p>
          {scenarioCard}
          <p className="border-2 border-navy p-3">{answer}</p>
        </section>
      )}

      {error && (
        <p role="alert" className="border-l-4 border-coral p-3">
          {t(lang, "error")}
        </p>
      )}
    </main>
  );
}
