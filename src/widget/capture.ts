/**
 * Convo widget — progressive contact capture (CON-170 / D2b, Epic D2).
 *
 * Drives the post-offer (or direct, for `capture_details_then_flag`)
 * contact-capture flow inside the widget's Shadow DOM. The visitor sees
 * all configured fields at once, can submit / decline at any point, and
 * each interaction round-trips to `POST /api/cases/:caseId/capture`.
 *
 * Locked invariants (PRD §10):
 *   1. Decline is first-class — visitor can always end the flow without
 *      handing over identifiers.
 *   2. Optional fields are blank-is-skip — the visitor can leave them
 *      empty without abandoning the whole flow.
 *   3. Server is source of truth — client-side validation is light + fast
 *      for UX; the route re-validates and rejects bad values with 400.
 *   4. No PII echoed back into the transcript by default — visitor input
 *      is shown back to them as a one-line confirmation, but never
 *      mirrored verbatim into chat history (avoids logging surface).
 *
 * Shadow DOM strategy:
 *   This module is statically imported from `src/widget/index.ts` and
 *   bundled into the single-file widget. It mounts itself into the
 *   existing chat panel via a `mount` element passed by `index.ts`, so
 *   we never open a second shadow root and the CSS minify plugin in
 *   `scripts/build-widget.mjs` keeps owning the styles (which live in
 *   `getStyles()` in `index.ts`, prefixed `convo-cap-`).
 *
 * NB: Field-key registry mirrors `fieldKeySchema` /
 * `validateCaptureField` in
 * `src/app/api/cases/[caseId]/capture/route.ts`. Keep the two in sync;
 * the server is authoritative.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * SSE `case` event subset the capture flow needs. The widget's
 * top-level event handler passes the full event in — we narrow here so
 * unrelated case fields can evolve without rippling into this module.
 */
export interface CaptureCaseInfo {
  case_id: string;
  action: string;
  capture_policy?: CapturePolicySpec;
  capture_policy_id?: string;
  offer_title?: string;
}

export interface CapturePolicySpec {
  id: string;
  case_type: "cx_support" | "lead";
  required_fields: string[];
  optional_fields: string[];
  privacy_notice: string;
  privacy_policy_url: string;
}

export interface CaptureFlowConfig {
  apiBase: string;
  tenantId: string;
  visitorId: string;
  conversationId: string;
  /** Tenant brand colour for primary button. */
  primaryColor: string;
}

/**
 * Field-level prefill hint. Populated by the host page from the
 * conversation's qualifying persona where the keys overlap (e.g. the
 * persona collected an email earlier, we offer to re-use it). Empty by
 * default — D2 V1 does not auto-fetch qualifying state; the caller
 * supplies what it already has.
 */
export type CapturePrefill = Partial<Record<string, string>>;
export type CaptureFieldLabelOverrides = Record<string, string>;

/**
 * Outcome callback. Fires once the flow leaves the screen (declined or
 * all fields handled). Used by `index.ts` to close out the transcript
 * with a confirmation message.
 */
export type CaptureFlowDone = (outcome: CaptureFlowOutcome) => void;

export interface CaptureFlowOutcome {
  status: "completed" | "declined";
  /** Field keys the visitor actually submitted (excludes skip/decline). */
  submittedFields: string[];
  /** Field keys the visitor skipped (optional fields they didn't fill). */
  skippedFields: string[];
}

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

/**
 * Visitor-facing prompt + input hints for each canonical field key.
 * Australian English, no exclamation marks, brand-system voice
 * ("confident-but-specific, outcomes-first").
 *
 * Custom tenant field keys fall through to a generic text prompt — the
 * server accepts them as opaque attributes.
 */
const FIELD_META: Record<
  string,
  { label: string; inputType: string; autocomplete: string; placeholder: string }
> = {
  name: {
    label: "What's your name?",
    inputType: "text",
    autocomplete: "name",
    placeholder: "Your name",
  },
  email: {
    label: "What's the best email to reach you on?",
    inputType: "email",
    autocomplete: "email",
    placeholder: "you@example.com",
  },
  mobile: {
    label: "What's the best phone number to reach you on?",
    inputType: "tel",
    autocomplete: "tel",
    placeholder: "0400 000 000",
  },
  postcode: {
    label: "What's your postcode?",
    inputType: "text",
    autocomplete: "postal-code",
    placeholder: "2000",
  },
  free_text_note: {
    label: "Anything else our team should know?",
    inputType: "text",
    autocomplete: "off",
    placeholder: "Optional note",
  },
  suburb: {
    label: "What suburb are you in?",
    inputType: "text",
    autocomplete: "address-level2",
    placeholder: "Suburb",
  },
  state: {
    label: "Which state are you in?",
    inputType: "text",
    autocomplete: "address-level1",
    placeholder: "NSW",
  },
  company: {
    label: "What's your company name?",
    inputType: "text",
    autocomplete: "organization",
    placeholder: "Company",
  },
  preferred_contact_method: {
    label: "How would you prefer we contact you?",
    inputType: "text",
    autocomplete: "off",
    placeholder: "Email or phone",
  },
};

function metaForField(
  field: string,
  labelOverrides?: CaptureFieldLabelOverrides,
): (typeof FIELD_META)[string] {
  const override = labelOverrides?.[field]?.trim();
  if (FIELD_META[field]) {
    return override
      ? { ...FIELD_META[field], label: override }
      : FIELD_META[field];
  }
  // Custom tenant field — friendly default. The forum-config schema
  // requires the key to be a non-empty string, so we humanise it.
  const label = humanise(field);
  return {
    label: override || `${label}?`,
    inputType: "text",
    autocomplete: "off",
    placeholder: label,
  };
}

function humanise(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Pure validators (mirror server-side `validateCaptureField`)
// ---------------------------------------------------------------------------

/**
 * Light client-side check. The server route re-validates with the same
 * rules — never relax this without updating
 * `src/app/api/cases/[caseId]/capture/route.ts` first.
 *
 * Exported so the widget unit tests can exercise the same surface.
 */
export function validateClientField(
  field: string,
  rawValue: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof rawValue !== "string") {
    return { ok: false, reason: "Please enter a value" };
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Please enter a value" };
  }
  if (trimmed.length > 4096) {
    return { ok: false, reason: "That looks too long, please shorten it" };
  }

  switch (field) {
    case "name":
      return { ok: true, value: trimmed };
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.toLowerCase())) {
        return {
          ok: false,
          reason: "Please enter a valid email address",
        };
      }
      return { ok: true, value: trimmed.toLowerCase() };
    }
    case "mobile": {
      const digits = trimmed.replace(/[\s\-()]/g, "").replace(/^\+/, "");
      if (!/^\d{8,15}$/.test(digits)) {
        return {
          ok: false,
          reason: "Please enter a valid phone number",
        };
      }
      return { ok: true, value: trimmed };
    }
    case "postcode": {
      const cleaned = trimmed.replace(/\s+/g, "");
      if (!/^[A-Za-z0-9]{3,10}$/.test(cleaned)) {
        return {
          ok: false,
          reason: "Please enter a valid postcode",
        };
      }
      return { ok: true, value: cleaned };
    }
    default:
      return { ok: true, value: trimmed };
  }
}

// ---------------------------------------------------------------------------
// CaptureFlow
// ---------------------------------------------------------------------------

interface FieldSpec {
  key: string;
  required: boolean;
}

interface RenderedField {
  spec: FieldSpec;
  input: HTMLInputElement;
  error: HTMLDivElement;
}

/**
 * Drives the capture state machine for a single case. Owns ONE block
 * element appended to the messages container; replaces its contents
 * step-by-step as fields are processed.
 *
 * Lifecycle:
 *   start() → render privacy notice + all fields
 *   submit() → validate required fields, submit populated fields, skip blanks
 *   finish() → render a short ack and fire the `done` callback
 *
 * The block element is left in place after finish() so the transcript
 * keeps a visible trail of "we captured X" / "you declined" — the
 * caller may scroll past it, but it never disappears.
 */
export class CaptureFlow {
  private readonly mount: HTMLElement;
  private readonly caseInfo: CaptureCaseInfo;
  private readonly policy: CapturePolicySpec;
  private readonly cfg: CaptureFlowConfig;
  private readonly prefill: CapturePrefill;
  private readonly fieldLabelOverrides: CaptureFieldLabelOverrides;
  private readonly onDone: CaptureFlowDone;
  private readonly fields: FieldSpec[];
  private readonly submittedFields: string[] = [];
  private readonly skippedFields: string[] = [];

  private block: HTMLDivElement | null = null;
  /** Lock to debounce double-clicks (network in flight). */
  private busy = false;
  /** Set when the visitor declines — disables future advances. */
  private terminated = false;

  constructor(args: {
    mount: HTMLElement;
    caseInfo: CaptureCaseInfo;
    policy: CapturePolicySpec;
    config: CaptureFlowConfig;
    prefill?: CapturePrefill;
    fieldLabelOverrides?: CaptureFieldLabelOverrides;
    onDone: CaptureFlowDone;
  }) {
    this.mount = args.mount;
    this.caseInfo = args.caseInfo;
    this.policy = args.policy;
    this.cfg = args.config;
    this.prefill = args.prefill ?? {};
    this.fieldLabelOverrides = args.fieldLabelOverrides ?? {};
    this.onDone = args.onDone;

    // Required fields first, in policy order, then optional fields. We
    // never re-order within a tier — tenants who put `name` first in
    // `required_fields[]` get name first; if `email` is first they get
    // email first. Skip duplicates if the policy lists the same key in
    // both tiers (defensive — the schema doesn't forbid it).
    const seen = new Set<string>();
    const fields: FieldSpec[] = [];
    for (const k of this.policy.required_fields) {
      if (!seen.has(k)) {
        fields.push({ key: k, required: true });
        seen.add(k);
      }
    }
    for (const k of this.policy.optional_fields) {
      if (!seen.has(k)) {
        fields.push({ key: k, required: false });
        seen.add(k);
      }
    }
    this.fields = fields;
  }

  /** Mount the capture block and render the first prompt. */
  public start(): void {
    if (this.block) return; // already started
    if (this.fields.length === 0) {
      // Empty policy — pathological case, but don't crash. Treat as a
      // no-op completion so the caller can move on.
      this.onDone({
        status: "completed",
        submittedFields: [],
        skippedFields: [],
      });
      return;
    }

    const block = document.createElement("div");
    block.className = "convo-cap-block";
    block.setAttribute("role", "group");
    block.setAttribute("aria-label", "Contact capture");
    this.block = block;
    this.mount.appendChild(block);

    this.renderPrivacyHeader();
    this.renderFormOnce();
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private renderPrivacyHeader(): void {
    if (!this.block) return;
    const header = document.createElement("div");
    header.className = "convo-cap-privacy";

    const notice = document.createElement("div");
    notice.className = "convo-cap-privacy-text";
    notice.textContent = this.policy.privacy_notice;

    const link = document.createElement("a");
    link.className = "convo-cap-privacy-link";
    link.href = this.policy.privacy_policy_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Privacy policy";

    header.appendChild(notice);
    header.appendChild(link);
    this.block.appendChild(header);

    void this.postCapture({ action: "privacy_notice_shown" });
  }

  private renderFormOnce(): void {
    if (!this.block || this.terminated) return;

    const form = document.createElement("form");
    form.className = "convo-cap-step";
    form.setAttribute("novalidate", "novalidate");
    const renderedFields: RenderedField[] = [];

    for (const [index, spec] of this.fields.entries()) {
      const fieldWrap = document.createElement("div");
      fieldWrap.className = "convo-cap-step";
      const meta = metaForField(spec.key, this.fieldLabelOverrides);

      const label = document.createElement("label");
      label.className = "convo-cap-label";
      label.textContent = meta.label;
      if (spec.required) {
        const req = document.createElement("span");
        req.className = "convo-cap-required";
        req.textContent = " (required)";
        label.appendChild(req);
      }

      const inputRow = document.createElement("div");
      inputRow.className = "convo-cap-input-row";
      const input = document.createElement("input");
      input.className = "convo-cap-input";
      input.type = meta.inputType;
      // `autocomplete` is a typed enum on HTMLInputElement; the field meta
      // intentionally uses a plain string for ergonomics, so assign via
      // setAttribute to keep tsc happy across versions.
      input.setAttribute("autocomplete", meta.autocomplete);
      input.placeholder = meta.placeholder;
      input.setAttribute("aria-label", meta.label);
      const prefilled = this.prefill[spec.key];
      if (typeof prefilled === "string" && prefilled.trim().length > 0) {
        input.value = prefilled;
      }
      label.htmlFor = `convo-cap-input-${index}`;
      input.id = `convo-cap-input-${index}`;

      const error = document.createElement("div");
      error.className = "convo-cap-error";
      error.id = `convo-cap-error-${index}`;
      error.setAttribute("role", "alert");
      error.hidden = true;
      input.setAttribute("aria-describedby", error.id);

      inputRow.appendChild(input);
      fieldWrap.appendChild(label);
      fieldWrap.appendChild(inputRow);
      fieldWrap.appendChild(error);
      form.appendChild(fieldWrap);
      renderedFields.push({ spec, input, error });
    }

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "convo-cap-btn convo-cap-btn-primary";
    submitBtn.textContent = "Send";

    const actions = document.createElement("div");
    actions.className = "convo-cap-actions";
    actions.appendChild(submitBtn);

    const declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.className = "convo-cap-btn convo-cap-btn-text";
    declineBtn.textContent = "No thanks";
    declineBtn.addEventListener("click", () => {
      void this.decline(form);
    });
    actions.appendChild(declineBtn);

    form.appendChild(actions);
    this.block.appendChild(form);

    // Auto-focus the first input so the visitor can start typing immediately.
    // Defer so the element is in the DOM and the panel has scrolled.
    setTimeout(() => renderedFields[0]?.input.focus(), 30);

    const trySubmit = () => {
      void this.submitForm(renderedFields, form, submitBtn);
    };
    submitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      trySubmit();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      trySubmit();
    });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private async submitForm(
    renderedFields: RenderedField[],
    form: HTMLElement,
    submitBtn: HTMLButtonElement,
  ): Promise<void> {
    if (this.busy || this.terminated) return;

    const toSubmit: Array<{
      field: string;
      value: string;
      input: HTMLInputElement;
      error: HTMLDivElement;
    }> = [];
    const toSkip: string[] = [];
    let firstInvalid: HTMLInputElement | null = null;

    for (const { spec, input, error } of renderedFields) {
      const rawValue = input.value;
      if (!spec.required && rawValue.trim().length === 0) {
        error.hidden = true;
        error.textContent = "";
        toSkip.push(spec.key);
        continue;
      }

      const validation = validateClientField(spec.key, rawValue);
      if (!validation.ok) {
        error.textContent = validation.reason;
        error.hidden = false;
        firstInvalid ??= input;
        continue;
      }

      error.hidden = true;
      error.textContent = "";
      toSubmit.push({
        field: spec.key,
        value: validation.value,
        input,
        error,
      });
    }

    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.select();
      return;
    }

    this.busy = true;
    submitBtn.disabled = true;

    try {
      for (const item of toSubmit) {
        if (this.submittedFields.includes(item.field)) continue;

        const res = await this.postCapture({
          action: "submit",
          field: item.field,
          value: item.value,
        });

        if (!res || !res.ok) {
          // Server rejected — surface a polite message and let the
          // visitor retry. Don't expose internal error details.
          item.error.textContent =
            "We couldn't save that just now, please try again.";
          item.error.hidden = false;
          submitBtn.disabled = false;
          item.input.focus();
          return;
        }

        this.submittedFields.push(item.field);
      }

      for (const field of toSkip) {
        if (this.skippedFields.includes(field)) continue;

        await this.postCapture({ action: "skip", field });
        this.skippedFields.push(field);
      }

      this.replaceStepWithBreadcrumb(form, "Details received");
      this.finishCompleted();
    } catch {
      const firstField = renderedFields[0];
      if (firstField) {
        firstField.error.textContent =
          "We couldn't save that just now, please try again.";
        firstField.error.hidden = false;
        firstField.input.focus();
      }
      submitBtn.disabled = false;
    } finally {
      this.busy = false;
    }
  }

  private async decline(step: HTMLElement): Promise<void> {
    if (this.busy || this.terminated) return;
    this.terminated = true;
    this.busy = true;
    this.disableStep(step);

    try {
      await this.postCapture({ action: "decline" });
    } catch {
      // Audit miss — non-blocking. The visitor still sees the decline ack.
    } finally {
      this.busy = false;
    }

    this.replaceStepWithBreadcrumb(
      step,
      "No worries, we won't ask for any more details.",
    );
    this.onDone({
      status: "declined",
      submittedFields: [...this.submittedFields],
      skippedFields: [...this.skippedFields],
    });
  }

  private finishCompleted(): void {
    if (this.block) {
      const ack = document.createElement("div");
      ack.className = "convo-cap-final";
      ack.textContent =
        "Thanks, our team will be in touch shortly.";
      this.block.appendChild(ack);
    }
    this.onDone({
      status: "completed",
      submittedFields: [...this.submittedFields],
      skippedFields: [...this.skippedFields],
    });
  }

  // -------------------------------------------------------------------------
  // DOM helpers
  // -------------------------------------------------------------------------

  private disableStep(step: HTMLElement): void {
    step
      .querySelectorAll("button, input")
      .forEach((el) => ((el as HTMLButtonElement).disabled = true));
  }

  private replaceStepWithBreadcrumb(
    step: HTMLElement,
    text: string,
  ): void {
    step.replaceChildren();
    step.classList.add("convo-cap-step-done");
    const bc = document.createElement("div");
    bc.className = "convo-cap-breadcrumb";
    bc.textContent = text;
    step.appendChild(bc);
  }

  // -------------------------------------------------------------------------
  // Network
  // -------------------------------------------------------------------------

  private async postCapture(body: {
    action: "submit" | "skip" | "decline" | "privacy_notice_shown";
    field?: string;
    value?: string;
  }): Promise<{ ok: boolean } | null> {
    try {
      const res = await fetch(
        `${this.cfg.apiBase}/api/cases/${encodeURIComponent(
          this.caseInfo.case_id,
        )}/capture`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: this.cfg.tenantId,
            visitorId: this.cfg.visitorId,
            conversationId: this.cfg.conversationId,
            ...body,
          }),
        },
      );
      return { ok: res.ok };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point — resolves the policy off the SSE event and starts the flow
// ---------------------------------------------------------------------------

export function shouldRunCaptureForAction(action: string): boolean {
  return (
    action === "offer_follow_up" ||
    action === "capture_details_then_flag" ||
    action === "immediate_escalation"
  );
}

/**
 * Pure predicate (CON-172 / D4) — true when the resolver action
 * should surface the tenant's approved contact method as an inline
 * referral card. Mirrors the dispatch decision in
 * `WidgetUI.renderCaseEvent` and is exported so it can be unit-tested
 * without a DOM.
 */
export function shouldRenderContactMethodForAction(
  action: string,
): boolean {
  return action === "refer_to_approved_contact_method";
}

/**
 * Pure resolver (CON-172 / D4) — returns the visitor-facing
 * `{ href, label }` for a given contact-method payload, or `null`
 * when the payload can't be rendered as an actionable link (e.g.
 * `callback` with no URL). Exported for unit tests so the
 * label/href contract is verifiable without spinning up a Shadow
 * DOM.
 */
export function resolveContactMethodHref(cm: {
  type: "email" | "phone" | "callback" | "url" | "form";
  value?: string;
  url?: string;
}): { href: string; external: boolean } | null {
  if (cm.type === "email" && cm.value) {
    return { href: `mailto:${cm.value}`, external: false };
  }
  if (cm.type === "phone" && cm.value) {
    const tel = cm.value.replace(/[\s()\-]/g, "");
    return { href: `tel:${tel}`, external: false };
  }
  if ((cm.type === "url" || cm.type === "form") && cm.url) {
    return { href: cm.url, external: true };
  }
  if (cm.type === "callback" && cm.url) {
    return { href: cm.url, external: true };
  }
  return null;
}

export function startCaptureFlow(args: {
  mount: HTMLElement;
  caseInfo: CaptureCaseInfo;
  config: CaptureFlowConfig;
  prefill?: CapturePrefill;
  fieldLabelOverrides?: CaptureFieldLabelOverrides;
  onDone: CaptureFlowDone;
}): CaptureFlow | null {
  const policy = args.caseInfo.capture_policy;
  if (!policy) {
    // No inlined policy — server-side resolution failed (logged
    // already on the route side). Nothing to render; the chat
    // transcript stands on its own.
    args.onDone({
      status: "completed",
      submittedFields: [],
      skippedFields: [],
    });
    return null;
  }

  const flow = new CaptureFlow({
    mount: args.mount,
    caseInfo: args.caseInfo,
    policy,
    config: args.config,
    prefill: args.prefill,
    fieldLabelOverrides: args.fieldLabelOverrides,
    onDone: args.onDone,
  });
  flow.start();
  return flow;
}
