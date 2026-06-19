"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import {
  DangerButton,
  Field,
  GhostButton,
  PanelCard,
  PanelHeader,
  SaveBar,
  SubSection,
  TextArea,
  TextInput,
} from "../ui";

type DeflectRule = {
  topic: string;
  response: string;
};

export type TopicBoundariesValue = {
  deflect: DeflectRule[];
  hardBlock: string[];
};

const DEFAULT_BOUNDARIES: TopicBoundariesValue = {
  deflect: [],
  hardBlock: [],
};

const schema = z.object({
  deflect: z.array(z.object({ topic: z.string(), response: z.string() })),
  hardBlock: z.array(z.string()),
});

function normalise(initial: unknown): TopicBoundariesValue {
  const parsed = schema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_BOUNDARIES;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TopicBoundariesPanel({
  initialValue,
  onSaved,
}: {
  initialValue: unknown;
  onSaved: (value: TopicBoundariesValue) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<TopicBoundariesValue>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload: TopicBoundariesValue = {
      deflect: value.deflect.map((rule) => ({
        topic: rule.topic.trim(),
        response: rule.response.trim(),
      })),
      hardBlock: value.hardBlock.map((topic) => topic.trim()).filter(Boolean),
    };

    const local = schema.safeParse(payload);
    if (!local.success) {
      setError(local.error.issues[0]?.message ?? "Invalid topic boundaries.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/topic-boundaries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(local.data),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      setSaving(false);
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : `Save failed (${res.status})`,
        );
        return;
      }

      const savedValue = normalise(data.topicBoundaries);
      setValue(savedValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved(savedValue);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  function updateDeflectRule(index: number, next: DeflectRule) {
    const deflect = [...value.deflect];
    deflect[index] = next;
    setValue({ ...value, deflect });
  }

  return (
    <PanelCard>
      <PanelHeader
        title="Topic boundaries"
        description="Specific off-topic rules that redirect or hard-block conversations. Allowed topics stay in the Allowed topics tab."
      />

      <div className="space-y-5">
        <SubSection
          title="Deflect rules"
          description="Topics to redirect with a specific response."
          action={
            <GhostButton
              onClick={() =>
                setValue({
                  ...value,
                  deflect: [...value.deflect, { topic: "", response: "" }],
                })
              }
            >
              + Add rule
            </GhostButton>
          }
        >
          {value.deflect.length === 0 ? (
            <p className="text-sm text-zinc-500">No deflect rules yet.</p>
          ) : (
            value.deflect.map((rule, index) => (
              <div
                key={index}
                className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Rule {index + 1}
                  </p>
                  <DangerButton
                    onClick={() =>
                      setValue({
                        ...value,
                        deflect: value.deflect.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </DangerButton>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <Field label="Topic" hint="The topic or intent to redirect.">
                    <TextInput
                      value={rule.topic}
                      onChange={(e) =>
                        updateDeflectRule(index, {
                          ...rule,
                          topic: e.target.value,
                        })
                      }
                      placeholder="e.g. medical advice"
                    />
                  </Field>
                  <Field
                    label="Response"
                    hint="What the bot should say before returning to allowed topics."
                  >
                    <TextArea
                      rows={3}
                      value={rule.response}
                      onChange={(e) =>
                        updateDeflectRule(index, {
                          ...rule,
                          response: e.target.value,
                        })
                      }
                      placeholder="e.g. I can't advise on that, but I can help with care and training questions."
                    />
                  </Field>
                </div>
              </div>
            ))
          )}
        </SubSection>

        <SubSection
          title="Hard block"
          description="Topics the bot should never engage with."
        >
          <Field
            label="Hard block topics"
            htmlFor="hard-block-topics"
            hint="Comma-separated list. These are stored as individual topics."
          >
            <TextInput
              id="hard-block-topics"
              value={value.hardBlock.join(", ")}
              onChange={(e) =>
                setValue({ ...value, hardBlock: splitCsv(e.target.value) })
              }
              placeholder="puppy mill defence, animal welfare harm"
            />
          </Field>
        </SubSection>
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
        }}
      />
    </PanelCard>
  );
}
