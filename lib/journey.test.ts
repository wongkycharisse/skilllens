import { afterEach, describe, expect, it, vi } from "vitest";
import { courses } from "./data";
import { CHECK_IN, credentialDate, DEFAULT_YOCV_URL, JOURNEY_NAME, parseJourney, safeReturn, threadLabel, threadStates, yocvLink } from "./journey";
import { credential, learner, plan } from "./shared";

const LISTING = "http://localhost:3000/opportunities/c0a7e000-0000-4000-8000-000000000301";
// Link 2 of the journey contract, as PathFinder builds it.
const FROM_PATHFINDER = `journey=demo&from=pathfinder&yoid=yoid-ng-7f3a0123&listing=opp-job-001&goal=job&plan=plan-001&course=opp-course-001&return=${encodeURIComponent(LISTING)}`;

describe("journey contract v1: parameters in", () => {
  it("is off without journey=demo, so the page behaves as before", () => {
    expect(parseJourney(new URLSearchParams(""))).toBeNull();
    expect(parseJourney(new URLSearchParams("course=opp-course-001&yoid=yoid-ng-7f3a0123"))).toBeNull();
    expect(parseJourney({ journey: "other" })).toBeNull();
  });

  it("maps PathFinder's link to the Solar PV course and Halima", () => {
    const j = parseJourney(new URLSearchParams(FROM_PATHFINDER))!;
    expect(j.courseId).toBe("solar-pv");
    expect(courses.map((c) => c.id)).toContain(j.courseId);
    expect(j.learnerId).toBe(learner.id);
    expect(j.learnerId).toBe("yp-001");
    expect(j.yoid).toBe("yoid-ng-7f3a0123");
    expect(j.returnUrl).toBe(LISTING);
  });

  it("reads Next's searchParams object the same way as URLSearchParams", () => {
    const fromObject = parseJourney(Object.fromEntries(new URLSearchParams(FROM_PATHFINDER)));
    expect(fromObject).toEqual(parseJourney(new URLSearchParams(FROM_PATHFINDER)));
  });

  it("gives no course or learner for ids SkillLens does not know", () => {
    const j = parseJourney({ journey: "demo", course: "opp-course-999", yoid: "yoid-someone-else" })!;
    expect(j.courseId).toBeNull();
    expect(j.learnerId).toBeNull();
  });

  it("follows only http: and https: return URLs", () => {
    expect(safeReturn(LISTING)).toBe(LISTING);
    expect(safeReturn("https://yoma.world/opportunities/x?a=1")).toBe("https://yoma.world/opportunities/x?a=1");
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "//evil.example/x", "/opportunities/x", "ftp://x.example/", "", null, undefined]) {
      expect(safeReturn(bad)).toBeNull();
    }
    const j = parseJourney({ journey: "demo", return: "javascript:alert(1)" })!;
    expect(j.returnUrl).toBeNull();
    expect(yocvLink(j)).not.toContain("return=");
  });
});

describe("journey contract v1: link 3, SkillLens → YoCV", () => {
  it("builds the contract's link exactly, passing on every parameter plus from and credential", () => {
    const j = parseJourney(new URLSearchParams(FROM_PATHFINDER))!;
    expect(yocvLink(j, "http://localhost:4174")).toBe(
      `http://localhost:4174/?as=halima&journey=demo&from=skilllens&yoid=yoid-ng-7f3a0123&listing=opp-job-001&goal=job&plan=plan-001&course=opp-course-001&credential=cred-002&return=${encodeURIComponent(LISTING)}`,
    );
  });

  it("passes the return URL on unchanged", () => {
    const withQuery = "https://ziqi.example/opportunities/abc?tab=details&x=1";
    const link = new URL(yocvLink(parseJourney({ journey: "demo", return: withQuery })!, "https://yocv.example"));
    expect(link.searchParams.get("return")).toBe(withQuery);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("defaults YOCV_URL to http://localhost:4174 and tolerates a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_YOCV_URL", "");
    const j = parseJourney({ journey: "demo" })!;
    expect(DEFAULT_YOCV_URL).toBe("http://localhost:4174");
    expect(yocvLink(j)).toBe("http://localhost:4174/?as=halima&journey=demo&from=skilllens&credential=cred-002");
    expect(yocvLink(j, "https://yocv.example/")).toBe("https://yocv.example/?as=halima&journey=demo&from=skilllens&credential=cred-002");
  });

  it("reads YOCV_URL from NEXT_PUBLIC_YOCV_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_YOCV_URL", "https://yocv.example");
    expect(yocvLink(parseJourney({ journey: "demo" })!)).toBe("https://yocv.example/?as=halima&journey=demo&from=skilllens&credential=cred-002");
  });

  it("keeps parameters outside the contract, after the contract's own", () => {
    const link = yocvLink(parseJourney({ journey: "demo", from: "pathfinder", utm: "x", as: "someone" })!, "http://y");
    expect(link).toBe("http://y/?as=halima&journey=demo&from=skilllens&credential=cred-002&utm=x");
  });
});

describe("journey contract v1: the YoID thread at phase 3", () => {
  it("has the first two recorded, SkillLens's own in progress, and the Job Application next", () => {
    expect(threadStates()).toEqual([
      { item: "Saved Opportunity", state: "recorded" },
      { item: "Learning Plan", state: "recorded" },
      { item: "Skill Credential", state: "in progress" },
      { item: "Job Application", state: "next" },
    ]);
  });

  it("records the Skill Credential once SkillLens's step is done", () => {
    expect(threadStates(3, true).map((s) => s.state)).toEqual(["recorded", "recorded", "recorded", "next"]);
  });

  it("labels the strip with the YoID", () => {
    expect(threadLabel("yoid-ng-7f3a0123")).toBe("YoID · yoid-ng-7f3a0123 · mock-up");
  });
});

describe("journey contract v1: the Learning Plan card", () => {
  it("adds PathFinder's weekly check-in as the 4th row, worded as PathFinder shows it", () => {
    expect(plan.steps).toHaveLength(3);
    expect(`${CHECK_IN.tag} · ${CHECK_IN.platform}`).toBe("Check-in · WhatsApp / SMS");
    expect(CHECK_IN.title).toBe("Weekly check-in on WhatsApp or SMS");
  });
});

describe("journey contract v1: the learner's name", () => {
  it("is Halima's full name, as the other prototypes show it, not the shared displayName", () => {
    expect(learner.displayName).toBe("Halima Y.");
    expect(JOURNEY_NAME).toBe("Halima Yusuf");
  });
});

describe("journey contract v1: the Skill Credential's date", () => {
  it("is the day it is recorded in the journey, not the shared data's future issuedOn", () => {
    const issuedOn = credential("cred-002")?.issuedOn;
    expect(issuedOn).toBe("2026-12-20");
    expect(credentialDate(issuedOn, "28 Nov 2026", true)).toBe("28 Nov 2026");
  });

  it("keeps the shared date outside the journey", () => {
    expect(credentialDate("2026-12-20", "28 Nov 2026", false)).toBe("2026-12-20");
    expect(credentialDate(undefined, "28 Nov 2026", false)).toBe("28 Nov 2026");
  });
});
