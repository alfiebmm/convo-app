"use client";

import { useEffect, useMemo, useState } from "react";

import {
  contentRulesSchema,
  type ContentRules,
} from "@/lib/forum-config/schema";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";
import { saveSlice } from "@/app/dashboard/settings/forum-config/types";
import {
  ChipInput,
  Field,
  PanelCard,
  PanelHeader,
  SaveBar,
  TextArea,
  TextInput,
} from "@/app/dashboard/settings/forum-config/ui";

function normalise(initial: unknown): ContentRules {
  const parsed = contentRulesSchema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_FORUM_CONFIG.contentRules;
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ContentRulesPanel({
  initialValue,
}: {
  initialValue: unknown;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<ContentRules>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    setIssues({});

    const local = contentRulesSchema.safeParse(value);
    if (!local.success) {
      const nextIssues: Record<string, string> = {};
      for (const issue of local.error.issues) {
        nextIssues[issue.path.join(".")] = issue.message;
      }
      setIssues(nextIssues);
      setError("Please fix the highlighted fields.");
      setSaving(false);
      return;
    }

    const res = await saveSlice("contentRules", local.data);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setValue(local.data);
  }

  const styleGuide = value.styleGuide;
  const blogTemplate = value.blogTemplate;

  return (
    <PanelCard>
      <PanelHeader
        title="Content rules"
        description="Rules used by blog generation and chatbot topic exclusions."
      />

      <div className="space-y-8">
        <section className="space-y-5">
          <h3 className="text-sm font-semibold text-zinc-900">Style guide</h3>
          <Field
            label="Tone"
            htmlFor="content-rules-tone"
            error={issues["styleGuide.tone"]}
          >
            <TextInput
              id="content-rules-tone"
              value={styleGuide.tone}
              onChange={(e) =>
                setValue({
                  ...value,
                  styleGuide: { ...styleGuide, tone: e.target.value },
                })
              }
            />
          </Field>

          <Field
            label="Reading level"
            htmlFor="content-rules-reading-level"
            error={issues["styleGuide.readingLevel"]}
          >
            <TextInput
              id="content-rules-reading-level"
              value={styleGuide.readingLevel}
              onChange={(e) =>
                setValue({
                  ...value,
                  styleGuide: { ...styleGuide, readingLevel: e.target.value },
                })
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum words"
              htmlFor="content-rules-min-length"
              error={issues["styleGuide.lengthTargets.min"]}
            >
              <TextInput
                id="content-rules-min-length"
                type="number"
                min={0}
                value={styleGuide.lengthTargets.min}
                onChange={(e) =>
                  setValue({
                    ...value,
                    styleGuide: {
                      ...styleGuide,
                      lengthTargets: {
                        ...styleGuide.lengthTargets,
                        min: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </Field>
            <Field
              label="Maximum words"
              htmlFor="content-rules-max-length"
              error={issues["styleGuide.lengthTargets.max"]}
            >
              <TextInput
                id="content-rules-max-length"
                type="number"
                min={1}
                value={styleGuide.lengthTargets.max}
                onChange={(e) =>
                  setValue({
                    ...value,
                    styleGuide: {
                      ...styleGuide,
                      lengthTargets: {
                        ...styleGuide.lengthTargets,
                        max: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </Field>
          </div>

          <Field
            label="Banned words"
            hint="Type a word or phrase and press Enter."
            error={issues["styleGuide.bannedWords"]}
          >
            <ChipInput
              values={styleGuide.bannedWords}
              onChange={(bannedWords) =>
                setValue({
                  ...value,
                  styleGuide: { ...styleGuide, bannedWords },
                })
              }
              placeholder="Add a banned word"
            />
          </Field>
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-semibold text-zinc-900">Blog template</h3>
          <Field
            label="H1 pattern"
            htmlFor="content-rules-h1"
            error={issues["blogTemplate.h1Pattern"]}
          >
            <TextInput
              id="content-rules-h1"
              value={blogTemplate.h1Pattern}
              onChange={(e) =>
                setValue({
                  ...value,
                  blogTemplate: { ...blogTemplate, h1Pattern: e.target.value },
                })
              }
            />
          </Field>

          <Field
            label="H2 sections"
            htmlFor="content-rules-h2"
            hint="One preferred section heading per line."
            error={issues["blogTemplate.h2Sections"]}
          >
            <TextArea
              id="content-rules-h2"
              rows={5}
              value={blogTemplate.h2Sections.join("\n")}
              onChange={(e) =>
                setValue({
                  ...value,
                  blogTemplate: {
                    ...blogTemplate,
                    h2Sections: splitLines(e.target.value),
                  },
                })
              }
            />
          </Field>

          <label className="flex items-center gap-3 text-sm font-medium text-zinc-900">
            <input
              type="checkbox"
              checked={blogTemplate.faqEnabled}
              onChange={(e) =>
                setValue({
                  ...value,
                  blogTemplate: {
                    ...blogTemplate,
                    faqEnabled: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
            Include FAQ section
          </label>

          <Field
            label="CTA placeholders"
            hint="Type a placeholder and press Enter."
            error={issues["blogTemplate.ctaPlaceholders"]}
          >
            <ChipInput
              values={blogTemplate.ctaPlaceholders}
              onChange={(ctaPlaceholders) =>
                setValue({
                  ...value,
                  blogTemplate: { ...blogTemplate, ctaPlaceholders },
                })
              }
              placeholder="e.g. book-consultation"
            />
          </Field>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-zinc-900">Personas</h3>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              onClick={() =>
                setValue({
                  ...value,
                  personas: [
                    ...value.personas,
                    { name: "New persona", description: "", goals: [], painPoints: [] },
                  ],
                })
              }
            >
              Add persona
            </button>
          </div>

          {value.personas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
              No personas yet.
            </div>
          ) : (
            <div className="space-y-4">
              {value.personas.map((persona, index) => (
                <div
                  key={`${persona.name}-${index}`}
                  className="rounded-lg border border-zinc-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid flex-1 gap-4 sm:grid-cols-2">
                      <Field label="Name">
                        <TextInput
                          value={persona.name}
                          onChange={(e) => {
                            const personas = [...value.personas];
                            personas[index] = {
                              ...persona,
                              name: e.target.value,
                            };
                            setValue({ ...value, personas });
                          }}
                        />
                      </Field>
                      <Field label="Description">
                        <TextInput
                          value={persona.description}
                          onChange={(e) => {
                            const personas = [...value.personas];
                            personas[index] = {
                              ...persona,
                              description: e.target.value,
                            };
                            setValue({ ...value, personas });
                          }}
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        setValue({
                          ...value,
                          personas: value.personas.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Goals">
                      <ChipInput
                        values={persona.goals}
                        onChange={(goals) => {
                          const personas = [...value.personas];
                          personas[index] = { ...persona, goals };
                          setValue({ ...value, personas });
                        }}
                        placeholder="Add a goal"
                      />
                    </Field>
                    <Field label="Pain points">
                      <ChipInput
                        values={persona.painPoints}
                        onChange={(painPoints) => {
                          const personas = [...value.personas];
                          personas[index] = { ...persona, painPoints };
                          setValue({ ...value, personas });
                        }}
                        placeholder="Add a pain point"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">
            Exclusion list
          </h3>
          <Field
            label="Excluded topics"
            hint="Excluded topics block chatbot answers and blog creation."
            error={issues.exclusionList}
          >
            <ChipInput
              values={value.exclusionList}
              onChange={(exclusionList) =>
                setValue({ ...value, exclusionList })
              }
              placeholder="e.g. legal advice"
            />
          </Field>
        </section>
      </div>

      <SaveBar
        saving={saving}
        saved={saved}
        error={error}
        dirty={dirty}
        onSave={handleSave}
        onReset={() => {
          setValue(initial);
          setError(null);
          setIssues({});
        }}
      />
    </PanelCard>
  );
}
