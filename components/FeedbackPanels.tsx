import { t } from "../lib/i18n";
import type { Lang } from "../lib/schema";

export interface LearnerFeedback {
  strengths: { criterionId: string; text: string }[];
  suggestion: { criterionId: string; text: string };
}

export function FeedbackPanels({ feedback, lang }: { feedback: LearnerFeedback; lang: Lang }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <section aria-labelledby="did-well" className="border-l-4 border-cyan bg-cyan/10 p-3">
        <h3 id="did-well" className="font-bold">{t(lang, "didWell")}</h3>
        <ul className="mt-2 space-y-2">
          {feedback.strengths.map((s) => (
            <li key={s.criterionId}>{s.text}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="to-improve" className="border-l-4 border-coral bg-coral/10 p-3">
        <h3 id="to-improve" className="font-bold">{t(lang, "toImprove")}</h3>
        <p className="mt-2">{feedback.suggestion.text}</p>
      </section>
    </div>
  );
}
