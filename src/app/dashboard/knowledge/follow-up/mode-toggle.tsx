import Link from "next/link";

import type { FollowUpMode, QuickCompatibility } from "./mode-detection";

export function ModeToggle({
  mode,
  quickCompatibility,
}: {
  mode: FollowUpMode;
  quickCompatibility: QuickCompatibility;
}) {
  const quickDisabled = !quickCompatibility.compatible;
  const quickHref = quickDisabled
    ? "/dashboard/knowledge/follow-up?mode=advanced"
    : "/dashboard/knowledge/follow-up?mode=quick";

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
            <Link
              href={quickHref}
              className={
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors " +
                (mode === "quick"
                  ? "bg-[#FF6B2C] text-white shadow-sm"
                  : "text-zinc-600 hover:bg-white hover:text-zinc-900")
              }
            >
              Quick
            </Link>
          )}
          <Link
            href="/dashboard/knowledge/follow-up?mode=advanced"
            className={
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors " +
              (mode === "advanced"
                ? "bg-[#FF6B2C] text-white shadow-sm"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900")
            }
          >
            Advanced
          </Link>
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
            <Link
              href="/dashboard/knowledge/follow-up?mode=quick"
              className="rounded-lg bg-[#FF6B2C] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E85A1E]"
            >
              Switch to Quick setup
            </Link>
          ))}
      </div>
    </div>
  );
}
