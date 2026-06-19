"use client";

import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import {
  Field,
  PanelCard,
  PanelHeader,
  SaveBar,
  TextInput,
} from "../ui";

export type ConversationLimitsValue = {
  maxTurnsBeforeCTA: number;
  idleTimeoutMinutes: number;
};

const DEFAULT_LIMITS: ConversationLimitsValue = {
  maxTurnsBeforeCTA: 5,
  idleTimeoutMinutes: 10,
};

const schema = z.object({
  maxTurnsBeforeCTA: z.number().int().min(1).max(50),
  idleTimeoutMinutes: z.number().int().min(1).max(120),
});

function normalise(initial: unknown): ConversationLimitsValue {
  const parsed = schema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_LIMITS;
}

export function ConversationLimitsPanel({
  initialValue,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  onSaved: (value: ConversationLimitsValue) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<ConversationLimitsValue>(initial);
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

    const local = schema.safeParse(value);
    if (!local.success) {
      setError(local.error.issues[0]?.message ?? "Invalid limits.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/conversation-limits", {
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

      const savedValue = normalise(data.conversationLimits);
      setValue(savedValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved(savedValue);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <PanelCard>
      <PanelHeader
        title="Conversation limits"
        description="When the bot offers a call to action, and how long an idle chat stays open."
      />

      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field
          label="Max turns before CTA"
          htmlFor="max-turns-before-cta"
          hint="One turn = one visitor message and one bot reply. Most tenants pick 4–6."
        >
          <TextInput
            id="max-turns-before-cta"
            type="number"
            min={1}
            max={50}
            value={value.maxTurnsBeforeCTA}
            onChange={(e) =>
              setValue({
                ...value,
                maxTurnsBeforeCTA: Number.parseInt(e.target.value, 10) || 1,
              })
            }
          />
        </Field>
        <Field
          label="Idle timeout (minutes)"
          htmlFor="idle-timeout-minutes"
          hint="How long an inactive chat stays open before it's marked idle."
        >
          <TextInput
            id="idle-timeout-minutes"
            type="number"
            min={1}
            max={120}
            value={value.idleTimeoutMinutes}
            onChange={(e) =>
              setValue({
                ...value,
                idleTimeoutMinutes: Number.parseInt(e.target.value, 10) || 1,
              })
            }
          />
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
        }}
      />
    </PanelCard>
  );
}
