#!/usr/bin/env node

/**
 * Widget capture-flow unit tests (CON-170 / D2b, Epic D2).
 *
 * Pure tsx-runnable. Exercises the deterministic pieces of
 * `src/widget/capture.ts` — the validator + the `shouldRunCaptureForAction`
 * predicate. DOM rendering is covered by the e2e smoke (Doggo dashboard
 * widget) once D2b is deployed; we don't ship JSDOM into this repo.
 *
 * Run with:
 *   npx tsx src/widget/__tests__/capture.test.ts
 */

import {
  CaptureFlow,
  shouldRunCaptureForAction,
  shouldRenderContactMethodForAction,
  resolveContactMethodHref,
  validateClientField,
} from "../capture";

let passed = 0;
let failed = 0;
const failures: string[] = [];
const tests: Array<[string, () => void | Promise<void>]> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push([name, fn]);
}

async function runTests() {
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${name}`);
      console.log(`   Error: ${message}`);
      failed++;
      failures.push(`${name}: ${message}`);
    }
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

class FakeElement {
  public children: FakeElement[] = [];
  public className = "";
  public textContent = "";
  public hidden = false;
  public disabled = false;
  public value = "";
  public href = "";
  public target = "";
  public rel = "";
  public type = "";
  public id = "";
  public htmlFor = "";
  public placeholder = "";
  public classList = {
    add: (...names: string[]) => {
      const existing = new Set(this.className.split(/\s+/).filter(Boolean));
      for (const name of names) existing.add(name);
      this.className = [...existing].join(" ");
    },
  };
  private listeners: Record<string, Array<(event: { preventDefault(): void }) => void>> =
    {};

  constructor(public readonly tagName: string) {}

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  replaceChildren(): void {
    this.children = [];
  }

  setAttribute(name: string, value: string): void {
    (this as unknown as Record<string, string>)[name] = value;
  }

  addEventListener(
    name: string,
    listener: (event: { preventDefault(): void }) => void,
  ): void {
    this.listeners[name] ??= [];
    this.listeners[name].push(listener);
  }
  click(): void {
    for (const listener of this.listeners.click ?? []) {
      listener({ preventDefault: () => {} });
    }
  }
  focus(): void {}
  select(): void {}
  querySelectorAll(): FakeElement[] {
    const matches: FakeElement[] = [];
    const visit = (node: FakeElement) => {
      for (const child of node.children) {
        if (child.tagName === "button" || child.tagName === "input") {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function textExists(node: FakeElement, text: string): boolean {
  if (node.textContent === text) return true;
  return node.children.some((child) => textExists(child, text));
}

function byClass(node: FakeElement, className: string): FakeElement[] {
  const matches: FakeElement[] = [];
  const visit = (current: FakeElement) => {
    if (current.className.split(/\s+/).includes(className)) {
      matches.push(current);
    }
    for (const child of current.children) visit(child);
  };
  visit(node);
  return matches;
}

function byText(node: FakeElement, text: string): FakeElement | null {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const found = byText(child, text);
    if (found) return found;
  }
  return null;
}

function installFakeDom(fetchBodies: Array<Record<string, unknown>>) {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.document = {
    createElement: (tagName: string) => new FakeElement(tagName),
  } as unknown as Document;
  globalThis.fetch = ((_url: string, init?: RequestInit) => {
    fetchBodies.push(JSON.parse(String(init?.body ?? "{}")));
    return Promise.resolve({ ok: true } as Response);
  }) as typeof fetch;
  globalThis.setTimeout = ((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout;

  return () => {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  };
}

// ---------------------------------------------------------------------------
// shouldRunCaptureForAction
// ---------------------------------------------------------------------------

test("shouldRunCaptureForAction matches D2 action set", () => {
  assert(
    shouldRunCaptureForAction("offer_follow_up"),
    "offer_follow_up should chain capture on Yes",
  );
  assert(
    shouldRunCaptureForAction("capture_details_then_flag"),
    "capture_details_then_flag must run capture",
  );
  assert(
    shouldRunCaptureForAction("immediate_escalation"),
    "immediate_escalation runs capture when policy attached",
  );
});

test("shouldRunCaptureForAction excludes silent / non-widget actions", () => {
  assert(
    !shouldRunCaptureForAction("continue_helping"),
    "continue_helping is silent",
  );
  assert(
    !shouldRunCaptureForAction("clarify_then_recheck"),
    "clarify_then_recheck is silent",
  );
  assert(
    !shouldRunCaptureForAction(
      "flag_for_staff_review_without_interrupting_visitor",
    ),
    "silent flag is silent",
  );
  assert(
    !shouldRunCaptureForAction("refer_to_approved_contact_method"),
    "refer is assistant-message-only at V1",
  );
});

// ---------------------------------------------------------------------------
// Privacy notice render + audit
// ---------------------------------------------------------------------------

test("CaptureFlow renders privacy header and emits privacy_notice_shown once", () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const fetchBodies: Array<Record<string, unknown>> = [];

  try {
    globalThis.document = {
      createElement: (tagName: string) => new FakeElement(tagName),
    } as unknown as Document;
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      fetchBodies.push(JSON.parse(String(init?.body ?? "{}")));
      return Promise.resolve({ ok: true } as Response);
    }) as typeof fetch;

    const mount = new FakeElement("div");
    const flow = new CaptureFlow({
      mount: mount as unknown as HTMLElement,
      caseInfo: {
        case_id: "11111111-1111-4111-8111-111111111111",
        action: "offer_follow_up",
      },
      policy: {
        id: "lead_basic",
        case_type: "lead",
        required_fields: ["email"],
        optional_fields: [],
        privacy_notice: "We use your details only to follow up on this enquiry.",
        privacy_policy_url: "https://example.test/privacy",
      },
      config: {
        apiBase: "https://app.example.test",
        tenantId: "22222222-2222-4222-8222-222222222222",
        visitorId: "visitor-a",
        conversationId: "33333333-3333-4333-8333-333333333333",
        primaryColor: "#FF6B2C",
      },
      onDone: () => {},
    });

    flow.start();
    flow.start();

    assert(
      textExists(mount, "We use your details only to follow up on this enquiry."),
      "privacy notice text rendered",
    );
    assert(textExists(mount, "Privacy policy"), "privacy policy link rendered");
    assertEq(fetchBodies.length, 1, "one audit request");
    assertEq(fetchBodies[0].action, "privacy_notice_shown", "event action");
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});

function captureFlowFixture(args: {
  mount: FakeElement;
  required: string[];
  optional: string[];
  prefill?: Record<string, string>;
  fieldLabelOverrides?: Record<string, string>;
  onDone?: (outcome: unknown) => void;
}) {
  return new CaptureFlow({
    mount: args.mount as unknown as HTMLElement,
    caseInfo: {
      case_id: "11111111-1111-4111-8111-111111111111",
      action: "offer_follow_up",
    },
    policy: {
      id: "lead_basic",
      case_type: "lead",
      required_fields: args.required,
      optional_fields: args.optional,
      privacy_notice: "We use your details only to follow up on this enquiry.",
      privacy_policy_url: "https://example.test/privacy",
    },
    config: {
      apiBase: "https://app.example.test",
      tenantId: "22222222-2222-4222-8222-222222222222",
      visitorId: "visitor-a",
      conversationId: "33333333-3333-4333-8333-333333333333",
      primaryColor: "#FF6B2C",
    },
    prefill: args.prefill,
    fieldLabelOverrides: args.fieldLabelOverrides,
    onDone: args.onDone ?? (() => {}),
  });
}

test("CaptureFlow renders all fields at once with one Send and one decline action", () => {
  const fetchBodies: Array<Record<string, unknown>> = [];
  const restore = installFakeDom(fetchBodies);

  try {
    const mount = new FakeElement("div");
    const flow = captureFlowFixture({
      mount,
      required: ["name", "email"],
      optional: ["free_text_note"],
      prefill: { email: "prefilled@example.test" },
    });

    flow.start();

    assert(textExists(mount, "What's your name?"), "name label rendered");
    assert(
      textExists(mount, "What's the best email to reach you on?"),
      "email label rendered",
    );
    assert(
      textExists(mount, "Anything else our team should know?"),
      "optional note label rendered",
    );
    assertEq(byClass(mount, "convo-cap-input").length, 3, "all inputs visible");
    assertEq(
      byClass(mount, "convo-cap-input")[1].value,
      "prefilled@example.test",
      "prefill value rendered",
    );
    assert(byText(mount, "Send"), "single Send button rendered");
    assert(byText(mount, "No thanks"), "single decline button rendered");
    assert(!byText(mount, "Skip"), "no per-field skip button rendered");
  } finally {
    restore();
  }
});

test("CaptureFlow applies fieldLabelOverrides before FIELD_META labels", () => {
  const fetchBodies: Array<Record<string, unknown>> = [];
  const restore = installFakeDom(fetchBodies);

  try {
    const mount = new FakeElement("div");
    const flow = captureFlowFixture({
      mount,
      required: ["email"],
      optional: ["free_text_note"],
      fieldLabelOverrides: {
        free_text_note: "What can we help with?",
      },
    });

    flow.start();

    assert(
      textExists(mount, "What can we help with?"),
      "override label rendered",
    );
    assert(
      !textExists(mount, "Anything else our team should know?"),
      "default label replaced",
    );
  } finally {
    restore();
  }
});

test("CaptureFlow keeps per-field validation errors and entered values on resubmit", () => {
  const fetchBodies: Array<Record<string, unknown>> = [];
  const restore = installFakeDom(fetchBodies);

  try {
    const mount = new FakeElement("div");
    const flow = captureFlowFixture({
      mount,
      required: ["email", "mobile"],
      optional: ["free_text_note"],
    });

    flow.start();
    const inputs = byClass(mount, "convo-cap-input");
    inputs[0].value = "bad-email";
    inputs[1].value = "12";
    inputs[2].value = "Please call after 4pm";

    byText(mount, "Send")?.click();

    const errors = byClass(mount, "convo-cap-error");
    assertEq(
      errors[0].textContent,
      "Please enter a valid email address",
      "email error rendered",
    );
    assertEq(
      errors[1].textContent,
      "Please enter a valid phone number",
      "mobile error rendered",
    );

    inputs[0].value = "test@example.test";
    byText(mount, "Send")?.click();

    assertEq(errors[0].hidden, true, "fixed email error cleared");
    assertEq(
      errors[1].textContent,
      "Please enter a valid phone number",
      "mobile error survives second submit",
    );
    assertEq(
      inputs[2].value,
      "Please call after 4pm",
      "optional value preserved",
    );
    assertEq(fetchBodies.length, 1, "validation does not post beyond privacy");
  } finally {
    restore();
  }
});

test("CaptureFlow submits populated fields and skips blank optional fields sequentially", async () => {
  const fetchBodies: Array<Record<string, unknown>> = [];
  const restore = installFakeDom(fetchBodies);
  let doneOutcome: unknown = null;

  try {
    const mount = new FakeElement("div");
    const flow = captureFlowFixture({
      mount,
      required: ["name", "email"],
      optional: ["free_text_note"],
      onDone: (outcome) => {
        doneOutcome = outcome;
      },
    });

    flow.start();
    const inputs = byClass(mount, "convo-cap-input");
    inputs[0].value = "Blake";
    inputs[1].value = "Test@Example.Com";
    inputs[2].value = "";

    byText(mount, "Send")?.click();
    for (let i = 0; i < 6; i += 1) await Promise.resolve();

    assertEq(fetchBodies.length, 4, "privacy + three field audit rows");
    assertEq(fetchBodies[0].action, "privacy_notice_shown", "privacy audit");
    assertEq(fetchBodies[1].action, "submit", "name submit audit");
    assertEq(fetchBodies[1].field, "name", "name field");
    assertEq(fetchBodies[1].value, "Blake", "name value");
    assertEq(fetchBodies[2].action, "submit", "email submit audit");
    assertEq(fetchBodies[2].field, "email", "email field");
    assertEq(fetchBodies[2].value, "test@example.com", "email normalised");
    assertEq(fetchBodies[3].action, "skip", "blank optional skip audit");
    assertEq(fetchBodies[3].field, "free_text_note", "skipped field");
    assert(
      textExists(mount, "Thanks, our team will be in touch shortly."),
      "completion breadcrumb rendered",
    );
    assertEq(
      JSON.stringify(doneOutcome),
      JSON.stringify({
        status: "completed",
        submittedFields: ["name", "email"],
        skippedFields: ["free_text_note"],
      }),
      "done callback outcome",
    );
  } finally {
    restore();
  }
});

test("CaptureFlow decline emits audit and ends the flow", async () => {
  const fetchBodies: Array<Record<string, unknown>> = [];
  const restore = installFakeDom(fetchBodies);
  let doneOutcome: unknown = null;

  try {
    const mount = new FakeElement("div");
    const flow = captureFlowFixture({
      mount,
      required: ["email"],
      optional: ["free_text_note"],
      onDone: (outcome) => {
        doneOutcome = outcome;
      },
    });

    flow.start();
    byText(mount, "No thanks")?.click();
    await Promise.resolve();
    await Promise.resolve();

    assertEq(fetchBodies.length, 2, "privacy + decline audit rows");
    assertEq(fetchBodies[1].action, "decline", "decline audit event");
    assert(
      textExists(mount, "No worries, we won't ask for any more details."),
      "decline breadcrumb rendered",
    );
    assertEq(
      JSON.stringify(doneOutcome),
      JSON.stringify({
        status: "declined",
        submittedFields: [],
        skippedFields: [],
      }),
      "decline callback outcome",
    );
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// validateClientField — mirrors server's validateCaptureField
// ---------------------------------------------------------------------------

test("validateClientField: name trims and accepts", () => {
  const r = validateClientField("name", "  Blake  ");
  assert(r.ok && r.value === "Blake", "trimmed Blake");
});

test("validateClientField: empty rejected", () => {
  const r = validateClientField("name", "   ");
  assert(!r.ok, "should reject");
});

test("validateClientField: email lowercases", () => {
  const r = validateClientField("email", "Test@Example.Com");
  assert(r.ok && r.value === "test@example.com", "lowercased");
});

test("validateClientField: malformed email rejected with friendly copy", () => {
  const r = validateClientField("email", "no-at-symbol");
  assert(!r.ok, "should reject");
  if (!r.ok) {
    // Brand voice: no exclamation marks, sentence case.
    assert(
      !r.reason.includes("!"),
      `error should not contain exclamation marks: ${r.reason}`,
    );
  }
});

test("validateClientField: mobile strips separators", () => {
  const r = validateClientField("mobile", "0400-123-456");
  assert(r.ok, "should accept");
});

test("validateClientField: mobile rejects too-short", () => {
  const r = validateClientField("mobile", "12");
  assert(!r.ok, "should reject");
});

test("validateClientField: postcode AU 4-digit ok", () => {
  const r = validateClientField("postcode", "2000");
  assert(r.ok && r.value === "2000", "ok");
});

test("validateClientField: postcode garbage rejected", () => {
  const r = validateClientField("postcode", "??????");
  assert(!r.ok, "should reject");
});

test("validateClientField: custom field accepted as-is", () => {
  const r = validateClientField("property_size", "5 acres");
  assert(r.ok && r.value === "5 acres", "ok");
});

test("validateClientField: 5KB value rejected", () => {
  const big = "x".repeat(5000);
  const r = validateClientField("free_text_note", big);
  assert(!r.ok, "should reject");
});

// ---------------------------------------------------------------------------
// CON-172 / D4 — refer_to_approved_contact_method dispatcher + href resolver
// ---------------------------------------------------------------------------

test(
  "shouldRenderContactMethodForAction matches refer action only",
  () => {
    assert(
      shouldRenderContactMethodForAction("refer_to_approved_contact_method"),
      "refer must render contact-method card",
    );
    for (const other of [
      "continue_helping",
      "clarify_then_recheck",
      "offer_follow_up",
      "capture_details_then_flag",
      "immediate_escalation",
      "flag_for_staff_review_without_interrupting_visitor",
      "unknown_future_action",
    ]) {
      assert(
        !shouldRenderContactMethodForAction(other),
        `${other} must NOT render contact-method card`,
      );
    }
  },
);

test("resolveContactMethodHref: email type → mailto:", () => {
  const r = resolveContactMethodHref({
    type: "email",
    value: "support@example.test",
  });
  assert(r !== null, "should resolve");
  assertEq(r!.href, "mailto:support@example.test", "href");
  assertEq(r!.external, false, "mailto is OS-handled, not external tab");
});

test("resolveContactMethodHref: phone type strips separators → tel:", () => {
  const r = resolveContactMethodHref({
    type: "phone",
    value: "+61 (0)400-123-456",
  });
  assert(r !== null, "should resolve");
  // Whitespace, parens, and hyphens stripped; `+` and digits retained.
  assertEq(r!.href, "tel:+610400123456", "tel: with separators stripped");
  assertEq(r!.external, false, "tel is OS-handled");
});

test("resolveContactMethodHref: url type marks external", () => {
  const r = resolveContactMethodHref({
    type: "url",
    url: "https://example.test/help",
  });
  assert(r !== null, "should resolve");
  assertEq(r!.href, "https://example.test/help", "href");
  assertEq(r!.external, true, "url opens in new tab");
});

test("resolveContactMethodHref: form type marks external", () => {
  const r = resolveContactMethodHref({
    type: "form",
    url: "https://example.test/contact",
  });
  assert(r !== null, "should resolve");
  assertEq(r!.external, true, "form opens in new tab");
});

test("resolveContactMethodHref: callback with url → external link", () => {
  const r = resolveContactMethodHref({
    type: "callback",
    url: "https://example.test/callback",
  });
  assert(r !== null, "should resolve");
  assertEq(r!.external, true, "callback url opens in new tab");
});

test("resolveContactMethodHref: callback without url → null (label-only fallback)", () => {
  const r = resolveContactMethodHref({ type: "callback" });
  assert(r === null, "no actionable href when callback has no url");
});

test("resolveContactMethodHref: email without value → null", () => {
  const r = resolveContactMethodHref({ type: "email" });
  assert(r === null, "no actionable href when email has no value");
});

test("resolveContactMethodHref: phone without value → null", () => {
  const r = resolveContactMethodHref({ type: "phone" });
  assert(r === null, "no actionable href when phone has no value");
});

// ---------------------------------------------------------------------------
// Australian English / brand voice spot-checks
// ---------------------------------------------------------------------------

test("error copy: no exclamation marks in any rejection reason", () => {
  const samples: Array<[string, string]> = [
    ["email", "x"],
    ["mobile", "x"],
    ["postcode", "??"],
    ["name", ""],
  ];
  for (const [field, val] of samples) {
    const r = validateClientField(field, val);
    if (!r.ok) {
      assertEq(
        r.reason.includes("!"),
        false,
        `${field}: reason must be exclamation-free`,
      );
    }
  }
});

void runTests().then(() => {
  console.log("");
  if (failed === 0) {
    console.log(`✅ All ${passed} tests passed.`);
    process.exit(0);
  } else {
    console.log(`❌ ${failed}/${passed + failed} tests failed.`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  }
});
