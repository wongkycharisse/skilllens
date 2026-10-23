import { z } from "zod";

export const Lang = z.enum(["en", "pcm"]);
export type Lang = z.infer<typeof Lang>;

export const Localized = z.object({ en: z.string().min(1), pcm: z.string().min(1) });

const Score = z.number().int().min(1).max(4);
const Scores = z.record(z.string(), Score);

// Seed data files: educator-editable, so validated on load.
export const Course = z.object({
  id: z.string(),
  title: Localized,
  objectives: z.array(Localized).min(1),
});

export const Criterion = z.object({
  id: z.string(),
  name: Localized,
  levels: z.array(z.string()).length(4), // descriptors for scores 1-4 (educator-facing)
  strength: Localized,
  improve: Localized,
});

export const Rubric = z.object({
  id: z.string(),
  courseId: z.string(),
  criteria: z.array(Criterion).min(3).max(4),
});

export const Template = z.object({
  id: z.string(),
  courseId: z.string(),
  rubricId: z.string(),
  text: Localized,
});

export const Locale = z.object({
  id: z.string(),
  city: z.string(),
  slots: z.record(z.string(), z.array(z.string()).min(1)),
});

export const Sample = z.object({
  id: z.string(),
  templateId: z.string(),
  answer: z.string(),
  scores: Scores,
  split: z.enum(["example", "test"]),
});

export const Challenge = z.object({
  templateId: z.string(),
  courseId: z.string(),
  rubricId: z.string(),
  lang: Lang,
  text: z.string().min(1),
});

// Model output. Scores stay internal; the learner only sees strengths + suggestion.
export const Feedback = z.object({
  scores: Scores,
  strengths: z.array(z.object({ criterionId: z.string(), text: z.string().min(1) })).min(1),
  suggestion: z.object({ criterionId: z.string(), text: z.string().min(1) }),
});

export type Course = z.infer<typeof Course>;
export type Rubric = z.infer<typeof Rubric>;
export type Template = z.infer<typeof Template>;
export type Locale = z.infer<typeof Locale>;
export type Sample = z.infer<typeof Sample>;
export type Challenge = z.infer<typeof Challenge>;
export type Feedback = z.infer<typeof Feedback>;
