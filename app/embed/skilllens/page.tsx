import { SkillLens } from "../../../components/SkillLens";
import { courses } from "../../../lib/data";
import { Lang } from "../../../lib/schema";
import { JOURNEY_NAME } from "../../../lib/journey";
import { learner } from "../../../lib/shared";

// Embeddable route: P2E loads this in an iframe as the last step of a course.
// /embed/skilllens?course=solar-pv&lang=en&learner=yp-001
// learner: the shared sample learner (Halima, yp-001) for the mocked YoID thread. A real host passes a Yoma sign-in instead.
// journey=demo: opened from the connected journey's host page, so the learner is named in full, as in the other prototypes.
export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ course?: string; lang?: string; learner?: string; journey?: string }> }) {
  const params = await searchParams;
  const course = courses.find((c) => c.id === params.course);
  if (!course) return <main className="p-4">Unknown course. Use ?course={courses.map((c) => c.id).join(" or ")}</main>;

  const lang = Lang.safeParse(params.lang);
  const journey = params.journey === "demo";
  const sample = params.learner === learner.id ? { yoidId: learner.yoidId, displayName: journey ? JOURNEY_NAME : learner.displayName } : null;
  return <SkillLens courseId={course.id} courseTitle={course.title} initialLang={lang.success ? lang.data : "en"} learner={sample} />;
}
