import { z } from "zod";
import { getProvider } from "../../../lib/ai/provider";
import { examplesFor, getRubric, locale, templates } from "../../../lib/data";
import { Lang } from "../../../lib/schema";

const Body = z.object({
  templateId: z.string(),
  seed: z.number().int().min(0).max(99),
  lang: Lang,
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { templateId, seed, lang, answer } = body.data;

  const template = templates.find((t) => t.id === templateId);
  if (!template) return Response.json({ error: "Unknown challenge" }, { status: 400 });

  const provider = getProvider();
  const challenge = await provider.generateChallenge(template, locale, lang, seed);
  const feedback = await provider.scoreAnswer({
    challenge,
    rubric: getRubric(template.rubricId),
    examples: examplesFor(template.id),
    answer,
    lang,
  });
  // Scores stay on the server: the learner never sees an overall or per-criterion score.
  return Response.json({ strengths: feedback.strengths, suggestion: feedback.suggestion });
}
