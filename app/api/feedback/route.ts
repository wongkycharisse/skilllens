import { z } from "zod";
import { getProvider } from "../../../lib/ai/provider";
import { examplesFor, getRubric, templates } from "../../../lib/data";
import { Lang, SlotValues } from "../../../lib/schema";
import { fillTemplate } from "../../../lib/template";

const Body = z.object({
  templateId: z.string(),
  lang: Lang,
  values: SlotValues,
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { templateId, lang, values, answer } = body.data;

  const template = templates.find((t) => t.id === templateId);
  if (!template) return Response.json({ error: "Unknown challenge" }, { status: 400 });

  // Rebuild the scenario from the educator template; only the short slot values come from the browser.
  let text: string;
  try {
    text = fillTemplate(template.text[lang], values);
  } catch {
    return Response.json({ error: "Invalid challenge values" }, { status: 400 });
  }

  const feedback = await getProvider().scoreAnswer({
    challenge: { templateId, courseId: template.courseId, rubricId: template.rubricId, lang, values, text },
    rubric: getRubric(template.rubricId),
    examples: examplesFor(template.id),
    answer,
    lang,
  });
  // Scores stay on the server: the learner never sees an overall or per-criterion score.
  return Response.json({ strengths: feedback.strengths, suggestion: feedback.suggestion });
}
