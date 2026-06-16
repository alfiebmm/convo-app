"use client";

import { useState, useMemo } from "react";
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
}: {
  initialValue: unknown;
  onSaved: (value: Value) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<Value>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

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
        description="The opening multi-choice questions the bot asks every new visitor to set persona. One preset question + up to four additional."
      />

      <div className="space-y-5">
        <SubSection
          title="Preset question"
          description="Asked of every visitor first. Defaults applied if you leave it blank."
        >
          <QuestionEditor
            value={presetQuestion}
            onChange={(q) => updateQuestion("preset", q)}
          />
        </SubSection>

        <SubSection
          title="Additional questions"
          description={`Up to 4 follow-on questions. Currently ${value.additional.length}/4.`}
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
              No additional questions yet.
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
      <Field label="Question text" hint="The question shown to the visitor.">
        <TextInput
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          placeholder="e.g. What brings you here today?"
        />
      </Field>

      <Field
        label="Persona field"
        hint="The field name this answer populates on the visitor persona (e.g. visitor_intent, marketplace_side)."
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
        hint="The answers the visitor can pick. Each has a visible label and an internal value."
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
