"use client";

import { useMemo, useState } from "react";
import type { ContentRules } from "@/lib/forum-config/schema";

type FormState = {
  tone: string;
  bannedWords: string;
  readingLevel: string;
  min: string;
  max: string;
  h1Pattern: string;
  h2Sections: string;
  faqEnabled: boolean;
  ctaPlaceholders: string;
  personas: string;
  exclusionList: string;
};

function listToLines(values: readonly string[]): string {
  return values.join("\n");
}

function linesToList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stateFromRules(rules: ContentRules): FormState {
  return {
    tone: rules.styleGuide.tone,
    bannedWords: listToLines(rules.styleGuide.bannedWords),
    readingLevel: rules.styleGuide.readingLevel,
    min: String(rules.styleGuide.lengthTargets.min),
    max: String(rules.styleGuide.lengthTargets.max),
    h1Pattern: rules.blogTemplate.h1Pattern,
    h2Sections: listToLines(rules.blogTemplate.h2Sections),
    faqEnabled: rules.blogTemplate.faqEnabled,
    ctaPlaceholders: listToLines(rules.blogTemplate.ctaPlaceholders),
    personas: rules.personas
      .map((persona) =>
        [
          persona.name,
          persona.audience,
          persona.tone,
          persona.description,
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n"),
    exclusionList: listToLines(rules.exclusionList),
  };
}

function rulesFromState(state: FormState): ContentRules {
  return {
    styleGuide: {
      tone: state.tone.trim(),
      bannedWords: linesToList(state.bannedWords),
      readingLevel: state.readingLevel.trim(),
      lengthTargets: {
        min: Number(state.min),
        max: Number(state.max),
      },
    },
    blogTemplate: {
      h1Pattern: state.h1Pattern.trim(),
      h2Sections: linesToList(state.h2Sections),
      faqEnabled: state.faqEnabled,
      ctaPlaceholders: linesToList(state.ctaPlaceholders),
    },
    personas: state.personas
      .split(/\r?\n/)
      .map((line, index) => {
        const [name, audience, tone, description] = line
          .split("|")
          .map((part) => part.trim());
        return {
          id: name
            ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
            : `persona-${index + 1}`,
          name: name ?? "",
          audience: audience || undefined,
          tone: tone || undefined,
          description: description ?? "",
        };
      })
      .filter((persona) => persona.name || persona.description),
    exclusionList: linesToList(state.exclusionList),
  };
}

function Field({
  label,
  children,
  description,
}: {
  label: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {description && (
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      )}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#FF6B2C] focus:outline-none focus:ring-1 focus:ring-[#FF6B2C]";

export function ContentRulesForm({
  initialValue,
}: {
  initialValue: ContentRules;
}) {
  const initialState = useMemo(() => stateFromRules(initialValue), [initialValue]);
  const [state, setState] = useState<FormState>(initialState);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(state) !== JSON.stringify(initialState);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
    setError(null);
  }

  async function save() {
    setStatus("saving");
    setError(null);
    const contentRules = rulesFromState(state);

    const res = await fetch("/api/settings/forum-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentRules }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setError(body.error ?? "Content rules could not be saved.");
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Tone">
            <input
              className={inputClass}
              value={state.tone}
              onChange={(e) => update("tone", e.target.value)}
            />
          </Field>
          <Field label="Reading level">
            <input
              className={inputClass}
              value={state.readingLevel}
              onChange={(e) => update("readingLevel", e.target.value)}
            />
          </Field>
          <Field label="Length target">
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                inputMode="numeric"
                value={state.min}
                onChange={(e) => update("min", e.target.value)}
                aria-label="Minimum words"
              />
              <input
                className={inputClass}
                inputMode="numeric"
                value={state.max}
                onChange={(e) => update("max", e.target.value)}
                aria-label="Maximum words"
              />
            </div>
          </Field>
          <Field label="Banned words" description="One word or phrase per line.">
            <textarea
              className={inputClass}
              rows={4}
              value={state.bannedWords}
              onChange={(e) => update("bannedWords", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="H1 pattern">
            <input
              className={inputClass}
              value={state.h1Pattern}
              onChange={(e) => update("h1Pattern", e.target.value)}
            />
          </Field>
          <Field label="CTA placeholders">
            <textarea
              className={inputClass}
              rows={3}
              value={state.ctaPlaceholders}
              onChange={(e) => update("ctaPlaceholders", e.target.value)}
            />
          </Field>
          <Field label="H2 sections" description="One section heading per line.">
            <textarea
              className={inputClass}
              rows={5}
              value={state.h2Sections}
              onChange={(e) => update("h2Sections", e.target.value)}
            />
          </Field>
          <div className="flex items-center gap-3 self-start pt-7">
            <input
              id="faqEnabled"
              type="checkbox"
              checked={state.faqEnabled}
              onChange={(e) => update("faqEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
            <label htmlFor="faqEnabled" className="text-sm text-slate-800">
              Include FAQ sections when useful
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Personas"
            description="One per line: name | audience | tone | description."
          >
            <textarea
              className={inputClass}
              rows={6}
              value={state.personas}
              onChange={(e) => update("personas", e.target.value)}
            />
          </Field>
          <Field
            label="Exclusion list"
            description="Chat and blog creation will deflect or skip matching topics."
          >
            <textarea
              className={inputClass}
              rows={6}
              value={state.exclusionList}
              onChange={(e) => update("exclusionList", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving" || !dirty}
          className="rounded-md bg-[#FF6B2C] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "saving" ? "Saving..." : "Save content rules"}
        </button>
        {status === "saved" && (
          <p className="text-sm text-emerald-700">Content rules saved.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-700">
            {error ?? "Content rules could not be saved."}
          </p>
        )}
      </div>
    </div>
  );
}
