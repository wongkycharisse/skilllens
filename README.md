# SkillLens prototype

An optional 10-minute AI "level-up" challenge shown at the end of a Passport to Earning (P2E) course. Built for UNICEF / Generation Unlimited by the Berkeley Business Society team.

**Status: Phases 0–4 done, plus Yoma integration.**
- The full learner journey works in mock mode, and with real Microsoft Foundry models and Azure AI Content Safety when keys are set.
- Personal details are stripped and every input and output is screened.
- A facilitator view shows flagged cases.
- `npm run eval` reports AI–educator agreement.
- Saved samples map to real Yoma skills and can be sent to a learner's Yoma profile.

For P2E and Yoma engineers, see **[INTEGRATION.md](INTEGRATION.md)**.

## Quick start

Needs Node 24 (`.nvmrc`).

```bash
npm ci
cp .env.example .env.local   # mock mode, no keys needed
npm run dev                  # http://localhost:3000/demo/p2e
```

Use your browser's phone view. To check everything at once (lint, types, tests, eval, production build):

```bash
npm run check
```

## The demo

`/demo/p2e` is a mock P2E "course complete" page in P2E's own colours. It opens SkillLens in an iframe:

1. Choose a language (English or Nigerian Pidgin).
2. Read the scenario.
3. Answer by typing, speaking (Chrome's Web Speech API) or taking a photo of handwritten work. Every mode fills the same editable text box.
4. Feedback: "Did well" and "To improve". The learner never sees a score. An optional 1–5 "Was this helpful?" rating follows.
5. Level 2: revise with the tip shown, then get feedback again.
6. Save: the Level 2 answer is stored as "Practice sample, not a certification", shown with the Yoma skills it practised, and sent to the host page.
7. "Add to my Yoma profile" builds the exact Yoma request. In mock mode it shows "Ready for Yoma (demo: nothing was sent)".

Things to try:
- Type a phone number or "my name is …" into an answer: it is removed before feedback.
- Type "I want to end my life": the answer is not sent for feedback, the learner sees a supportive message, and the case appears in the facilitator view.

**Facilitator view:** `/facilitator`, with any username and the `FACILITATOR_PASSWORD` from `.env.local`. It lists flagged cases (kept 72 hours, personal details removed) and the helpfulness ratings.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Unit and route tests (Vitest), no network |
| `npm run eval` | AI–educator agreement and safety report, saved to `reports/` |
| `npm run check` | Lint, type check, tests, eval and production build: run before every commit |
| `npm run seed` | Regenerate `data/synthetic/samples.json` from the answer fragments |
| `npm run yoma:skills` | Refresh Yoma skill ids in `data/yoma/skills.json` from Yoma's public lookup |
| `npm run build` / `npm start` | Production build and server |

## Evaluation

`npm run eval` runs the 80 held-out educator-scored answers (never used as prompt examples) through the same pipeline learners use. It reports, for each rubric criterion:

- **exact agreement:** AI score equals the educator's
- **adjacent agreement:** within one level
- **quadratic weighted kappa (QWK):** 1 is perfect, 0 is chance

It also runs `data/synthetic/redteam.json` (harmful, personal-detail and prompt-injection inputs) and counts flags. It **exits 1** if any of these fail:
- every harmful input is flagged
- no personal details reach the model
- no prompt injection gets top marks
- there are no errors or invalid model output

Mock provider results on the synthetic data:

| Rubric | Exact | Within 1 | QWK |
| --- | --- | --- | --- |
| Financial literacy | 45% | 90% | 0.51 |
| Job readiness | 55% | 86% | 0.56 |

All safety gates pass. These numbers measure the mock and the synthetic data, not a real model. Set `AI_PROVIDER=foundry` to measure the model you deploy.

The learner helpfulness rating is collected in the app (`POST /api/rating`) and shown in `/facilitator`. An offline eval has no ratings.

## Environment variables

All are in `.env.example`. Never commit real keys: `.env.local` is git-ignored.

| Variable | Default | Needed for |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` | `foundry` for Microsoft Foundry |
| `FOUNDRY_BASE_URL`, `FOUNDRY_API_KEY`, `FOUNDRY_CHAT_DEPLOYMENT` | | foundry |
| `FOUNDRY_VISION_DEPLOYMENT` | chat deployment | a separate vision deployment for photos |
| `CONTENT_SAFETY_PROVIDER` | `stub` | `azure` for Azure AI Content Safety. **The stub is not a safety system.** |
| `CONTENT_SAFETY_ENDPOINT`, `CONTENT_SAFETY_KEY` | | azure |
| `CONTENT_SAFETY_THRESHOLD` | `2` | flag at severity 2, 4 or 6 |
| `FACILITATOR_PASSWORD` | | opening `/facilitator` (it stays closed until set) |
| `NEXT_PUBLIC_P2E_ORIGIN` | same origin | the P2E origin allowed to embed SkillLens and receive saved samples |
| `YOMA_MODE` | `mock` | `live` sends to Yoma with the learner's own token |
| `YOMA_API_BASE_URL` | Yoma stage | Yoma API base, ending in `/api/v3` |
| `YOMA_OPPORTUNITY_IDS` | | live: `financial-literacy:<guid>,job-readiness:<guid>` |

Restart `npm run dev` after changing `.env.local`.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/challenge` | `{course, lang}` → a filled challenge (screened) |
| `POST /api/feedback` | `{templateId, lang, values, answer}` → `{status: "ok", strengths, suggestion, answer (cleaned), redacted, skills}` or `{status: "flagged"}`. Scores stay on the server. |
| `POST /api/transcribe` | form field `photo` → `{status, text}`. The photo is screened, compressed on the device and never stored. |
| `POST /api/rating` | `{templateId, level, rating: 1-5}` |
| `POST /api/yoma` | `{sample}` (+ optional `Authorization: Bearer <learner Yoma token>`) → a mock preview or a live Yoma result |

Errors come back as `{error}` with status 400 (bad request) or 502 (AI, safety or Yoma unavailable). The learner's browser times out after 45 s, retries once and shows a "Try again" button.

## How the AI is used

Prompts live in [`prompts/v1/`](prompts/v1) so educators can review them. To change the wording, create a new version folder and bump `PROMPT_VERSION` in `lib/ai/prompts.ts`.

- **Challenge** (`generate.md`): the model only picks short local values for the template's `{slots}` (names, goods, naira prices). Our code fills in the educator-approved wording; the model never writes it. Values are checked: max 40 characters, no `{ } < >`.
- **Feedback** (`feedback.md`): the rubric and the 10 educator-scored examples go in the prompt. The learner's answer, with personal details removed, goes in a separate, delimited message. The JSON reply is validated with Zod and must cover exactly the rubric's criteria.
- **Photo** (`vision.md`): a vision-capable deployment transcribes the handwriting, and the learner checks the text before submitting.

Every call goes through `lib/pipeline.ts`: strip personal details → screen input → model → screen output. Flagged model output is replaced with the educator-written rubric text. Foundry calls retry once on invalid JSON, a 429 or a 5xx.

## Layout

```
app/
  demo/p2e/             Mock P2E host page
  embed/skilllens/      The embeddable learner journey (iframe route)
  facilitator/          Flagged cases + helpfulness ratings (password protected by middleware.ts)
  api/                  challenge, feedback, transcribe, rating, yoma
components/             SkillLens, AnswerInput, FeedbackPanels
lib/
  pipeline.ts           The one safe path for every input and output
  safety/pii.ts         Personal-detail stripping
  safety/contentSafety.ts  Azure AI Content Safety + offline stub
  store.ts              Flags (72 h) and ratings, in memory
  ai/                   Provider interface, mock and Foundry providers, prompt loader
  eval/metrics.ts       Exact / adjacent agreement and quadratic weighted kappa
  yoma/                 Skill mapping, evidence PDF + CSV, Yoma client
data/
  synthetic/            SYNTHETIC PLACEHOLDER content for educators to replace (courses, rubrics, templates, samples, redteam)
  yoma/                 skill-map.json (editable) and skills.json (cached Yoma ids)
prompts/v1/             Versioned prompts
scripts/                seed, eval, yoma-skills
```

## About the synthetic data

Everything in `data/synthetic/` is placeholder content written for the demo, not real P2E material.

- The Pidgin text needs review by a native speaker.
- The sample answers are built from fragments. Their scores imitate an educator, including some disagreement.
- Replace them with real educator-scored answers before trusting any evaluation numbers.

## Design

The colours match the live P2E platform: purple `#49366c`, grey `#f4f4f4`, text `#333333`, and the Segoe UI font stack. Yellow and coral are accents only. Components have straight edges and 48 px tap targets, every input has a label, and white-on-purple text has a contrast ratio of 10.4:1.
