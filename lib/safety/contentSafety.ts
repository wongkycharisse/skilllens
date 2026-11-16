// Screens every learner input and every model output. Azure AI Content Safety when configured, a stub otherwise.

export type Category = "Hate" | "SelfHarm" | "Sexual" | "Violence";
export const CATEGORIES: Category[] = ["Hate", "SelfHarm", "Sexual", "Violence"];

export interface SafetyResult {
  flagged: boolean;
  /** Only categories at or above the threshold. Azure severities are 0, 2, 4, 6. */
  categories: { category: Category; severity: number }[];
}

export interface ContentSafety {
  checkText(text: string): Promise<SafetyResult>;
  checkImage(image: Uint8Array): Promise<SafetyResult>;
}

const result = (all: { category: Category; severity: number }[], threshold: number): SafetyResult => {
  const categories = all.filter((c) => c.severity >= threshold);
  return { flagged: categories.length > 0, categories };
};

// shortcut: keyword stub for offline demos and tests only; it is not a safety system. Use Azure for any real learner.
const STUB_PATTERNS: Record<Category, RegExp> = {
  SelfHarm: /\b(kill myself|killing myself|suicide|hurt myself|end my life|want to die|cut myself)\b/i,
  Violence: /\b(kill (?:him|her|them|you)|stab|shoot (?:him|her|them|you)|beat (?:him|her|them) up)\b/i,
  Sexual: /\b(sex|sexy|nude|naked|porn)\b/i,
  Hate: /\b(i hate (?:all )?(?:hausa|igbo|yoruba|fulani|christians|muslims|women|girls|boys)|go back to your country)\b/i,
};

export const stubSafety: ContentSafety = {
  async checkText(text) {
    return result(CATEGORIES.map((category) => ({ category, severity: STUB_PATTERNS[category].test(text) ? 4 : 0 })), 2);
  },
  async checkImage() {
    return { flagged: false, categories: [] };
  },
};

export interface AzureSafetyConfig {
  endpoint: string;
  key: string;
  /** Flag at this severity or above. 2 ("low") is the cautious default for minors. */
  threshold: number;
}

const API_VERSION = "2024-09-01";
const TIMEOUT_MS = 10_000;

export function createAzureSafety(config: AzureSafetyConfig): ContentSafety {
  async function analyze(kind: "text" | "image", body: unknown): Promise<SafetyResult> {
    const res = await fetch(`${config.endpoint}/contentsafety/${kind}:analyze?api-version=${API_VERSION}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": config.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Fail closed: if screening is down, the caller must not show unscreened content.
    if (!res.ok) throw new Error(`Content Safety ${kind} request failed with status ${res.status}`);
    const data = (await res.json()) as { categoriesAnalysis?: { category: Category; severity: number }[] };
    if (!Array.isArray(data.categoriesAnalysis)) throw new Error("Content Safety returned no categoriesAnalysis");
    return result(data.categoriesAnalysis, config.threshold);
  }
  return {
    checkText: (text) => analyze("text", { text: text.slice(0, 10_000), categories: CATEGORIES, outputType: "FourSeverityLevels" }),
    checkImage: (image) => analyze("image", { image: { content: Buffer.from(image).toString("base64") }, categories: CATEGORIES }),
  };
}

export function getSafety(env: Record<string, string | undefined> = process.env): ContentSafety {
  const mode = env.CONTENT_SAFETY_PROVIDER ?? "stub";
  if (mode === "stub") return stubSafety;
  if (mode !== "azure") throw new Error(`Unknown CONTENT_SAFETY_PROVIDER "${mode}". Use "stub" or "azure".`);
  const missing = ["CONTENT_SAFETY_ENDPOINT", "CONTENT_SAFETY_KEY"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`CONTENT_SAFETY_PROVIDER=azure needs ${missing.join(", ")} (see .env.example)`);
  const threshold = Number(env.CONTENT_SAFETY_THRESHOLD ?? 2);
  if (![2, 4, 6].includes(threshold)) throw new Error("CONTENT_SAFETY_THRESHOLD must be 2, 4 or 6");
  return createAzureSafety({ endpoint: env.CONTENT_SAFETY_ENDPOINT!.replace(/\/+$/, ""), key: env.CONTENT_SAFETY_KEY!, threshold });
}
