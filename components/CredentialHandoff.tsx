// DESIGN PREVIEW ONLY: the end screen for a passed challenge that becomes a skill credential in the learner's YoID
// wallet on Yoma. Nothing is sent or issued here; the flow it shows is in INTEGRATION.md section 8.
// Pass rule (proposed): the Level 2 answer is "Good" or "Strong" on every rubric criterion. Nothing goes to Yoma until the
// learner taps "Add to my Yoma profile" (consent); `sent` is true after that tap.
import { PASS_LEVEL, passed } from "../lib/credential";
import { t, type MessageKey } from "../lib/i18n";
import type { Lang, YomaSkill } from "../lib/schema";
import type { RubricRow } from "./FeedbackPanels";
import { Icon } from "./Icon";


const STEPS: MessageKey[] = ["credStepSent", "credStepChecked", "credStepWallet"];

export function CredentialHandoff({ lang, rows, skills, lesson, date, sent }: { lang: Lang; rows: RubricRow[]; skills: YomaSkill[]; lesson: string | null; date: string; sent: boolean }) {
  const ok = passed(rows);
  return (
    <section aria-labelledby="credential" className="space-y-3 rounded-2xl border-2 border-dashed border-brand-soft p-4">
      <p className="inline-flex items-center gap-2 rounded-full bg-yellow px-3 py-1 text-sm font-medium text-brand">
        <Icon name="info" className="size-4" />{t(lang, "credPreview")}
      </p>
      <h2 id="credential" className="text-xl text-brand">{t(lang, !ok ? "credNotYetTitle" : sent ? "credPassedTitle" : "credReadyTitle")}</h2>

      {ok ? (
        <>
          {/* The credential as it would look in the YoID wallet. */}
          <div className="rounded-2xl bg-brand p-4 text-white shadow-sm">
            <p className="flex items-center gap-2 text-sm"><Icon name="cap" className="size-5" />{t(lang, "credIssuer")}</p>
            <p className="mt-2 font-heading text-2xl leading-tight">{t(lang, "credName")}</p>
            {lesson && <p className="mt-1 text-sm">{lesson}</p>}
            <ul className="mt-3 flex flex-wrap gap-2">
              {skills.map((s) => <li key={s.id} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-brand">{s.name}</li>)}
            </ul>
            <p className="mt-3 text-sm">{t(lang, "credAssessed")} · {date}</p>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3" aria-label={t(lang, "credJourney")}>
            {STEPS.map((key, i) => (
              <li key={key} className={`flex items-center gap-2 rounded-xl p-3 text-sm ${sent && i === 0 ? "bg-brand-tint font-medium text-brand" : "bg-surface"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full ${sent && i === 0 ? "bg-brand text-white" : "border-2 border-brand-soft text-brand"}`}>{i + 1}</span>
                {t(lang, key)}
              </li>
            ))}
          </ol>
          <p className="text-sm">{t(lang, sent ? "credTiming" : "credConsent")}</p>
          <p className="card text-sm">{t(lang, "credWhat")}</p>
          <button type="button" className="btn-yellow" disabled aria-describedby="credential-disabled">
            <Icon name="external" /> {t(lang, "credOpen")}
          </button>
          <p id="credential-disabled" className="text-center text-sm">{t(lang, "credPreviewButton")}</p>
        </>
      ) : (
        <>
          <p>{t(lang, "credNotYetBody")}</p>
          <ul className="space-y-1">
            {rows.filter((r) => r.level < PASS_LEVEL).map((r) => (
              <li key={r.id} className="flex items-center gap-2"><Icon name="arrow" className="size-5 shrink-0 text-brand" />{r.name}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
