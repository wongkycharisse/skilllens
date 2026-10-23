import { z } from "zod";
import { getProvider } from "../../../lib/ai/provider";
import { locale, templatesFor } from "../../../lib/data";
import { Lang } from "../../../lib/schema";

const Body = z.object({ course: z.string(), lang: Lang });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const options = templatesFor(body.data.course);
  if (options.length === 0) return Response.json({ error: "Unknown course" }, { status: 400 });

  const template = options[Math.floor(Math.random() * options.length)];
  const seed = Math.floor(Math.random() * locale.slots.name.length);
  const challenge = await getProvider().generateChallenge(template, locale, body.data.lang, seed);
  const { templateId, lang, values, text } = challenge;
  return Response.json({ templateId, lang, values, text });
}
