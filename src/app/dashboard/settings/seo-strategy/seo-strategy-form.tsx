"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { SeoStrategyPayload, SeoStrategyRecord } from "@/app/api/settings/seo-strategy/handler";

type FieldKey = keyof SeoStrategyPayload;

const objectFields: Array<{
  key: Exclude<FieldKey, "avoidTopics" | "avoidClaims" | "avoidKeywords">;
  title: string;
  help: string;
}> = [
  {
    key: "targetKeywords",
    title: "Target keywords",
    help: 'One JSON object per line: {"keyword":"...", "priority":"high|medium|low", "notes":"..."}',
  },
  {
    key: "priorityServices",
    title: "Priority services",
    help: 'One JSON object per line: {"name":"...", "url":"https://...", "notes":"..."}',
  },
  {
    key: "priorityLocations",
    title: "Priority locations",
    help: 'One JSON object per line: {"name":"...", "notes":"..."}',
  },
  {
    key: "targetAudiences",
    title: "Target audiences",
    help: 'One JSON object per line: {"persona":"...", "description":"..."}',
  },
  {
    key: "approvedInternalUrls",
    title: "Approved internal URLs",
    help: 'One JSON object per line: {"url":"https://...", "label":"...", "topic":"..."}',
  },
  {
    key: "preferredCtas",
    title: "Preferred CTAs",
    help: 'One JSON object per line: {"label":"...", "url":"https://...", "article_type":"...", "audience":"..."}',
  },
];

const stringFields: Array<{
  key: Extract<FieldKey, "avoidTopics" | "avoidClaims" | "avoidKeywords">;
  title: string;
  help: string;
}> = [
  {
    key: "avoidTopics",
    title: "Avoid topics",
    help: "One topic per line.",
  },
  {
    key: "avoidClaims",
    title: "Avoid claims",
    help: "One claim per line.",
  },
  {
    key: "avoidKeywords",
    title: "Avoid keywords",
    help: "One keyword per line.",
  },
];

function objectLines(value: unknown[]) {
  return value.map((item) => JSON.stringify(item)).join("\n");
}

function stringLines(value: string[]) {
  return value.join("\n");
}

function parseObjectLines(input: string) {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function parseStringLines(input: string) {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function TextareaField({
  title,
  help,
  value,
  onChange,
}: {
  title: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{title}</span>
      <span className="mt-1 block text-xs text-zinc-500">{help}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm leading-6 text-zinc-800"
      />
    </label>
  );
}

export function SeoStrategyForm({
  initialStrategy,
}: {
  initialStrategy: SeoStrategyRecord;
}) {
  const initialValues = useMemo(() => {
    const values: Record<FieldKey, string> = {
      targetKeywords: objectLines(initialStrategy.targetKeywords),
      priorityServices: objectLines(initialStrategy.priorityServices),
      priorityLocations: objectLines(initialStrategy.priorityLocations),
      targetAudiences: objectLines(initialStrategy.targetAudiences),
      approvedInternalUrls: objectLines(initialStrategy.approvedInternalUrls),
      preferredCtas: objectLines(initialStrategy.preferredCtas),
      avoidTopics: stringLines(initialStrategy.avoidTopics),
      avoidClaims: stringLines(initialStrategy.avoidClaims),
      avoidKeywords: stringLines(initialStrategy.avoidKeywords),
    };
    return values;
  }, [initialStrategy]);

  const [values, setValues] = useState(initialValues);
  const [revision, setRevision] = useState(initialStrategy.revision);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const payload: SeoStrategyPayload = {
        targetKeywords: parseObjectLines(values.targetKeywords) as SeoStrategyPayload["targetKeywords"],
        priorityServices: parseObjectLines(values.priorityServices) as SeoStrategyPayload["priorityServices"],
        priorityLocations: parseObjectLines(values.priorityLocations) as SeoStrategyPayload["priorityLocations"],
        targetAudiences: parseObjectLines(values.targetAudiences) as SeoStrategyPayload["targetAudiences"],
        approvedInternalUrls: parseObjectLines(values.approvedInternalUrls) as SeoStrategyPayload["approvedInternalUrls"],
        preferredCtas: parseObjectLines(values.preferredCtas) as SeoStrategyPayload["preferredCtas"],
        avoidTopics: parseStringLines(values.avoidTopics),
        avoidClaims: parseStringLines(values.avoidClaims),
        avoidKeywords: parseStringLines(values.avoidKeywords),
      };
      const res = await fetch("/api/settings/seo-strategy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setRevision(data.seoStrategy?.revision ?? revision);
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Strategy fields
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Revision {revision}. Updates are used by future article generation runs.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save strategy"}
          </button>
        </div>
        {status ? <p className="mt-3 text-sm text-green-700">{status}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {objectFields.map((field) => (
          <section key={field.key} className="rounded-lg border border-zinc-200 bg-white p-6">
            <TextareaField
              title={field.title}
              help={field.help}
              value={values[field.key]}
              onChange={(value) => update(field.key, value)}
            />
          </section>
        ))}
        {stringFields.map((field) => (
          <section key={field.key} className="rounded-lg border border-zinc-200 bg-white p-6">
            <TextareaField
              title={field.title}
              help={field.help}
              value={values[field.key]}
              onChange={(value) => update(field.key, value)}
            />
          </section>
        ))}
      </div>
    </form>
  );
}
