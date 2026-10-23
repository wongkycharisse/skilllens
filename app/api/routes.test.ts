import { describe, expect, it } from "vitest";
import { POST as challenge } from "./challenge/route";
import { POST as feedback } from "./feedback/route";
import { POST as transcribe } from "./transcribe/route";

const json = (body: unknown) =>
  new Request("http://test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("API routes", () => {
  it("returns a filled challenge for a course, and 400 for an unknown one", async () => {
    const res = await challenge(json({ course: "job-readiness", lang: "pcm" }));
    const body = await res.json();
    expect(body.templateId).toMatch(/^jr-/);
    expect(body.text).not.toMatch(/[{}]/);
    expect((await challenge(json({ course: "nope", lang: "en" }))).status).toBe(400);
  });

  const values = { name: "Amina", item: "tomatoes", city: "Kano", price: "₦500", unit: "basket" };

  it("returns strengths and a suggestion but never scores", async () => {
    const res = await feedback(json({ templateId: "fl-rainy-sales", values, lang: "en", answer: "Buy fewer tomatoes when it rains." }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.strengths.length).toBeGreaterThan(0);
    expect(body.suggestion.text).toBeTruthy();
    expect(body).not.toHaveProperty("scores");
  });

  it("rejects empty, oversized or malformed answers", async () => {
    const base = { templateId: "fl-rainy-sales", values, lang: "en" };
    expect((await feedback(json({ ...base, answer: "   " }))).status).toBe(400);
    expect((await feedback(json({ ...base, values: { ...values, name: "{x}" }, answer: "hi" }))).status).toBe(400);
    expect((await feedback(json({ ...base, values: { name: "Amina" }, answer: "hi" }))).status).toBe(400);
    expect((await feedback(json({ ...base, answer: "a".repeat(2001) }))).status).toBe(400);
    expect((await feedback(json({ ...base, templateId: "nope", answer: "hi" }))).status).toBe(400);
    expect((await feedback(new Request("http://test", { method: "POST", body: "not json" }))).status).toBe(400);
  });

  it("transcribes an image and rejects non-images", async () => {
    const form = (file: File) => {
      const f = new FormData();
      f.append("photo", file);
      return new Request("http://test", { method: "POST", body: f });
    };
    const ok = await transcribe(form(new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" })));
    expect((await ok.json()).text).toContain("Mock transcription");
    expect((await transcribe(form(new File(["x"], "a.txt", { type: "text/plain" })))).status).toBe(400);
  });
});
