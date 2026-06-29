"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Field,
  PanelCard,
  PanelHeader,
  SaveBar,
  Select,
  TextArea,
  TextInput,
} from "../ui";

import { saveQuickSetup } from "./actions";
import { QuickSetupPreview } from "./quick-setup-preview";
import {
  quickSetupInputSchema,
  type QuickSetupInput,
  type QuickSetupPreset,
} from "./quick-setup";

type CaptureField = QuickSetupInput["capture_fields"][number];
type IssueMap = Record<string, string>;

const CAPTURE_FIELDS: { value: CaptureField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "mobile", label: "Mobile" },
  { value: "postcode", label: "Postcode" },
  { value: "free_text_note", label: "Short note" },
];

const PRESETS: { value: QuickSetupPreset; label: string; description: string }[] =
  [
    {
      value: "high_intent_buyers",
      label: "High-intent buyers",
      description: "Quote requests and availability checks become lead cases.",
    },
    {
      value: "support_requests",
      label: "Support requests",
      description: "Support requests are offered human follow-up.",
    },
    {
      value: "both",
      label: "Both",
      description: "Lead and support triggers are configured together.",
    },
  ];

export function QuickSetupForm({
  initialValue,
}: {
  initialValue: QuickSetupInput;
}) {
  const router = useRouter();
  const [value, setValue] = useState<QuickSetupInput>(initialValue);
  const [lastSavedValue, setLastSavedValue] =
    useState<QuickSetupInput>(initialValue);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueMap>({});
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(
    () => JSON.stringify(value) !== JSON.stringify(lastSavedValue),
    [lastSavedValue, value],
  );

  function handleSave() {
    setSaved(false);
    setError(null);
    setIssues({});

    const local = quickSetupInputSchema.safeParse(value);
    if (!local.success) {
      setError("Fix the highlighted fields before saving.");
      setIssues(issuesFromZod(local.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await saveQuickSetup(local.data);
      if (!result.ok) {
        setError(result.error);
        if (result.issues) setIssues(issuesFromServer(result.issues));
        return;
      }
      setLastSavedValue(local.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.replace("/dashboard/settings/forum-config?tab=follow-up&mode=quick");
      router.refresh();
    });
  }

  return (
    <PanelCard>
      <PanelHeader
        title="Quick setup"
        description="Configure the required follow-up surfaces without editing the full forumConfig shape."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Voice</h3>
            <Field
              label="Voice description"
              hint="How the bot should sound when it speaks for this tenant."
              error={issues.voice_description}
            >
              <TextArea
                rows={4}
                value={value.voice_description}
                onChange={(event) =>
                  setValue({
                    ...value,
                    voice_description: event.target.value,
                  })
                }
              />
            </Field>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Persona question
            </h3>
            <Field
              label="Question"
              error={
                issues["persona_question.question"] ??
                issues.persona_question
              }
            >
              <TextInput
                value={value.persona_question.question}
                onChange={(event) =>
                  setValue({
                    ...value,
                    persona_question: {
                      ...value.persona_question,
                      question: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <div className="space-y-3">
              {value.persona_question.options.map((option, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <Field
                    label={`Option ${index + 1} label`}
                    error={
                      issues[`persona_question.options.${index}.label`]
                    }
                  >
                    <TextInput
                      value={option.label}
                      onChange={(event) =>
                        updateOption(index, "label", event.target.value)
                      }
                    />
                  </Field>
                  <Field
                    label={`Option ${index + 1} value`}
                    error={
                      issues[`persona_question.options.${index}.value`]
                    }
                  >
                    <TextInput
                      value={option.value}
                      onChange={(event) =>
                        updateOption(index, "value", event.target.value)
                      }
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={value.persona_question.options.length <= 2}
                      onClick={() => {
                        setValue({
                          ...value,
                          persona_question: {
                            ...value.persona_question,
                            options: value.persona_question.options.filter(
                              (_, optionIndex) => optionIndex !== index,
                            ),
                          },
                        });
                      }}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={value.persona_question.options.length >= 5}
                onClick={() =>
                  setValue({
                    ...value,
                    persona_question: {
                      ...value.persona_question,
                      options: [
                        ...value.persona_question.options,
                        { label: "", value: "" },
                      ],
                    },
                  })
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add option
              </button>
              {issues["persona_question.options"] && (
                <p className="text-xs text-red-600" role="alert">
                  {issues["persona_question.options"]}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Allowed topics
            </h3>
            <ChipEditor
              values={value.allowed_topics}
              onChange={(allowed_topics) =>
                setValue({ ...value, allowed_topics })
              }
              placeholder="Add a topic and press Enter"
            />
            {issues.allowed_topics && (
              <p className="text-xs text-red-600" role="alert">
                {issues.allowed_topics}
              </p>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Lead capture rule
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {PRESETS.map((preset) => (
                <label
                  key={preset.value}
                  className={
                    "rounded-lg border p-4 text-sm transition-colors " +
                    (value.preset === preset.value
                      ? "border-[#FF6B2C] bg-[#FF6B2C]/5"
                      : "border-zinc-200 bg-white hover:border-zinc-300")
                  }
                >
                  <input
                    type="radio"
                    name="quick-preset"
                    className="sr-only"
                    checked={value.preset === preset.value}
                    onChange={() =>
                      setValue({ ...value, preset: preset.value })
                    }
                  />
                  <span className="font-semibold text-zinc-900">
                    {preset.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    {preset.description}
                  </span>
                </label>
              ))}
            </div>

            <Field
              label="Capture fields"
              hint="Details the bot asks for before routing the follow-up."
              error={issues.capture_fields}
            >
              <div className="flex flex-wrap gap-3">
                {CAPTURE_FIELDS.map((field) => (
                  <label
                    key={field.value}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  >
                    <input
                      type="checkbox"
                      checked={value.capture_fields.includes(field.value)}
                      onChange={(event) => {
                        const fields = new Set(value.capture_fields);
                        if (event.target.checked) fields.add(field.value);
                        else fields.delete(field.value);
                        setValue({
                          ...value,
                          capture_fields: Array.from(fields),
                        });
                      }}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
              <Field label="Destination type">
                <Select
                  value={value.destination.type}
                  onChange={(event) => {
                    setValue({
                      ...value,
                      destination:
                        event.target.value === "email"
                          ? { type: "email", email: "" }
                          : { type: "webhook", url: "" },
                    });
                  }}
                >
                  <option value="webhook">Webhook URL</option>
                  <option value="email">Email</option>
                </Select>
              </Field>
              {value.destination.type === "webhook" ? (
                <Field
                  label="Webhook URL"
                  error={
                    issues["destination.url"] ?? issues.destination
                  }
                >
                  <TextInput
                    value={value.destination.url}
                    onChange={(event) =>
                      setValue({
                        ...value,
                        destination: {
                          type: "webhook",
                          url: event.target.value,
                        },
                      })
                    }
                    placeholder="https://hooks.example.com.au/leads"
                  />
                </Field>
              ) : (
                <Field
                  label="Email address"
                  error={
                    issues["destination.email"] ?? issues.destination
                  }
                >
                  <TextInput
                    value={value.destination.email}
                    onChange={(event) =>
                      setValue({
                        ...value,
                        destination: {
                          type: "email",
                          email: event.target.value,
                        },
                      })
                    }
                    placeholder="support@example.com.au"
                  />
                </Field>
              )}
            </div>

            <Field
              label="Privacy notice"
              hint="Shown before the visitor shares details."
              error={issues.privacy_notice}
            >
              <TextArea
                rows={3}
                value={value.privacy_notice}
                onChange={(event) =>
                  setValue({ ...value, privacy_notice: event.target.value })
                }
              />
            </Field>

            <Field
              label="Privacy policy URL"
              error={issues.privacy_policy_url}
            >
              <TextInput
                value={value.privacy_policy_url}
                onChange={(event) =>
                  setValue({
                    ...value,
                    privacy_policy_url: event.target.value,
                  })
                }
                placeholder="https://example.com.au/privacy"
              />
            </Field>
          </section>
        </div>

        <QuickSetupPreview value={value} />
      </div>

      <SaveBar
        saving={isPending}
        saved={saved}
        error={error}
        dirty={dirty}
        onSave={handleSave}
        onReset={() => {
          setValue(lastSavedValue);
          setError(null);
          setIssues({});
        }}
      />
    </PanelCard>
  );

  function updateOption(
    index: number,
    key: "label" | "value",
    nextValue: string,
  ) {
    setValue({
      ...value,
      persona_question: {
        ...value.persona_question,
        options: value.persona_question.options.map((option, optionIndex) =>
          optionIndex === index ? { ...option, [key]: nextValue } : option,
        ),
      },
    });
  }
}

function ChipEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((topic, index) => (
          <span
            key={`${topic}-${index}`}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-900"
          >
            {topic}
            <button
              type="button"
              aria-label={`Remove ${topic}`}
              onClick={() =>
                onChange(values.filter((_, topicIndex) => topicIndex !== index))
              }
              className="text-zinc-500 hover:text-red-600"
            >
              x
            </button>
          </span>
        ))}
      </div>
      <TextInput
        className="mt-2"
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const input = event.currentTarget;
          const topic = input.value.trim();
          if (topic && !values.includes(topic)) onChange([...values, topic]);
          input.value = "";
        }}
      />
    </div>
  );
}

function issuesFromZod(
  zodIssues: { path: PropertyKey[]; message: string }[],
): IssueMap {
  return Object.fromEntries(
    zodIssues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

function issuesFromServer(
  serverIssues: { path: string; message: string }[],
): IssueMap {
  return Object.fromEntries(
    serverIssues.map((issue) => [issue.path, issue.message]),
  );
}
