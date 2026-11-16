# Integrating SkillLens with P2E and Yoma

For the P2E and Yoma engineering teams. Everything here was checked against the Yoma source (`yoma/src/api`) and Yoma's stage API in November 2026.

## 1. Embedding in P2E

P2E shows SkillLens as the last step of a course, in an iframe:

```html
<iframe
  title="SkillLens level-up challenge"
  src="https://<skilllens-host>/embed/skilllens?course=financial-literacy&lang=en"
  allow="microphone"
  style="width:100%;height:85vh;border:0"></iframe>
```

| Parameter | Values |
| --- | --- |
| `course` | `financial-literacy`, `job-readiness` (ids in `data/synthetic/courses.json`) |
| `lang` | `en`, `pcm` (the learner can change it on the first screen) |

Set `NEXT_PUBLIC_P2E_ORIGIN` to the P2E origin (for example `https://unicef.myp2e.org`). It does two things:

- **Framing:** the `Content-Security-Policy: frame-ancestors` header lets only that origin (and SkillLens itself) frame the page.
- **Saved samples:** when the learner saves, SkillLens posts a message to that origin only:

```js
window.addEventListener("message", (e) => {
  if (e.origin !== "https://<skilllens-host>" || e.data?.type !== "skilllens:saved") return;
  const sample = e.data.sample; // see "Practice sample" below
});
```

## 2. Practice sample

The only learner content SkillLens keeps. It is the Level 2 answer, with personal details already removed, and **no scores**.

```json
{
  "courseId": "financial-literacy",
  "templateId": "fl-weekly-saving",
  "lang": "en",
  "scenario": "Amina earns ₦5,000 a week from washing cars in Kano. ...",
  "answer": "Amina should save ₦1,000 every week ...",
  "skills": [{ "id": "e2fc4e8b-d6c5-4f5a-be08-4410289b77bb", "name": "Financial Literacy" }],
  "savedAt": "2026-11-16T07:10:00.000Z",
  "label": "Practice sample, not a certification"
}
```

Schema: `PracticeSample` in `lib/schema.ts`.

## 3. Yoma

### What Yoma offers

Yoma has **no partner endpoint that records a learner's completion**. The partner API (`api/v3/externalpartner`, client-credentials token from Keycloak) can only create users and read who completed an opportunity. So a practice sample can reach a Yoma profile in two ways:

| Route | Who calls it | Endpoint | Status here |
| --- | --- | --- | --- |
| **A. Learner submits** (recommended) | SkillLens, with the learner's own Yoma access token | `PUT /api/v3/myOpportunity/action/{opportunityId}/verify` (multipart) | Built: `lib/yoma/client.ts`, `POST /api/yoma` |
| **B. Bulk CSV** | An org admin in the Yoma admin portal | `POST /api/v3/myOpportunity/action/verify/csv` | Builder ready: `verifyCsv()` in `lib/yoma/evidence.ts` |

### Setup an org admin does once on Yoma

1. Create one opportunity per SkillLens course, for example "SkillLens practice: Financial Literacy".
2. Turn on verification with evidence type **FileUpload**.
3. Attach the skills listed in `data/yoma/skills.json`. Yoma gives the learner the opportunity's skills when it is verified.
4. Put the opportunity ids in `YOMA_OPPORTUNITY_IDS=financial-literacy:<guid>,job-readiness:<guid>`.

### Route A request (what `submitToYoma` sends)

Field names come from `MyOpportunityRequestVerify.cs`:

| Form field | Value |
| --- | --- |
| `Certificate` | `skilllens-practice-sample.pdf`, a one-page PDF labelled "Practice sample, not a certification". Yoma accepts pdf, docx, pptx and images for certificates, up to 10 MB. |
| `DateStart`, `DateEnd` | `savedAt` |
| `Feedback` | `Practice sample, not a certification. SkillLens <course>.` |

The header is `Authorization: Bearer <learner's Yoma access token>`. The host page gets that token through Yoma SSO (see `yoma/docs/sso/README.md`) and forwards it to `POST /api/yoma`. With `YOMA_MODE=mock` (the default), SkillLens builds the exact request and returns a preview without sending it.

### Skills

`data/yoma/skill-map.json` (editable by educators) maps each rubric criterion to Yoma skill names. `npm run yoma:skills` resolves them through Yoma's public `GET /api/v3/lookup/skill` and caches the ids in `data/yoma/skills.json`. The app reads only the cache, so it never depends on Yoma being up. On the server, `POST /api/yoma` replaces any skills sent by the browser with its own mapping.

### Open questions for the Yoma team

1. Should practice samples be a separate opportunity type, so they never look like a completed course? Route A puts them through normal verification, and an org admin approves them.
2. Would Yoma add a partner endpoint for this, so P2E does not need to hold the learner's Yoma token?
3. Should a practice sample issue an SSI credential? We assume no ("not a certification"), so keep `CredentialIssuanceEnabled` off on these opportunities.

## 4. Safety and data handling (for UNICEF review)

- **Personal details:** every answer and photo transcription is stripped of phone numbers, emails, street addresses, "my name is …" and @handles before it reaches a model, a log or a saved sample (`lib/safety/pii.ts`). This is regex-based, and a named-entity model should be added before scaling.
- **Screening:** every learner input (text and photo) and every model output is screened with Azure AI Content Safety at severity ≥ 2 (`CONTENT_SAFETY_PROVIDER=azure`). If screening is down, the request fails rather than showing unscreened content.
- **On a flag:**
  - Flagged answers never reach the model. The learner sees a supportive message pointing them to a facilitator.
  - Flagged model output is replaced with educator-written rubric text.
- **Storage:**
  - Raw answers and photos are never stored.
  - Flags keep a personal-detail-stripped excerpt of up to 280 characters for 72 hours, in memory, for the password-protected `/facilitator` view.
  - Server logs hold flag ids and categories only.
- **No ranking:** scores stay on the server. Learners see "Did well" and "To improve" only.

## 5. Before a real pilot

| Item | Why |
| --- | --- |
| Azure AI Content Safety resource + keys | The stub is a keyword list for demos, not a safety system |
| Database with a TTL for flags and ratings | The current store is in memory, so it is lost on restart and not shared across instances |
| P2E or Yoma sign-in for facilitators | Replaces the single shared password |
| Real educator-scored answers | Agreement numbers on synthetic data mean nothing |
| Native-speaker review of the Pidgin text | Written by the team, unreviewed |
| Rate limiting on `/api/*` | Protects model spend |
