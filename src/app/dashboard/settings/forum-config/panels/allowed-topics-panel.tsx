"use client";

import { useState, useMemo } from "react";
import { allowedTopicsSchema } from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import {
  ChipInput,
  Field,
  PanelCard,
  PanelHeader,
  SaveBar,
} from "../ui";

function normalise(initial: unknown): string[] {
  const parsed = allowedTopicsSchema.safeParse(initial);
  return parsed.success ? parsed.data : [];
}

export function AllowedTopicsPanel({
  initialValue,
  onSaved,
}: {
  initialValue: unknown;
  onSaved: (value: string[]) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const local = allowedTopicsSchema.safeParse(value);
    if (!local.success) {
      setError(local.error.issues[0]?.message ?? "Invalid topics.");
      setSaving(false);
      return;
    }

    const res = await saveSlice("allowed_topics", local.data);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved(local.data);
  }

  return (
    <PanelCard>
      <PanelHeader
        title="Allowed topics"
        description="The topics your chatbot is allowed to discuss. Anything outside this list is deflected. Off-topic block lists live under exclusion_list (managed separately for V1)."
      />

      <Field
        label="Topics"
        hint="Add one topic at a time. Press Enter to add. These are matched against the conversation classifier."
      >
        <ChipInput
          values={value}
          onChange={setValue}
          placeholder="e.g. dog training, puppy advice"
        />
      </Field>

      {value.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          ⚠️ With no allowed topics configured, your bot won&apos;t have an
          explicit topic gate. Make sure your persona + voice_description carry the
          guardrail load until you add specific topics here.
        </p>
      )}

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
