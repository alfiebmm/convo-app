"use client";

import { useState, useMemo } from "react";
import {
  followUpSchema,
  type FollowUp,
  type ContactMethod,
  type CapturePolicy,
  type FollowUpRule,
  type Destination,
} from "@/lib/forum-config/schema";
import { saveSlice } from "../types";
import {
  Field,
  GhostButton,
  DangerButton,
  PanelCard,
  PanelHeader,
  SaveBar,
  Select,
  SubSection,
  TextArea,
  TextInput,
  ChipInput,
} from "../ui";

const DEFAULT_FOLLOW_UP: FollowUp = {
  enabled: true,
  default_sensitivity: "balanced",
  allow_staff_review_flags_without_visitor_interruption: true,
  persona_source: "qualifying",
  contact_methods: [],
  capture_policies: [],
  rules: [],
  destinations: [],
};

function normalise(initial: unknown): FollowUp {
  const parsed = followUpSchema.safeParse(initial);
  return parsed.success ? parsed.data : DEFAULT_FOLLOW_UP;
}

export function FollowUpPanel({
  initialValue,
  onSaved,
}: {
  initialValue: unknown;
  onSaved: (value: FollowUp) => void;
}) {
  const initial = useMemo(() => normalise(initialValue), [initialValue]);
  const [value, setValue] = useState<FollowUp>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(initial) !== JSON.stringify(value);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const local = followUpSchema.safeParse(value);
    if (!local.success) {
      const first = local.error.issues[0];
      setError(
        first
          ? `${first.path.join(".") || "follow_up"}: ${first.message}`
          : "Invalid follow-up config.",
      );
      setSaving(false);
      return;
    }

    const res = await saveSlice("follow_up", local.data);
    setSaving(false);
    if (!res.ok) {
      let detail = res.error;
      if (res.issues && typeof res.issues === "object") {
        // Server returned per-slice issues; surface the first one.
        const fu = (res.issues as Record<string, unknown>).follow_up;
        if (Array.isArray(fu) && fu.length > 0) {
          const i = fu[0] as { path?: unknown[]; message?: string };
          detail = `${(i.path ?? []).join(".") || "follow_up"}: ${i.message ?? "invalid"}`;
        }
      }
      setError(detail);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved(local.data);
  }

  return (
    <PanelCard>
      <PanelHeader
        title="Follow-up"
        description="The full follow-up policy: when to escalate, when to capture details, where qualified leads go."
      />

      <div className="space-y-5">
        <SubSection title="Defaults">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Enabled"
              hint="Master switch. Off → bot never triggers any follow-up rule."
            >
              <Select
                value={value.enabled ? "true" : "false"}
                onChange={(e) =>
                  setValue({ ...value, enabled: e.target.value === "true" })
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Select>
            </Field>
            <Field
              label="Default sensitivity"
              hint="How eager the bot is to escalate or capture by default."
            >
              <Select
                value={value.default_sensitivity}
                onChange={(e) =>
                  setValue({
                    ...value,
                    default_sensitivity: e.target
                      .value as FollowUp["default_sensitivity"],
                  })
                }
              >
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="proactive">Proactive</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Silent staff-review flagging"
              hint="If on, the bot can flag a conversation for staff review without interrupting the visitor."
            >
              <Select
                value={
                  value.allow_staff_review_flags_without_visitor_interruption
                    ? "true"
                    : "false"
                }
                onChange={(e) =>
                  setValue({
                    ...value,
                    allow_staff_review_flags_without_visitor_interruption:
                      e.target.value === "true",
                  })
                }
              >
                <option value="true">Allowed</option>
                <option value="false">Disallowed</option>
              </Select>
            </Field>
            <Field
              label="Persona source"
              hint="Where the bot's view of the visitor comes from. V1 only supports qualifying answers."
            >
              <Select value={value.persona_source} disabled>
                <option value="qualifying">Qualifying answers</option>
              </Select>
            </Field>
          </div>
        </SubSection>

        <ContactMethodsEditor
          value={value.contact_methods}
          onChange={(contact_methods) =>
            setValue({ ...value, contact_methods })
          }
        />

        <CapturePoliciesEditor
          value={value.capture_policies}
          onChange={(capture_policies) =>
            setValue({ ...value, capture_policies })
          }
        />

        <RulesEditor
          value={value.rules}
          contactMethods={value.contact_methods}
          capturePolicies={value.capture_policies}
          onChange={(rules) => setValue({ ...value, rules })}
        />

        <DestinationsEditor
          value={value.destinations}
          onChange={(destinations) => setValue({ ...value, destinations })}
        />
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

// ─── Contact methods ───────────────────────────────────────

function ContactMethodsEditor({
  value,
  onChange,
}: {
  value: ContactMethod[];
  onChange: (v: ContactMethod[]) => void;
}) {
  return (
    <SubSection
      title="Contact methods"
      description="The approved ways the bot may refer a visitor to a human (email, phone, callback, URL, form)."
      action={
        <GhostButton
          onClick={() =>
            onChange([
              ...value,
              {
                id: "",
                type: "email",
                label: "",
                value: "",
                available_for: ["cx_support"],
              } as ContactMethod,
            ])
          }
        >
          + Add contact method
        </GhostButton>
      }
    >
      {value.length === 0 ? (
        <p className="text-sm text-zinc-500">No contact methods yet.</p>
      ) : (
        value.map((cm, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Method {i + 1}
              </p>
              <DangerButton
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Remove
              </DangerButton>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="ID" hint="Short unique key (e.g. sales_email).">
                <TextInput
                  value={cm.id}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...cm, id: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Label" hint="Shown to the visitor.">
                <TextInput
                  value={cm.label}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...cm, label: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={cm.type}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...cm,
                      type: e.target.value as ContactMethod["type"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="callback">Callback</option>
                  <option value="url">URL</option>
                  <option value="form">Form</option>
                </Select>
              </Field>
              <Field
                label={cm.type === "url" || cm.type === "form" ? "URL" : "Value"}
                hint={
                  cm.type === "url" || cm.type === "form"
                    ? "Required for url/form types."
                    : cm.type === "email" || cm.type === "phone"
                      ? "Required for email/phone types."
                      : "Optional for callback."
                }
              >
                {cm.type === "url" || cm.type === "form" ? (
                  <TextInput
                    value={cm.url ?? ""}
                    onChange={(e) => {
                      const next = [...value];
                      next[i] = { ...cm, url: e.target.value };
                      onChange(next);
                    }}
                    placeholder="https://…"
                  />
                ) : (
                  <TextInput
                    value={cm.value ?? ""}
                    onChange={(e) => {
                      const next = [...value];
                      next[i] = { ...cm, value: e.target.value };
                      onChange(next);
                    }}
                  />
                )}
              </Field>
            </div>
            <div className="mt-3">
              <Field
                label="Available for"
                hint="Which case types this method is offered for."
              >
                <div className="flex gap-3">
                  {(["cx_support", "lead"] as const).map((ct) => (
                    <label
                      key={ct}
                      className="inline-flex items-center gap-2 text-sm text-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={cm.available_for.includes(ct)}
                        onChange={(e) => {
                          const next = [...value];
                          const set = new Set(cm.available_for);
                          if (e.target.checked) set.add(ct);
                          else set.delete(ct);
                          next[i] = {
                            ...cm,
                            available_for: Array.from(set) as ContactMethod["available_for"],
                          };
                          onChange(next);
                        }}
                      />
                      {ct}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        ))
      )}
    </SubSection>
  );
}

// ─── Capture policies ──────────────────────────────────────

function CapturePoliciesEditor({
  value,
  onChange,
}: {
  value: CapturePolicy[];
  onChange: (v: CapturePolicy[]) => void;
}) {
  return (
    <SubSection
      title="Capture policies"
      description="What the chatbot may collect from a visitor and how it must be disclosed."
      action={
        <GhostButton
          onClick={() =>
            onChange([
              ...value,
              {
                id: "",
                case_type: "lead",
                required_fields: [],
                optional_fields: [],
                privacy_notice: "",
                privacy_policy_url: "",
              } as CapturePolicy,
            ])
          }
        >
          + Add policy
        </GhostButton>
      }
    >
      {value.length === 0 ? (
        <p className="text-sm text-zinc-500">No capture policies yet.</p>
      ) : (
        value.map((p, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Policy {i + 1}
              </p>
              <DangerButton
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Remove
              </DangerButton>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="ID" hint="Short unique key (e.g. lead_basic).">
                <TextInput
                  value={p.id}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...p, id: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Case type">
                <Select
                  value={p.case_type}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...p,
                      case_type: e.target.value as CapturePolicy["case_type"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="cx_support">CX support</option>
                  <option value="lead">Lead</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Required fields"
                hint="e.g. name, email, mobile, postcode."
              >
                <ChipInput
                  values={p.required_fields as string[]}
                  onChange={(required_fields) => {
                    const next = [...value];
                    next[i] = { ...p, required_fields };
                    onChange(next);
                  }}
                  placeholder="Add a field and press Enter"
                />
              </Field>
              <Field label="Optional fields" hint="Collected if offered.">
                <ChipInput
                  values={p.optional_fields as string[]}
                  onChange={(optional_fields) => {
                    const next = [...value];
                    next[i] = { ...p, optional_fields };
                    onChange(next);
                  }}
                  placeholder="Add a field and press Enter"
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field
                label="Privacy notice"
                hint="Shown to the visitor before capture starts."
              >
                <TextArea
                  rows={2}
                  value={p.privacy_notice}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...p, privacy_notice: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Privacy policy URL">
                <TextInput
                  value={p.privacy_policy_url}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...p, privacy_policy_url: e.target.value };
                    onChange(next);
                  }}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </div>
        ))
      )}
    </SubSection>
  );
}

// ─── Rules ─────────────────────────────────────────────────

function RulesEditor({
  value,
  contactMethods,
  capturePolicies,
  onChange,
}: {
  value: FollowUpRule[];
  contactMethods: ContactMethod[];
  capturePolicies: CapturePolicy[];
  onChange: (v: FollowUpRule[]) => void;
}) {
  return (
    <SubSection
      title="Rules"
      description="When the bot triggers a follow-up action and what action to take. Evaluated in priority order at runtime."
      action={
        <GhostButton
          onClick={() =>
            onChange([
              ...value,
              {
                id: "",
                name: "",
                case_type: "lead",
                enabled: true,
                priority: "normal",
                confidence_threshold: 0.7,
                when: {},
                action: "offer_follow_up",
                routing_key: "",
              } as FollowUpRule,
            ])
          }
        >
          + Add rule
        </GhostButton>
      }
    >
      {value.length === 0 ? (
        <p className="text-sm text-zinc-500">No rules yet.</p>
      ) : (
        value.map((r, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Rule {i + 1}
              </p>
              <DangerButton
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Remove
              </DangerButton>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="ID" hint="Short unique key.">
                <TextInput
                  value={r.id}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...r, id: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Name" hint="Human-readable label.">
                <TextInput
                  value={r.name}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...r, name: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Case type">
                <Select
                  value={r.case_type}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...r,
                      case_type: e.target.value as FollowUpRule["case_type"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="cx_support">CX support</option>
                  <option value="lead">Lead</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={r.priority}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...r,
                      priority: e.target.value as FollowUpRule["priority"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </Field>
              <Field label="Action">
                <Select
                  value={r.action}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...r,
                      action: e.target.value as FollowUpRule["action"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="continue_helping">Continue helping</option>
                  <option value="clarify_then_recheck">
                    Clarify then recheck
                  </option>
                  <option value="offer_follow_up">Offer follow-up</option>
                  <option value="refer_to_approved_contact_method">
                    Refer to contact method
                  </option>
                  <option value="capture_details_then_flag">
                    Capture details then flag
                  </option>
                  <option value="flag_for_staff_review_without_interrupting_visitor">
                    Silent staff review flag
                  </option>
                  <option value="immediate_escalation">
                    Immediate escalation
                  </option>
                </Select>
              </Field>
              <Field
                label="Confidence threshold"
                hint="0–1. Bot only triggers if classifier confidence ≥ this."
              >
                <TextInput
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1}
                  step={0.05}
                  value={String(r.confidence_threshold)}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...r,
                      confidence_threshold:
                        Number(e.target.value) || 0,
                    };
                    onChange(next);
                  }}
                />
              </Field>
              <Field
                label="Routing key"
                hint="Identifier used by destinations to filter which cases go where."
              >
                <TextInput
                  value={r.routing_key}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...r, routing_key: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field
                label="Offer title"
                hint="(offer_follow_up only) Text shown to the visitor on the offer button."
              >
                <TextInput
                  value={r.offer_title ?? ""}
                  onChange={(e) => {
                    const next = [...value];
                    const v = e.target.value;
                    next[i] = { ...r, offer_title: v || undefined };
                    onChange(next);
                  }}
                />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Capture policy"
                hint="Required for offer_follow_up / capture_details_then_flag."
              >
                <Select
                  value={r.capture_policy_id ?? ""}
                  onChange={(e) => {
                    const next = [...value];
                    const v = e.target.value;
                    next[i] = {
                      ...r,
                      capture_policy_id: v || undefined,
                    };
                    onChange(next);
                  }}
                >
                  <option value="">— none —</option>
                  {capturePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id || "(unnamed)"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Contact method"
                hint="Required for refer_to_approved_contact_method."
              >
                <Select
                  value={r.contact_method_id ?? ""}
                  onChange={(e) => {
                    const next = [...value];
                    const v = e.target.value;
                    next[i] = {
                      ...r,
                      contact_method_id: v || undefined,
                    };
                    onChange(next);
                  }}
                >
                  <option value="">— none —</option>
                  {contactMethods.map((cm) => (
                    <option key={cm.id} value={cm.id}>
                      {cm.id || "(unnamed)"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field
                label="Enabled"
                hint="Toggle off to keep the rule but skip it at runtime."
              >
                <Select
                  value={r.enabled ? "true" : "false"}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...r, enabled: e.target.value === "true" };
                    onChange(next);
                  }}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </Field>
            </div>
          </div>
        ))
      )}
    </SubSection>
  );
}

// ─── Destinations ──────────────────────────────────────────

function DestinationsEditor({
  value,
  onChange,
}: {
  value: Destination[];
  onChange: (v: Destination[]) => void;
}) {
  return (
    <SubSection
      title="Destinations"
      description="Where captured cases are pushed (webhook or CSV export). Filtered by routing_key match against rules."
      action={
        <GhostButton
          onClick={() =>
            onChange([
              ...value,
              {
                id: "",
                case_type: "lead",
                connector: "webhook",
                routing_key: "",
                config: {},
              } as Destination,
            ])
          }
        >
          + Add destination
        </GhostButton>
      }
    >
      {value.length === 0 ? (
        <p className="text-sm text-zinc-500">No destinations yet.</p>
      ) : (
        value.map((d, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Destination {i + 1}
              </p>
              <DangerButton
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                Remove
              </DangerButton>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="ID">
                <TextInput
                  value={d.id}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...d, id: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
              <Field label="Case type">
                <Select
                  value={d.case_type}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...d,
                      case_type: e.target.value as Destination["case_type"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="cx_support">CX support</option>
                  <option value="lead">Lead</option>
                </Select>
              </Field>
              <Field label="Connector">
                <Select
                  value={d.connector}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = {
                      ...d,
                      connector: e.target.value as Destination["connector"],
                    };
                    onChange(next);
                  }}
                >
                  <option value="webhook">Webhook</option>
                  <option value="csv_export">CSV export</option>
                </Select>
              </Field>
              <Field label="Routing key">
                <TextInput
                  value={d.routing_key}
                  onChange={(e) => {
                    const next = [...value];
                    next[i] = { ...d, routing_key: e.target.value };
                    onChange(next);
                  }}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field
                label="Config (JSON)"
                hint="Connector-specific config — e.g. webhook URL + headers. Free-form JSON object."
              >
                <ConfigJsonEditor
                  value={d.config ?? {}}
                  onChange={(config) => {
                    const next = [...value];
                    next[i] = { ...d, config };
                    onChange(next);
                  }}
                />
              </Field>
            </div>
          </div>
        ))
      )}
    </SubSection>
  );
}

function ConfigJsonEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState<string>(() =>
    JSON.stringify(value ?? {}, null, 2),
  );
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <TextArea
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value || "{}");
            if (
              typeof parsed === "object" &&
              parsed !== null &&
              !Array.isArray(parsed)
            ) {
              setErr(null);
              onChange(parsed as Record<string, unknown>);
            } else {
              setErr("Config must be a JSON object.");
            }
          } catch {
            setErr("Invalid JSON.");
          }
        }}
        placeholder='{"webhook_url": "https://…"}'
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
