import type { Challenge, Feedback, Lang, Locale, Rubric, Sample, Template } from "../schema";
import { mockProvider } from "./mock";

export interface ScoreInput {
  challenge: Challenge;
  rubric: Rubric;
  examples: Sample[];
  answer: string;
  lang: Lang;
}

export interface AIProvider {
  /** Fills an educator-approved template with local details. Never generates from a blank prompt. */
  generateChallenge(template: Template, locale: Locale, lang: Lang, seed: number): Promise<Challenge>;
  /** Rubric-based feedback; output must pass the Feedback schema. */
  scoreAnswer(input: ScoreInput): Promise<Feedback>;
  /** Reads handwritten work from a photo and returns it as text. */
  transcribePhoto(image: Uint8Array, mimeType: string): Promise<string>;
}

export function getProvider(name = process.env.AI_PROVIDER ?? "mock"): AIProvider {
  if (name === "mock") return mockProvider;
  throw new Error(`AI provider "${name}" is not available yet (Foundry arrives in Phase 2). Use AI_PROVIDER=mock.`);
}
