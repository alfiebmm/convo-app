"use client";

import { buildQuickSetupPreview, type QuickSetupInput } from "./quick-setup";

export function QuickSetupPreview({ value }: { value: QuickSetupInput }) {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
      <h3 className="text-sm font-semibold text-zinc-900">Live preview</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-700">
        {buildQuickSetupPreview(value)}
      </p>
    </aside>
  );
}
