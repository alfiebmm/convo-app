/**
 * Shared section heading + empty hint helpers for the Follow-up tab.
 *
 * SectionHeading renders the left-border accent in the tenant's brand color
 * (via inline style — Tailwind v4 can't generate arbitrary colour utilities
 * at build time from a runtime value).
 *
 * CON-158.
 */
export function SectionHeading({
  id,
  title,
  description,
  count,
  primaryColor,
}: {
  id: string;
  title: string;
  description: string;
  count: number;
  primaryColor: string;
}) {
  return (
    <div
      className="flex items-end justify-between border-l-2 pl-3"
      style={{ borderColor: primaryColor }}
    >
      <div>
        <h3 id={id} className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <span className="shrink-0 text-xs text-slate-500">
        {count} configured
      </span>
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      {children}
    </p>
  );
}
