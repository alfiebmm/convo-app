"use client";

import { useState, useMemo, useEffect } from "react";
import {
  qualifyingQuestionsSchema,
  type QualifyingQuestion,
} from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import {
  Field,
  GhostButton,
  DangerButton,
  PanelCard,
  PanelHeader,
  SaveBar,
  SubSection,
  TextInput,
} from "../ui";

type Value = {
  preset?: QualifyingQuestion;
  additional: QualifyingQuestion[];
};

const DEFAULT_QUESTION: QualifyingQuestion = {
  question: "",
  options: [{ label: "", value: "" }],
  persona_field: "",
};

function normalise(initial: unknown): Value {
  const parsed = qualifyingQuestionsSchema.safeParse(initial);
  if (parsed.success)
    return { preset: parsed.data.preset, additional: parsed.data.additional };
  return { additional: [] };
}

export function QualifyingPanel({
  initialValue,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  onSaved: (value: Value) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<Value>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Strip the preset if it's empty (schema treats it as optional)
    const payload: Value = {
      ...(value.preset && value.preset.question.trim()
        ? { preset: value.preset }
        : {}),
      additional: value.additional,
    };

    const local = qualifyingQuestionsSchema.safeParse(payload);
    if (!local.success) {
      setError(
        local.error.issues[0]?.message ?? "Please fix the highlighted fields.",
      );
      setSaving(false);
      return;
    }

    const res = await saveSlice("qualifying_questions", local.data);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved(local.data);
  }

  function updateQuestion(
    target: "preset" | number,
    next: QualifyingQuestion,
  ) {
    if (target === "preset") {
      setValue({ ...value, preset: next });
    } else {
      const additional = [...value.additional];
      additional[target] = next;
      setValue({ ...value, additional });
    }
  }

  const presetQuestion: QualifyingQuestion = value.preset ?? DEFAULT_QUESTION;

  return (
    <PanelCard>
      <PanelHeader
        title="Qualifying questions"
        description="Opening multiple-choice questions the bot asks every new visitor. One preset question plus up to four follow-ons."
      />

      <div className="space-y-5">
        <SubSection
          title="Preset question"
          description="The first question every visitor sees. Leave blank to use our default opener."
        >
          <QuestionEditor
            value={presetQuestion}
            onChange={(q) => updateQuestion("preset", q)}
          />
        </SubSection>

        <SubSection
          title="Additional questions"
          description={`Up to 4 follow-on questions, asked in order after the preset. ${value.additional.length}/4 used.`}
          action={
            <GhostButton
              disabled={value.additional.length >= 4}
              onClick={() =>
                setValue({
                  ...value,
                  additional: [
                    ...value.additional,
                    { ...DEFAULT_QUESTION, options: [{ label: "", value: "" }] },
                  ],
                })
              }
            >
              + Add question
            </GhostButton>
          }
        >
          {value.additional.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No additional questions yet. Add one if you need to route
              visitors by intent (e.g. buyer vs. seller, new vs. returning).
            </p>
          ) : (
            value.additional.map((q, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Question {i + 1}
                  </p>
                  <DangerButton
                    onClick={() =>
                      setValue({
                        ...value,
                        additional: value.additional.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </DangerButton>
                </div>
                <QuestionEditor
                  value={q}
                  onChange={(next) => updateQuestion(i, next)}
                />
              </div>
            ))
          )}
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

function QuestionEditor({
  value,
  onChange,
}: {
  value: QualifyingQuestion;
  onChange: (next: QualifyingQuestion) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Question text" hint="The question your visitor sees.">
        <TextInput
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          placeholder="e.g. What brings you here today?"
        />
      </Field>

      <Field
        label="Persona field"
        hint="Internal name for storing the answer (e.g. visitor_intent, marketplace_side). Lowercase, no spaces."
      >
        <TextInput
          value={value.persona_field}
          onChange={(e) =>
            onChange({ ...value, persona_field: e.target.value })
          }
          placeholder="visitor_intent"
        />
      </Field>

      <Field
        label="Options"
        hint="Answers the visitor picks from. Label is what they see; value is what gets stored."
      >
        <div className="space-y-2">
          {value.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                value={opt.label}
                onChange={(e) => {
                  const options = [...value.options];
                  options[i] = { ...opt, label: e.target.value };
                  onChange({ ...value, options });
                }}
                placeholder="Label (visible)"
              />
              <TextInput
                value={opt.value}
                onChange={(e) => {
                  const options = [...value.options];
                  options[i] = { ...opt, value: e.target.value };
                  onChange({ ...value, options });
                }}
                placeholder="value (internal)"
              />
              <DangerButton
                disabled={value.options.length <= 1}
                onClick={() =>
                  onChange({
                    ...value,
                    options: value.options.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </DangerButton>
            </div>
          ))}
          <GhostButton
            onClick={() =>
              onChange({
                ...value,
                options: [...value.options, { label: "", value: "" }],
              })
            }
          >
            + Add option
          </GhostButton>
        </div>
      </Field>
    </div>
  );
}
