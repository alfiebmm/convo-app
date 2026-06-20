"use client";

import { useEffect, useMemo, useState } from "react";
import { welcomeSchema, type Welcome } from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import { Field, PanelCard, PanelHeader, SaveBar, TextArea } from "../ui";

const DEFAULT_WELCOME: Welcome = {
  copy: "",
  enabled: true,
  show_with_questions: false,
};

function normalise(initial: unknown): Welcome {
  const parsed = welcomeSchema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_WELCOME;
}

export function WelcomePanel({
  initialValue,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  onSaved: (value: Welcome) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<Welcome>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    setIssues({});

    const local = welcomeSchema.safeParse(value);
    if (!local.success) {
      const issMap: Record<string, string> = {};
      for (const i of local.error.issues) {
        issMap[i.path.join(".")] = i.message;
      }
      setIssues(issMap);
      setError("Please fix the highlighted fields.");
      setSaving(false);
      return;
    }

    const res = await saveSlice("welcome", local.data);
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
        title="Welcome message"
        description="The first assistant message visitors see when the widget opens."
      />

      <div className="space-y-5">
        <Field
          label="Enable welcome message"
          hint="When off, the widget opens straight to qualifying questions or the message box."
        >
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) =>
                setValue({ ...value, enabled: e.currentTarget.checked })
              }
              className="h-4 w-4 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
            Show a welcome message on widget open
          </label>
        </Field>

        <Field
          label="Welcome copy"
          htmlFor="welcome-copy"
          hint="Short, helpful copy works best. Qualifying questions show first by default when they are configured."
          error={issues.copy}
        >
          <TextArea
            id="welcome-copy"
            rows={4}
            value={value.copy}
            onChange={(e) => setValue({ ...value, copy: e.target.value })}
            placeholder="Hi there, how can I help you today?"
          />
        </Field>

        <Field
          label="Show with qualifying questions"
          hint="Override the default rule and show the welcome message before the first qualifying question."
        >
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={value.show_with_questions}
              onChange={(e) =>
                setValue({
                  ...value,
                  show_with_questions: e.currentTarget.checked,
                })
              }
              className="h-4 w-4 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
            Show welcome and qualifying questions together
          </label>
        </Field>
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
