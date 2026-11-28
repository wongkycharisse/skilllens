// The BBS x GenU connected journey (journey contract v1): Ziqi → PathFinder → SkillLens → YoCV → back to the listing.
// SkillLens is Phase 3. /demo/p2e opened with ?journey=demo reads the contract's URL parameters, shows the arriving card
// (Learning Plan from PathFinder), the YoID thread, and, once cred-002 is recorded, the leaving card that links on to YoCV.
// Without journey=demo nothing here is used, and the page behaves as before.
// The state comes from the phase and the URL only: there is no shared store between the prototypes.
import { learner } from "./shared";

/** The contract's parameters, in the order every app writes them. */
export const JOURNEY_PARAMS = ["journey", "from", "yoid", "listing", "goal", "plan", "course", "credential", "application", "return"] as const;
export type JourneyParam = (typeof JOURNEY_PARAMS)[number];

/** The four phases and the item each hands on, worded exactly as in the contract. */
export const PHASES = [
  { n: 1, app: "Ziqi", key: "ziqi", item: "Saved Opportunity", itemId: "opp-job-001", title: "Solar Installation Assistant (Trainee)" },
  { n: 2, app: "PathFinder", key: "pathfinder", item: "Learning Plan", itemId: "plan-001", title: "Plan step: complete a P2E course (Solar PV Installation Basics)" },
  { n: 3, app: "SkillLens", key: "skilllens", item: "Skill Credential", itemId: "cred-002", title: "Solar PV Installation Basics: practical challenge passed" },
  { n: 4, app: "YoCV", key: "yocv", item: "Job Application", itemId: "app-001", title: "Application to Solar Installation Assistant (Trainee)" },
] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_N = 3;
export const ARRIVING = PHASES[PHASE_N - 2]; // Learning Plan, from PathFinder
export const OWN = PHASES[PHASE_N - 1]; // Skill Credential
export const LEAVING_TO = PHASES[PHASE_N]; // YoCV
export const RECORDED_LINE = "✓ Recorded on your YoID (mock-up)";

/** Shared course id → SkillLens course id. Only the plan step SkillLens tests. */
export const COURSE_MAP: Record<string, string> = { "opp-course-001": "solar-pv" };
/** Shared YoID → the SkillLens sample learner (Halima, yp-001). */
export const YOID_MAP: Record<string, string> = { [learner.yoidId]: learner.id };

/** YOCV_URL. Read at build time (NEXT_PUBLIC_), like NEXT_PUBLIC_P2E_ORIGIN. */
export const DEFAULT_YOCV_URL = "http://localhost:4174";
export const yocvUrl = () => process.env.NEXT_PUBLIC_YOCV_URL || DEFAULT_YOCV_URL;

export interface Journey {
  /** Every parameter received, in the order received (an unsafe `return` is dropped). */
  params: [string, string][];
  /** The SkillLens course to open, or null to keep the page's default. */
  courseId: string | null;
  /** The sample learner id for the embed, or null for a YoID SkillLens does not know. */
  learnerId: string | null;
  yoid: string | null;
  /** The Ziqi listing URL, only when it is http: or https:. */
  returnUrl: string | null;
}

type Search = URLSearchParams | Record<string, string | string[] | undefined>;

function entries(search: Search): [string, string][] {
  if (search instanceof URLSearchParams) return [...search.entries()];
  return Object.entries(search).flatMap(([k, v]) => (v === undefined ? [] : Array.isArray(v) ? v.map((x): [string, string] => [k, x]) : [[k, v] as [string, string]]));
}

/** A return URL is followed only when it is an absolute http: or https: URL. Anything else is ignored. */
export function safeReturn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** The journey, or null when the page was not opened with journey=demo (then it behaves exactly as before). */
export function parseJourney(search: Search): Journey | null {
  const all = entries(search);
  const get = (k: string) => all.find(([key]) => key === k)?.[1] ?? null;
  if (get("journey") !== "demo") return null;
  const returnUrl = safeReturn(get("return"));
  const yoid = get("yoid");
  const course = get("course");
  return {
    params: all.filter(([k]) => k !== "return" || returnUrl !== null),
    courseId: (course && COURSE_MAP[course]) ?? null,
    learnerId: (yoid && YOID_MAP[yoid]) ?? null,
    yoid,
    returnUrl,
  };
}

/**
 * Link 3, SkillLens → YoCV: `YOCV_URL/?as=halima&journey=demo&from=skilllens&yoid=…&listing=…&goal=…&plan=…&course=…
 * &credential=cred-002&return=…`. Passes on every parameter received, plus from=skilllens and credential=cred-002.
 * Parameters outside the contract are passed on after the contract's ones.
 */
export function yocvLink(journey: Journey, base: string = yocvUrl()): string {
  const received = new Map<string, string>();
  for (const [k, v] of journey.params) if (!received.has(k)) received.set(k, v);
  received.set("journey", "demo");
  received.set("from", OWN.key);
  received.set("credential", OWN.itemId);
  const out = new URLSearchParams([["as", "halima"]]);
  for (const k of JOURNEY_PARAMS) {
    const v = received.get(k);
    if (v !== undefined) out.append(k, v);
  }
  for (const [k, v] of journey.params) if (k !== "as" && !(JOURNEY_PARAMS as readonly string[]).includes(k)) out.append(k, v);
  return `${base.replace(/\/+$/, "")}/?${out.toString()}`;
}

export type StepState = "recorded" | "in progress" | "next";

/** The YoID thread for the app at phase n: earlier steps recorded, its own in progress until done, later ones next. */
export function threadStates(n: number = PHASE_N, done = false): { item: Phase["item"]; state: StepState }[] {
  return PHASES.map((p) => ({ item: p.item, state: p.n < n || (p.n === n && done) ? "recorded" : p.n === n ? "in progress" : "next" }));
}

export const threadLabel = (yoid: string) => `YoID · ${yoid} · mock-up`;
