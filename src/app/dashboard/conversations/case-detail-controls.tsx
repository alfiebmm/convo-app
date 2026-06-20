"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { revealPii } from "./actions";
import type { CasePiiField } from "@/lib/cases/pii";

export function CasePanelCloseButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("case");
    const query = next.toString();
    router.push(`/dashboard/conversations${query ? `?${query}` : ""}`);
  }

  return (
    <button
      type="button"
      onClick={close}
      className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      aria-label="Close case detail"
    >
      x
    </button>
  );
}

export function PiiRevealField({
  caseId,
  field,
  label,
  hasValue,
}: {
  caseId: string;
  field: CasePiiField;
  label: string;
  hasValue: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reveal() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await revealPii(caseId, field);
        setValue(result.value ?? "Not captured");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Reveal failed");
      }
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 flex min-h-7 items-center justify-between gap-3 text-sm text-slate-800">
        <span className="break-all">
          {value ?? (hasValue ? "Hidden" : "Not captured")}
        </span>
        {hasValue && value === null && (
          <button
            type="button"
            onClick={reveal}
            disabled={isPending}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {isPending ? "Revealing" : "Reveal"}
          </button>
        )}
      </dd>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
