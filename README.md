# SkillLens prototype

An optional 10-minute AI "level-up" challenge shown at the end of a Passport to Earning (P2E) course. Built for UNICEF / Generation Unlimited by the Berkeley Business Society team.

**Status: Phase 0** — scaffold, synthetic seed data and a mock AI provider. The learner journey (`/demo/p2e`, `/embed/skilllens`) comes in Phase 1.

## Setup

Needs Node 24.

```bash
npm install
cp .env.example .env.local   # mock mode, no keys needed
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run seed` | Regenerate `data/synthetic/samples.json` from the answer fragments |
| `npm run build` | Production build |

## Environment variables

| Variable | Values | Default |
| --- | --- | --- |
| `AI_PROVIDER` | `mock` (Foundry is added in Phase 2) | `mock` |

Never commit real keys. Put them in `.env.local`, which git ignores.

## Layout

```
data/synthetic/       SYNTHETIC PLACEHOLDER content for educators to replace
  courses.json        2 courses + learning objectives
  rubrics.json        2 rubrics, 3 criteria each, scored 1-4, with learner-facing strength/improve text
  templates.json      8 challenge templates (4 per course) with {slots}, English + Nigerian Pidgin
  locales/ng-kano.json  local details that fill the slots (names, items, naira prices)
  sample-fragments.json answer pieces per score level, used to generate samples
  samples.json        160 generated scored answers: 10 prompt examples + 10 held-out per template
lib/schema.ts         Zod schemas for seed data and the model's feedback JSON
lib/data.ts           Loads and validates seed data
lib/template.ts       Fills template slots
lib/ai/provider.ts    AIProvider interface + getProvider()
lib/ai/mock.ts        Mock provider (no keys): scores by nearest educator-scored examples
scripts/generate-samples.ts
```

## About the synthetic data

Everything in `data/synthetic/` is placeholder content written for the demo, not real P2E material. The Pidgin text needs review by a native speaker. The sample answers are built from fragments, and their scores imitate an educator, including some disagreement. Replace them with real educator-scored answers before trusting any evaluation numbers.

## Mock provider

The mock scores an answer by comparing it with the 10 educator-scored example answers for that challenge. Feedback is the rubric's strength text for criteria scoring 3 or more (or the best criterion if none do), plus the improvement tip for the weakest criterion. Scores are kept internally and never shown to the learner. On the synthetic held-out set it gets about 50% exact and 88% adjacent agreement; the real model replaces it in Phase 2.
