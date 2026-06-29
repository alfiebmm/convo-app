import { HowToEditCallout } from "./how-to-edit";

/**
 * Empty state — shown when the tenant has no `follow_up` block configured
 * (or has the prefaulted default with everything empty / disabled).
 *
 * CON-158.
 */
export function FollowUpEmptyState({
  primaryColor,
}: {
  primaryColor: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <div
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primaryColor}1A`, color: primaryColor }}
          aria-hidden
        >
          💬
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          No follow-up rules configured yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          Once your follow-up policy is set up, this page will show your
          contact methods, capture policies, rules, and destinations.
        </p>
      </div>

      <HowToEditCallout primaryColor={primaryColor} />
    </div>
  );
}
