"use client";

import { useState, useMemo, useEffect } from "react";
import {
  aiPersonaSchema,
  type AiPersona,
} from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import {
  Field,
  PanelCard,
  PanelHeader,
  SaveBar,
  Select,
  TextArea,
  TextInput,
  ChipInput,
} from "../ui";

const TONE_OPTIONS: AiPersona["tone"][] = [
  "professional",
  "friendly",
  "casual",
  "expert",
  "empathetic",
];

const DEFAULT_PERSONA: AiPersona = {
  tone: "friendly",
  locale: "en-AU",
  banned_words: [],
  voice_description: "",
};

function normalise(initial: unknown): AiPersona {
  const parsed = aiPersonaSchema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_PERSONA;
}

export function PersonaPanel({
  initialValue,
  onSaved,
  onDirtyChange,
}: {
  initialValue: unknown;
  onSaved: (value: AiPersona) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<AiPersona>(initial);
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

    // Client-side validation mirrors server (best-effort).
    const local = aiPersonaSchema.safeParse(value);
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

    const res = await saveSlice("ai_persona", local.data);
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
        title="Persona"
        description="How your chatbot sounds. Tone sets the overall character; voice description fine-tunes it."
      />

      <div className="space-y-5">
        <Field
          label="Tone"
          htmlFor="persona-tone"
          hint="The overall character of your bot's replies."
          error={issues.tone}
        >
          <Select
            id="persona-tone"
            value={value.tone}
            onChange={(e) =>
              setValue({ ...value, tone: e.target.value as AiPersona["tone"] })
            }
          >
            {TONE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Locale"
          htmlFor="persona-locale"
          hint="Language and region. en-AU for Australian English, en-GB for UK, en-US for US. Affects spelling and idiom."
          error={issues.locale}
        >
          <TextInput
            id="persona-locale"
            value={value.locale}
            onChange={(e) => setValue({ ...value, locale: e.target.value })}
            placeholder="en-AU"
          />
        </Field>

        <Field
          label="Voice description"
          htmlFor="persona-voice"
          hint="3–5 sentences describing how your bot sounds. The bot reads this on every reply, so be specific."
          error={issues.voice_description}
        >
          <TextArea
            id="persona-voice"
            rows={6}
            value={value.voice_description}
            onChange={(e) =>
              setValue({ ...value, voice_description: e.target.value })
            }
            placeholder="e.g. A practical, no-nonsense Australian dog trainer. Plain English, short sentences, never preachy."
          />
        </Field>

        <Field
          label="Banned words"
          hint="Words or phrases the bot must never use. Type one and press Enter to add."
          error={issues.banned_words}
        >
          <ChipInput
            values={value.banned_words}
            onChange={(banned_words) => setValue({ ...value, banned_words })}
            placeholder="Add a word and press Enter"
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
          setIssues({});
        }}
      />
    </PanelCard>
  );
}
