"use client";

/**
 * StarterPromptsPanel — CON-251 / CON-258.
 *
 * Authors the closed-widget quick-action pill stack and its per-pill action
 * block. Validation stays delegated to `starterPromptsSchema`, which is also
 * used by the settings endpoint.
 */

import { useEffect, useMemo, useState } from "react";
import {
  starterPromptsSchema,
  type StarterPrompt,
} from "@/lib/forum-config/schema";
import {
  CAPTURE_FIELD_KEYS,
  FIELD_META,
  humaniseCaptureField,
} from "@/lib/capture-fields";
import { saveSlice } from "../types";
import {
  DangerButton,
  EmptyState,
  Field,
  GhostButton,
  PanelCard,
  PanelHeader,
  SaveBar,
  Select,
  SubSection,
  TextArea,
  TextInput,
} from "../ui";
import {
  actionTypeFor,
  moveField,
  setFieldEnabled,
  setLabelOverride,
  slugFromLabel,
  updateLeadPolicy,
  withActionType,
  type FieldTier,
  type StarterPromptActionType,
} from "./starter-prompts-state";

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
        description="Tap-to-send quick-action pills that appear above the closed chat bubble. Each pill can open chat, collect lead details, or show a booking-style embed."
      />

      <SubSection
        title="Pills"
        description={`Up to ${MAX_PILLS} pills. ${value.length}/${MAX_PILLS} used.${atCap ? " Max reached, remove one to add another." : ""}`}
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
            description="Add short, common openers to lower the barrier to the first message."
            action={
              <GhostButton onClick={() => setValue([{ ...EMPTY_PROMPT }])}>
                + Add your first pill
              </GhostButton>
            }
          />
        ) : (
          <div className="space-y-4">
            {value.map((row, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),22rem]">
                  <PillEditor
                    value={row}
                    onChange={(next) => updateRow(i, next)}
                  />
                  <PillPreview value={row} />
                </div>
              </div>
            ))}
          </div>
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
  const actionType = actionTypeFor(value);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[6rem,1fr]">
        <Field
          label="Emoji"
          hint={`1-${EMOJI_MAX} chars.`}
          error={emojiOver ? `Max ${EMOJI_MAX} chars.` : undefined}
        >
          <TextInput
            value={value.emoji}
            onChange={(e) => onChange({ ...value, emoji: e.target.value })}
            placeholder="🐾"
            maxLength={EMOJI_MAX * 2}
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
        hint={`Full chat message used for chat pills. ${value.prompt.length}/${PROMPT_MAX}`}
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

      <ActionTypeSelector
        value={actionType}
        onChange={(type) => onChange(withActionType(value, type))}
      />

      {actionType === "lead_capture" && (
        <LeadCaptureEditor value={value} onChange={onChange} />
      )}
      {actionType === "custom_embed" && (
        <CustomEmbedEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

function ActionTypeSelector({
  value,
  onChange,
}: {
  value: StarterPromptActionType;
  onChange: (value: StarterPromptActionType) => void;
}) {
  const options: Array<{ value: StarterPromptActionType; label: string }> = [
    { value: "chat", label: "Chat" },
    { value: "lead_capture", label: "Lead capture" },
    { value: "custom_embed", label: "Custom embed" },
  ];
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-zinc-900">
        Action type
      </legend>
      <div className="mt-1.5 inline-flex rounded-lg border border-zinc-300 bg-white p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              value === option.value
                ? "bg-[#FF6B2C] text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function LeadCaptureEditor({
  value,
  onChange,
}: {
  value: StarterPrompt;
  onChange: (next: StarterPrompt) => void;
}) {
  const next = withActionType(value, "lead_capture");
  if (next.action?.type !== "lead_capture") return null;
  const action = next.action;
  const policy = action.capture_policy;
  const selectedFields = [
    ...policy.required_fields,
    ...policy.optional_fields,
  ];
  const overrides = action.field_label_overrides ?? {};

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr,12rem]">
        <Field
          label="Policy ID"
          hint={`Suggested: ${slugFromLabel(value.label)}`}
        >
          <TextInput
            value={policy.id}
            onChange={(e) =>
              onChange(
                updateLeadPolicy(value, (p) => ({
                  ...p,
                  id: e.target.value,
                })),
              )
            }
            placeholder="starter_pill_get_in_touch"
          />
        </Field>
        <Field label="Case type">
          <Select
            value={policy.case_type}
            onChange={(e) =>
              onChange(
                updateLeadPolicy(value, (p) => ({
                  ...p,
                  case_type: e.target.value as "lead" | "cx_support",
                })),
              )
            }
          >
            <option value="lead">Lead</option>
            <option value="cx_support">CX support</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FieldListEditor
          title="Required fields"
          tier="required"
          fields={policy.required_fields}
          otherFields={policy.optional_fields}
          value={value}
          onChange={onChange}
        />
        <FieldListEditor
          title="Optional fields"
          tier="optional"
          fields={policy.optional_fields}
          otherFields={policy.required_fields}
          value={value}
          onChange={onChange}
        />
      </div>

      <Field label="Privacy notice">
        <TextArea
          value={policy.privacy_notice}
          onChange={(e) =>
            onChange(
              updateLeadPolicy(value, (p) => ({
                ...p,
                privacy_notice: e.target.value,
              })),
            )
          }
          rows={2}
        />
      </Field>

      <Field label="Privacy policy URL" hint="Must use https://">
        <TextInput
          value={policy.privacy_policy_url}
          onChange={(e) =>
            onChange(
              updateLeadPolicy(value, (p) => ({
                ...p,
                privacy_policy_url: e.target.value,
              })),
            )
          }
          placeholder="https://example.com/privacy"
        />
      </Field>

      <FieldLabelOverrides
        selectedFields={selectedFields}
        overrides={overrides}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function FieldListEditor({
  title,
  tier,
  fields,
  otherFields,
  value,
  onChange,
}: {
  title: string;
  tier: FieldTier;
  fields: string[];
  otherFields: string[];
  value: StarterPrompt;
  onChange: (next: StarterPrompt) => void;
}) {
  const [customField, setCustomField] = useState("");
  const otherSet = new Set(otherFields);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function addCustom() {
    const key = customField.trim();
    if (!key) return;
    onChange(setFieldEnabled(value, key, tier, true));
    setCustomField("");
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      <div className="mt-2 grid gap-1.5">
        {CAPTURE_FIELD_KEYS.map((field) => (
          <label
            key={field}
            className="flex items-center gap-2 text-sm text-zinc-700"
          >
            <input
              type="checkbox"
              checked={fields.includes(field)}
              disabled={otherSet.has(field)}
              onChange={(e) =>
                onChange(setFieldEnabled(value, field, tier, e.target.checked))
              }
              className="h-4 w-4 rounded border-zinc-300 text-[#FF6B2C] focus:ring-[#FF6B2C]"
            />
            <span>{field}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <TextInput
          value={customField}
          onChange={(e) => setCustomField(e.target.value)}
          placeholder="custom_field"
        />
        <GhostButton onClick={addCustom}>Add</GhostButton>
      </div>

      {fields.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {fields.map((field, index) => (
            <li
              key={`${field}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null) return;
                onChange(moveField(value, tier, dragIndex, index));
                setDragIndex(null);
              }}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
            >
              <span className="min-w-0 truncate">{field}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onChange(moveField(value, tier, index, index - 1))}
                  className="text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === fields.length - 1}
                  onClick={() => onChange(moveField(value, tier, index, index + 1))}
                  className="text-zinc-500 hover:text-zinc-900 disabled:opacity-30"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FieldLabelOverrides({
  selectedFields,
  overrides,
  value,
  onChange,
}: {
  selectedFields: string[];
  overrides: Record<string, string>;
  value: StarterPrompt;
  onChange: (next: StarterPrompt) => void;
}) {
  const [nextField, setNextField] = useState(selectedFields[0] ?? "");
  const rows = Object.entries(overrides).filter(([field]) =>
    selectedFields.includes(field),
  );
  const available = selectedFields.filter((field) => !(field in overrides));
  const selectedNextField = available.includes(nextField)
    ? nextField
    : (available[0] ?? "");

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Field label overrides">
          <Select
            value={selectedNextField}
            onChange={(e) => setNextField(e.target.value)}
            disabled={available.length === 0}
          >
            {available.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </Select>
        </Field>
        <GhostButton
          disabled={!selectedNextField || selectedNextField in overrides}
          onClick={() =>
            onChange(
              setLabelOverride(
                value,
                selectedNextField,
                FIELD_META[selectedNextField]?.label ??
                  humaniseCaptureField(selectedNextField),
              ),
            )
          }
        >
          Add override
        </GhostButton>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map(([field, label]) => (
            <div key={field} className="grid gap-2 sm:grid-cols-[12rem,1fr,auto]">
              <TextInput value={field} disabled />
              <TextInput
                value={label}
                onChange={(e) =>
                  onChange(setLabelOverride(value, field, e.target.value))
                }
              />
              <DangerButton
                onClick={() => onChange(setLabelOverride(value, field, ""))}
              >
                Remove
              </DangerButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomEmbedEditor({
  value,
  onChange,
}: {
  value: StarterPrompt;
  onChange: (next: StarterPrompt) => void;
}) {
  const next = withActionType(value, "custom_embed");
  if (next.action?.type !== "custom_embed") return null;
  const action = next.action;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[12rem,1fr]">
        <Field label="Kind">
          <Select value={action.kind} onChange={() => undefined}>
            <option value="iframe">Iframe</option>
            <option value="script" disabled>
              Script, coming soon
            </option>
          </Select>
        </Field>
        <Field label="URL" hint="Must use https://">
          <TextInput
            value={action.url}
            onChange={(e) =>
              onChange({
                ...value,
                action: { ...action, url: e.target.value },
              })
            }
            placeholder="https://booking.example.com/form"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[12rem,1fr]">
        <Field label="Height" hint="240-900 px.">
          <TextInput
            type="number"
            min={240}
            max={900}
            value={action.height ?? 520}
            onChange={(e) =>
              onChange({
                ...value,
                action: {
                  ...action,
                  height: Number.parseInt(e.target.value, 10) || 520,
                },
              })
            }
          />
        </Field>
        <Field
          label="Allow attributes"
          hint="Only add if the booking provider requires camera/microphone/etc."
        >
          <TextInput
            value={action.allow ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                action: { ...action, allow: e.target.value },
              })
            }
            placeholder=""
          />
        </Field>
      </div>

      {isHttpsUrl(action.url) ? (
        <iframe
          title={`${value.label || "Starter pill"} embed preview`}
          src={action.url}
          height={Math.min(action.height ?? 520, 360)}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allow={action.allow}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
          Enter a valid https:// URL to preview the embed.
        </div>
      )}
    </div>
  );
}

function PillPreview({ value }: { value: StarterPrompt }) {
  const [open, setOpen] = useState(false);
  const actionType = actionTypeFor(value);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium text-zinc-900">Preview</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:border-[#FF6B2C]"
      >
        <span aria-hidden="true">{value.emoji || "💬"}</span>
        <span className="truncate">{value.label || "Starter pill"}</span>
      </button>
      {open && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          {actionType === "chat" && (
            <p className="text-sm text-zinc-700">
              {value.prompt || "Chat prompt appears here."}
            </p>
          )}
          {actionType === "lead_capture" && <LeadCapturePreview value={value} />}
          {actionType === "custom_embed" && <EmbedPreview value={value} />}
        </div>
      )}
    </div>
  );
}

function LeadCapturePreview({ value }: { value: StarterPrompt }) {
  const next = withActionType(value, "lead_capture");
  if (next.action?.type !== "lead_capture") return null;
  const policy = next.action.capture_policy;
  const overrides = next.action.field_label_overrides ?? {};
  const fields = [
    ...policy.required_fields.map((field) => ({ field, required: true })),
    ...policy.optional_fields.map((field) => ({ field, required: false })),
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">{policy.privacy_notice}</p>
      {fields.map(({ field, required }) => (
        <label key={field} className="block">
          <span className="text-xs font-medium text-zinc-700">
            {overrides[field] ??
              FIELD_META[field]?.label ??
              `${humaniseCaptureField(field)}?`}
            {required ? " *" : ""}
          </span>
          <input
            disabled
            className="mt-1 block w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs"
            placeholder={FIELD_META[field]?.placeholder ?? humaniseCaptureField(field)}
          />
        </label>
      ))}
    </div>
  );
}

function EmbedPreview({ value }: { value: StarterPrompt }) {
  const next = withActionType(value, "custom_embed");
  if (next.action?.type !== "custom_embed") return null;
  if (!isHttpsUrl(next.action.url)) {
    return <p className="text-sm text-zinc-500">No valid embed URL yet.</p>;
  }
  return (
    <iframe
      title={`${value.label || "Starter pill"} embed action preview`}
      src={next.action.url}
      height={Math.min(next.action.height ?? 520, 260)}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
      allow={next.action.allow}
      className="w-full rounded-lg border border-zinc-200 bg-white"
    />
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
