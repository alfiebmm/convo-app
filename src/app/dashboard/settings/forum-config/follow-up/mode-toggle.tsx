import type { FollowUpMode, QuickCompatibility } from "./mode-detection";

/**
 * Mode toggle for the Follow-up tab inside Forum config.
 *
 * Lives entirely client-side: the surrounding panel owns the active mode in
 * React state, so this component takes a callback rather than building hrefs.
 * CON-238 (relocation from Knowledge → Forum config).
 */
export function ModeToggle({
  mode,
  quickCompatibility,
  onChange,
}: {
  mode: FollowUpMode;
  quickCompatibility: QuickCompatibility;
  onChange: (mode: FollowUpMode) => void;
}) {
  const quickDisabled = !quickCompatibility.compatible;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Setup mode</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Quick covers the required setup. Advanced keeps the full follow-up
          editor surface.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1"
          role="group"
          aria-label="Follow-up setup mode"
        >
          {quickDisabled ? (
            <button
              type="button"
              disabled
              title={quickCompatibility.reason}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400"
            >
              Quick
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange("quick")}
              className={
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors " +
                (mode === "quick"
                  ? "bg-[#FF6B2C] text-white shadow-sm"
                  : "text-zinc-600 hover:bg-white hover:text-zinc-900")
              }
            >
              Quick
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange("advanced")}
            className={
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors " +
              (mode === "advanced"
                ? "bg-[#FF6B2C] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900")
            }
          >
            Advanced
          </button>
        </div>

        {mode === "advanced" &&
          (quickDisabled ? (
            <button
              type="button"
              disabled
              title={quickCompatibility.reason}
              className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-400"
            >
              Switch to Quick setup
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange("quick")}
              className="rounded-lg bg-[#FF6B2C] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E85A1E]"
            >
              Switch to Quick setup
            </button>
          ))}
      </div>
    </div>
  );
}
