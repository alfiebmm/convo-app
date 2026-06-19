"use client";

/**
 * Shared UI primitives for the forum-config authoring panels (CON-191).
 *
 * Tailwind v4. Brand-system compliant:
 *   - Input/textarea text colour is text-zinc-900 (AA contrast on white) —
 *     explicitly avoids the CON-190 bug where existing settings inputs use
 *     light zinc tones that fail WCAG AA on white.
 *   - Primary accent is the Convo orange (#FF6B2C) for save buttons + focus.
 *   - Fonts/typography inherit from the dashboard root (Inter/Outfit/Fredoka
 *     are loaded globally — see glasshouse/clients/convo/brand-system.md).
 */
import type { ReactNode } from "react";

const INPUT_BASE =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 " +
  "focus:border-[#FF6B2C] focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  const { className, ...rest } = props;
  return (
    <input type="text" {...rest} className={`${INPUT_BASE} ${className ?? ""}`} />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className, ...rest } = props;
  return (
    <textarea {...rest} className={`${INPUT_BASE} ${className ?? ""}`} />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={`${INPUT_BASE} ${className ?? ""}`}>
      {children}
    </select>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-zinc-900"
      >
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
      )}
    </div>
  );
}

export function SaveBar({
  saving,
  saved,
  error,
  onSave,
  onReset,
  dirty,
}: {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onReset?: () => void;
  dirty: boolean;
}) {
  // Sticky so the action stays visible while editing long panels (Follow-up
  // especially). White/blur backdrop keeps it readable over scrolled content.
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !dirty}
        className="rounded-lg bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#E85A1E] disabled:cursor-not-allowed disabled:bg-zinc-300 transition-colors"
      >
        {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
      </button>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={saving || !dirty}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Discard
        </button>
      )}
      {dirty && !saving && !error && (
        <span className="text-sm text-zinc-500" role="status">
          You have unsaved changes.
        </span>
      )}
      {saved && !dirty && !error && (
        <span className="text-sm text-emerald-600" role="status">
          ✓ Saved
        </span>
      )}
      {error && (
        <span className="text-sm text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * EmptyState — used inside a SubSection or panel when a list is empty.
 * Nudges the tenant toward a sensible starting action instead of leaving a
 * bare "No X yet" line.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
          {description}
        </p>
      )}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function ChipInput({
  values,
  onChange,
  placeholder,
  inputId,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  inputId?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-900"
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="text-zinc-500 hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2">
        <TextInput
          id={inputId}
          placeholder={placeholder ?? "Type and press Enter…"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const input = e.currentTarget;
              const v = input.value.trim();
              if (v && !values.includes(v)) onChange([...values, v]);
              input.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}

export function SubSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-5 space-y-3">{children}</div>
    </section>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}
