"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addInternalNoteAction,
  assignCaseAction,
  dismissCaseAction,
  resolveCaseAction,
  retrySyncAction,
  revealPii,
} from "./actions";
import type { CasePiiField } from "@/lib/cases/pii";

export interface TenantUserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const BUTTON_CLASS =
  "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50";

export function CasePanelCloseButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("case");
    next.delete("conversation");
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

export function AssignmentControl({
  caseId,
  assignedTo,
  users,
}: {
  caseId: string;
  assignedTo: string | null;
  users: TenantUserOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(assignedTo ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function assign(nextValue: string) {
    setValue(nextValue);
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await assignCaseAction(caseId, nextValue);
        setStatus(result.message);
        router.refresh();
      } catch (err) {
        setValue(assignedTo ?? "");
        setError(err instanceof Error ? err.message : "Assignment failed");
      }
    });
  }

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(event) => assign(event.target.value)}
        disabled={isPending}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email} ({user.role})
          </option>
        ))}
      </select>
      {status && <p className="text-xs text-emerald-600">{status}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function InternalNoteForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function command(name: "bold" | "italic") {
    document.execCommand(name);
    editorRef.current?.focus();
  }

  function addLink() {
    const href = window.prompt("Link URL");
    if (!href) return;
    document.execCommand("createLink", false, href);
    editorRef.current?.focus();
  }

  function submit() {
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await addInternalNoteAction(caseId, bodyHtml);
        if (editorRef.current) editorRef.current.innerHTML = "";
        setStatus(result.message);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Note failed");
      }
    });
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => command("bold")}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => command("italic")}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm italic text-slate-700"
          aria-label="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={addLink}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
        >
          Link
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="mt-2 min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
        aria-label="Internal note"
        suppressContentEditableWarning
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className={BUTTON_CLASS}
        >
          {isPending ? "Adding" : "Add note"}
        </button>
        {status && <span className="text-xs text-emerald-600">{status}</span>}
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>
    </div>
  );
}

export function CaseActionButtons({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: "resolve" | "dismiss") {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result =
          action === "resolve"
            ? await resolveCaseAction(caseId)
            : await dismissCaseAction(caseId, reason);
        setStatus(result.message);
        if (action === "dismiss") setDismissOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run("resolve")}
          disabled={isPending}
          className={BUTTON_CLASS}
        >
          Resolve
        </button>
        <button
          type="button"
          onClick={() => setDismissOpen((open) => !open)}
          disabled={isPending}
          className={BUTTON_CLASS}
        >
          Dismiss
        </button>
      </div>
      {dismissOpen && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-500">
            Dismiss reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              className="mt-1 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              required
            />
          </label>
          <button
            type="button"
            onClick={() => run("dismiss")}
            disabled={isPending || reason.trim().length === 0}
            className={`mt-2 ${BUTTON_CLASS}`}
          >
            Confirm dismiss
          </button>
        </div>
      )}
      {status && <p className="text-xs text-emerald-600">{status}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function RetrySyncButton({
  outboxId,
  disabled,
}: {
  outboxId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function retry() {
    setStatus(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await retrySyncAction(outboxId);
        setStatus(result.message);
        router.refresh();
      } catch (err) {
        console.error("[cases] retry sync failed", err);
        setError(err instanceof Error ? err.message : "Retry failed");
      }
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={retry}
        disabled={disabled || isPending}
        className={BUTTON_CLASS}
      >
        {isPending ? "Retrying" : "Retry sync"}
      </button>
      {status && <p className="mt-1 text-xs text-emerald-600">{status}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
