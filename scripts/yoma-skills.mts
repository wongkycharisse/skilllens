// Resolves the skill names in data/yoma/skill-map.json to Yoma skill ids and caches them in data/yoma/skills.json.
// Run with `npm run yoma:skills`. The app only reads the cache, so it never depends on Yoma being up.
// Uses the public lookup endpoint (no login): GET {YOMA_API_BASE_URL}/lookup/skill?nameContains=...
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import map from "../data/yoma/skill-map.json" with { type: "json" };

const Skill = z.object({ id: z.string().uuid(), name: z.string().min(1) });
const base = (process.env.YOMA_API_BASE_URL ?? "https://v3api.stage.yoma.world/api/v3").replace(/\/+$/, "");
const names = [...new Set(Object.values(map.rubrics).flatMap((criteria) => Object.values(criteria).flat()))].sort();

async function lookup(name: string) {
  const url = `${base}/lookup/skill?${new URLSearchParams({ nameContains: name, pageNumber: "1", pageSize: "50" })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Yoma skill lookup for "${name}" failed with status ${res.status}`);
  const { items } = (await res.json()) as { items: unknown[] };
  const exact = Skill.passthrough().array().parse(items).find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!exact) throw new Error(`No Yoma skill named exactly "${name}". Fix data/yoma/skill-map.json.`);
  return { id: exact.id, name: exact.name };
}

const skills = await Promise.all(names.map(lookup));
const out = { source: base, fetchedAt: new Date().toISOString().slice(0, 10), skills };
writeFileSync(join(import.meta.dirname, "../data/yoma/skills.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Cached ${skills.length} Yoma skills from ${base}`);
