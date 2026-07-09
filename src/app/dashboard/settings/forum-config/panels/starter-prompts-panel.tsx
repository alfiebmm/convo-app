"use client";

/**
 * StarterPromptsPanel — CON-251.
 *
 * Authors the closed-widget quick-action pill stack. Each row is one pill:
 * emoji glyph + short label + full prompt string that gets sent to the
 * chatbot as if the visitor had typed it.
 *
 * Deliberately NOT conflated with qualifying-questions — starter prompts
 * are cosmetic openers, no persona side-effects. See CON-A-audit §7.
 */

import { useState, useMemo, useEffect } from "react";
import {
  starterPromptsSchema,
  type StarterPrompt,
} from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import {
  DangerButton,
  EmptyState,
  Field,
  GhostButton,
  PanelCard,
  PanelHeader,
  SaveBar,
  SubSection,
  TextArea,
  TextInput,
} from "../ui";

const MAX_PILLS = 3;
const EMOJI_MAX = 8;
const LABEL_MAX = 28;
const PROMPT_MAX = 280;

const EMPTY_PROMPT: StarterPrompt = { emoji: "", label: "", prompt: "" };

function normalise(initial: unknown): StarterPrompt[] {
  const parsed = starterPromptsSchema.safeParse(initial);
  return parsed.success ? parsed.data : [];
}

export function StarterPromptsPanel({
  initialValue,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  onSaved: (value: StarterPrompt[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<StarterPrompt[]>(initial);
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

    const local = starterPromptsSchema.safeParse(value);
    if (!local.success) {
      setError(
        local.error.issues[0]?.message ?? "Please fix the highlighted fields.",
      );
      setSaving(false);
      return;
    }

    const res = await saveSlice("starter_prompts", local.data);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved(local.data);
  }

  function updateRow(index: number, next: StarterPrompt) {
    const copy = [...value];
    copy[index] = next;
    setValue(copy);
  }

  function removeRow(index: number) {
    setValue(value.filter((_, i) => i !== index));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const copy = [...value];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    setValue(copy);
  }

  const atCap = value.length >= MAX_PILLS;

  return (
    <PanelCard>
      <PanelHeader
        title="Starter prompts"
        description="Tap-to-send quick-action pills that appear above the closed chat bubble on desktop. One click opens the chat and sends the pill's prompt as if the visitor typed it. Hidden on mobile."
      />

      <SubSection
        title="Pills"
        description={`Up to ${MAX_PILLS} pills. ${value.length}/${MAX_PILLS} used.${atCap ? " Max reached — remove one to add another." : ""}`}
        action={
          <GhostButton
            disabled={atCap}
            onClick={() => setValue([...value, { ...EMPTY_PROMPT }])}
          >
            + Add pill
          </GhostButton>
        }
      >
        {value.length === 0 ? (
          <EmptyState
            title="No starter prompts yet"
            description="Add short, common openers to lower the barrier to the first message. Example: 🐾 See puppies → “Show me available puppies”."
            action={
              <GhostButton
                onClick={() => setValue([{ ...EMPTY_PROMPT }])}
              >
                + Add your first pill
              </GhostButton>
            }
          />
        ) : (
          value.map((row, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Pill {i + 1}
                </p>
                <div className="flex items-center gap-1.5">
                  <GhostButton
                    disabled={i === 0}
                    onClick={() => moveRow(i, -1)}
                  >
                    ↑
                  </GhostButton>
                  <GhostButton
                    disabled={i === value.length - 1}
                    onClick={() => moveRow(i, 1)}
                  >
                    ↓
                  </GhostButton>
                  <DangerButton onClick={() => removeRow(i)}>
                    Remove
                  </DangerButton>
                </div>
              </div>
              <PillEditor
                value={row}
                onChange={(next) => updateRow(i, next)}
              />
            </div>
          ))
        )}
      </SubSection>

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

function PillEditor({
  value,
  onChange,
}: {
  value: StarterPrompt;
  onChange: (next: StarterPrompt) => void;
}) {
  const emojiOver = value.emoji.length > EMOJI_MAX;
  const labelOver = value.label.length > LABEL_MAX;
  const promptOver = value.prompt.length > PROMPT_MAX;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[6rem,1fr] gap-3">
        <Field
          label="Emoji"
          hint={`1–${EMOJI_MAX} chars.`}
          error={emojiOver ? `Max ${EMOJI_MAX} chars.` : undefined}
        >
          <TextInput
            value={value.emoji}
            onChange={(e) => onChange({ ...value, emoji: e.target.value })}
            placeholder="🐾"
            maxLength={EMOJI_MAX * 2 /* allow paste, we validate on save */}
          />
        </Field>
        <Field
          label="Label"
          hint={`Short pill label. ${value.label.length}/${LABEL_MAX}`}
          error={labelOver ? `Max ${LABEL_MAX} chars.` : undefined}
        >
          <TextInput
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="See puppies"
            maxLength={LABEL_MAX}
          />
        </Field>
      </div>

      <Field
        label="Prompt"
        hint={`Full message sent to the bot when this pill is tapped. ${value.prompt.length}/${PROMPT_MAX}`}
        error={promptOver ? `Max ${PROMPT_MAX} chars.` : undefined}
      >
        <TextArea
          value={value.prompt}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          placeholder="Show me the puppies you have available right now."
          rows={2}
          maxLength={PROMPT_MAX}
        />
      </Field>
    </div>
  );
}
