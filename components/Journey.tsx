// The connected journey's handoff card and YoID thread (journey contract v1), the same design in all four prototypes:
// white card, Yoma purple heading, Yoma green "recorded" line, Yoma blue button, Nunito headings, Open Sans body, 12 px
// radius. Shown on /demo/p2e only when it is opened with journey=demo (lib/journey.ts). Mock-up with sample data.
import { RECORDED_LINE, type StepState } from "../lib/journey";
import { Icon } from "./Icon";

interface CardProps {
  eyebrow: string;
  item: string;
  title: string;
  /** Leaving card only: the primary button. Opens in the same tab: the journey is one path. */
  action?: { label: string; href: string };
}

export function HandoffCard({ eyebrow, item, title, action }: CardProps) {
  return (
    <section aria-label={`${eyebrow}: ${item}`} className="space-y-2 rounded-xl bg-paper p-4 text-left shadow-sm ring-1 ring-line">
      <p className="text-sm font-semibold text-muted">{eyebrow}</p>
      <h2 className="font-heading text-xl font-extrabold text-brand">{item}</h2>
      <p>{title}</p>
      {action && (
        <a href={action.href} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-journey px-6 font-heading text-lg font-bold text-brand shadow-sm transition hover:brightness-105">
          {action.label} <Icon name="arrow" />
        </a>
      )}
      <p className="text-sm font-semibold text-success">{RECORDED_LINE}</p>
    </section>
  );
}

const STATE_STYLE: Record<StepState, string> = {
  recorded: "bg-success-light text-success-ink",
  "in progress": "bg-accent-light text-brand",
  next: "bg-surface text-muted",
};

/** The four-step YoID strip: Saved Opportunity → Learning Plan → Skill Credential → Job Application. */
export function JourneyThread({ label, steps }: { label: string; steps: { item: string; state: StepState }[] }) {
  return (
    // A container query, not a viewport breakpoint: the strip sits in a narrow side column on the computer view.
    <section aria-label={label} className="@container space-y-2 rounded-xl bg-paper p-3 text-left ring-1 ring-line">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <ol className="grid grid-cols-2 gap-2 @md:grid-cols-4">
        {steps.map((s) => (
          <li key={s.item} className={`flex items-start gap-1.5 rounded-lg p-2 text-sm ${STATE_STYLE[s.state]}`}>
            {s.state === "recorded" ? (
              <Icon name="check" className="size-5 text-success" />
            ) : (
              <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-full ${s.state === "in progress" ? "bg-accent" : "border-2 border-line"}`} />
            )}
            <span className="min-w-0">
              <span className="block font-semibold">{s.item}</span>
              <span className="text-xs">{s.state}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
