"use client";

import { useRef, useState } from "react";
import { compressImage } from "../lib/compressImage";
import { t } from "../lib/i18n";
import type { Lang } from "../lib/schema";

type Mode = "type" | "speak" | "photo";

// Web Speech API is not in TypeScript's DOM types; this is the part we use.
interface Recognition {
  lang: string;
  continuous: boolean;
  onresult: (e: { resultIndex: number; results: { 0: { transcript: string }; isFinal: boolean }[] }) => void;
  onend: () => void;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface Props {
  lang: Lang;
  value: string;
  onChange: (value: string) => void;
}

/** Every mode fills the same text box, so the learner can always read and edit what will be sent. */
export function AnswerInput({ lang, value, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("type");
  const [listening, setListening] = useState(false);
  const [photoState, setPhotoState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const recognition = useRef<Recognition | null>(null);
  const append = (text: string) => onChange(value ? `${value.trimEnd()} ${text}` : text);

  function toggleSpeech() {
    if (listening) return recognition.current?.stop();
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-NG"; // no Pidgin recogniser exists; Nigerian English is the closest
    r.continuous = true;
    let base = value;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) {
          base = base ? `${base.trimEnd()} ${e.results[i][0].transcript}` : e.results[i][0].transcript;
          onChange(base);
        }
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  }

  async function readPhoto(file: File) {
    setPhotoState("reading");
    try {
      const form = new FormData();
      form.append("photo", await compressImage(file), "answer.jpg");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      append((await res.json()).text);
      setPhotoState("done");
    } catch {
      setPhotoState("error");
    }
  }

  const tab = (m: Mode) =>
    `min-h-12 flex-1 border-2 border-navy font-bold ${mode === m ? "bg-navy text-white" : "bg-white text-navy"}`;

  return (
    <div className="space-y-3">
      <div role="group" aria-label={`${t(lang, "type")} / ${t(lang, "speak")} / ${t(lang, "photo")}`} className="flex">
        {(["type", "speak", "photo"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} className={tab(m)} onClick={() => setMode(m)}>
            {t(lang, m)}
          </button>
        ))}
      </div>

      {mode === "speak" &&
        (typeof window !== "undefined" && getRecognition() ? (
          <button type="button" className="btn-secondary" onClick={toggleSpeech}>
            {listening ? `■ ${t(lang, "speakStop")}` : `● ${t(lang, "speakStart")}`}
          </button>
        ) : (
          <p role="status">{t(lang, "speakUnsupported")}</p>
        ))}

      {mode === "photo" && (
        <div className="space-y-2">
          <label className="btn-secondary flex cursor-pointer items-center justify-center">
            {t(lang, "photoLabel")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0])}
            />
          </label>
          <p role="status">
            {photoState === "reading" && t(lang, "photoReading")}
            {photoState === "done" && t(lang, "photoCheck")}
            {photoState === "error" && t(lang, "error")}
          </p>
        </div>
      )}

      <label className="block">
        <span className="font-bold">{t(lang, "answerLabel")}</span>
        <textarea
          aria-label={t(lang, "answerLabel")}
          className="mt-1 block min-h-40 w-full border-2 border-navy p-3 text-lg"
          value={value}
          maxLength={2000}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
