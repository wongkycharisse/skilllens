"use client";

import { useEffect, useState } from "react";
import coursesJson from "../../../data/synthetic/courses.json";
import type { PracticeSample } from "../../../lib/schema";

// Mock P2E host page, for demos only. The real P2E course page embeds the same iframe.
// Courses come from the same file the embed uses, in P2E order: 1 Financial Literacy, 2 Job Readiness.
const COURSES = coursesJson.items.map((c, i) => ({ id: c.id, n: i + 1, title: c.title.en }));

interface Integration {
  name: string;
  mode: "real" | "simulated";
  healthy: boolean | null;
}

/** Demo-only strip: says which parts are real API calls right now, so a demo never passes a stand-in off as real. */
function DemoStatus() {
  const [list, setList] = useState<Integration[] | null>(null);
  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((d) => setList(d.integrations)).catch(() => setList(null));
  }, []);
  if (!list) return null;
  return (
    <details className="border-b border-ink/20 bg-surface px-4 py-2 text-sm">
      <summary className="cursor-pointer font-bold">
        Demo: {list.filter((i) => i.mode === "real").length} of {list.length} integrations real
      </summary>
      <ul className="mt-1 space-y-1">
        {list.map((i) => (
          <li key={i.name}>
            {i.mode === "real" ? "Real" : "Simulated"}: {i.name}
            {i.healthy === false && " (unreachable)"}
          </li>
        ))}
      </ul>
      <a className="underline" href="/status">Details</a>
    </details>
  );
}

export default function P2EDemo() {
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<PracticeSample | null>(null);
  const course = COURSES.find((c) => c.id === courseId)!;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "skilllens:saved") setSaved(e.data.sample);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <header className="bg-brand p-4 text-white">
        <p className="text-sm">Passport to Earning (mock)</p>
        <label className="mt-1 block text-sm">
          Demo course:{" "}
          <select
            className="bg-white px-2 py-1 text-brand"
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setOpen(false); setSaved(null); }}
          >
            {COURSES.map((c) => <option key={c.id} value={c.id}>{c.n}. {c.title}</option>)}
          </select>
        </label>
      </header>
      <DemoStatus />

      {saved && (
        <aside role="status" className="m-4 border-l-4 border-brand p-3">
          <p className="font-bold">Added to your P2E profile</p>
          <p className="text-sm">{saved.label}</p>
        </aside>
      )}

      {!open ? (
        <main className="space-y-4 p-4">
          <h1 className="text-2xl font-bold">✓ Course complete: {course.title}</h1>
          <p>Well done! You finished all the lessons.</p>
          <button type="button" className="btn bg-yellow text-brand" onClick={() => setOpen(true)}>
            Challenge yourself! A 10-minute level-up
          </button>
        </main>
      ) : (
        <iframe
          key={courseId}
          title="SkillLens level-up challenge"
          src={`/embed/skilllens?course=${courseId}&lang=en`}
          className="block h-[85vh] w-full border-0"
        />
      )}
    </div>
  );
}
