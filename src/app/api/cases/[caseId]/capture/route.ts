/**
 * POST /api/cases/:caseId/capture  (CON-170, Epic D2 — progressive capture)
 *
 * Visitor-facing endpoint used by the widget's `CaptureFlow` module to
 * persist progressive contact details + audit the visitor's decisions
 * (submit / skip / decline).
 *
 * Security model (mirrors `/api/conversations/case-events`):
 *   - Public route (allowlisted in middleware so the widget can POST
 *     without an authenticated session — see `src/middleware.ts`).
 *   - Visitor-scoped: caller supplies `tenantId` + `visitorId` +
 *     `conversationId` + `caseId`. The server verifies (a) the
 *     conversation belongs to that visitor under that tenant, AND (b)
 *     the case belongs to that conversation under that tenant.
 *     Cross-tenant / cross-visitor / cross-case attempts return 404
 *     (non-enumerating — never "found elsewhere").
 *
 * Body (one of two shapes):
 *
 *   Submit a single field:
 *     {
 *       tenantId: uuid,
 *       visitorId: string,
 *       conversationId: uuid,
 *       action: "submit",
 *       field: string,          // capture policy field key
 *       value: string,          // raw visitor input
 *     }
 *
 *   Skip a single field OR decline the whole capture:
 *     {
 *       tenantId: uuid,
 *       visitorId: string,
 *       conversationId: uuid,
 *       action: "skip" | "decline",
 *       field?: string,         // present for skip; ignored for decline
 *     }
 *
 * Locked invariant (PRD §10, AGENTS.md):
 *   - The case row exists BEFORE this endpoint is called (D2a persists in
 *     the chat route before emitting the SSE `case` event). We never
 *     create cases here.
 *   - We only upsert a `contacts` row when the visitor submits an
 *     identifier-grade field (email, mobile). Name + free-text + postcode
 *     alone are stored as case attributes only.
 *   - Decline writes an audit event but never creates a contact and
 *     never sets `case.contactId`. The case stays open for staff review.
 *
 * Response: 200 `{ ok: true, ...detail }` on success;
 *           400 on bad input (the path field is surfaced);
 *           404 on unknown tenant/conversation/case or any scope mismatch.
 *
 * No CORS headers — widget is served same-origin from the app domain.
 *
 * NB: We DO NOT log raw identifier values (email/phone/postcode) at the
 * route layer. Audit payloads stored in `follow_up_events` redact values
 * to a short hash for cross-reference without exposing PII to logs.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";

import { getTenantById } from "@/lib/tenant";
import { getConversationForVisitor } from "@/lib/conversations";
import {
  getCaseById,
  type CaseHelperOptions,
  type CaseRow,
} from "@/lib/cases";
import { setCaseAttribute } from "@/lib/cases/attributes";
import { recordCaseEvent } from "@/lib/cases/events";
import {
  upsertContact,
  linkContactToConversation,
  normaliseEmail,
  normalisePhone,
  type ContactRow,
} from "@/lib/contacts";
import {
  getDefaultCasesStore,
  type CasesStore,
} from "@/lib/cases/store";
import type { ContactsStore } from "@/lib/contacts/store";

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

/**
 * V1 field key registry — mirrors `fieldKeySchema` in
 * `src/lib/forum-config/schema.ts`. Includes the canonical registry
 * values; custom tenant keys are accepted as opaque `free_text`-style
 * fields (stored as case attributes, never as contact identifiers).
 */
const CANONICAL_FIELD_KEYS = [
  "name",
  "email",
  "mobile",
  "postcode",
  "suburb",
  "state",
  "company",
  "free_text_note",
  "preferred_contact_method",
] as const;

type CanonicalFieldKey = (typeof CANONICAL_FIELD_KEYS)[number];

function isCanonicalFieldKey(key: string): key is CanonicalFieldKey {
  return (CANONICAL_FIELD_KEYS as readonly string[]).includes(key);
}

export type FieldValidationResult =
  | { ok: true; normalised: string }
  | { ok: false; reason: string };

/**
 * Light client-side-equivalent validation. The server is the source of
 * truth — the widget mirrors these checks for fast feedback but never
 * relies on them being authoritative.
 *
 * Pure function — exported for unit tests.
 */
export function validateCaptureField(
  field: string,
  rawValue: string,
): FieldValidationResult {
  if (typeof rawValue !== "string") {
    return { ok: false, reason: "value must be a string" };
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "value is empty" };
  }
  // 4KB upper bound on any single field — defensive against accidental
  // multi-MB pastes. Real fields are <200 chars.
  if (trimmed.length > 4096) {
    return { ok: false, reason: "value too long" };
  }

  switch (field) {
    case "name": {
      // Name must contain at least one non-whitespace character. We do
      // NOT enforce a regex — names vary wildly across cultures (single
      // names, mononyms, hyphens, apostrophes, non-Latin scripts). The
      // length cap above is the only structural constraint.
      return { ok: true, normalised: trimmed };
    }
    case "email": {
      // Lightweight RFC 5322-ish check: one @, something either side,
      // a dot in the domain. Real validation happens by the visitor
      // either receiving mail or not — we never block on regex edge cases.
      const lower = trimmed.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
        return { ok: false, reason: "invalid email format" };
      }
      return { ok: true, normalised: lower };
    }
    case "mobile": {
      // Australian mobile numbers are the common case but we accept any
      // international format. Rule: at least 8 digits after stripping
      // separators (spaces, dashes, parens, leading +).
      const digits = trimmed.replace(/[\s\-()]/g, "").replace(/^\+/, "");
      if (!/^\d{8,15}$/.test(digits)) {
        return { ok: false, reason: "invalid phone number" };
      }
      // Preserve a leading `+` if present — useful downstream when the
      // CRM normalises to E.164.
      const normalised = trimmed.startsWith("+") ? `+${digits}` : digits;
      return { ok: true, normalised };
    }
    case "postcode": {
      // Australian postcodes are 4 digits; we allow 3-10 to cover NZ,
      // UK, and edge cases without becoming a global parser.
      const cleaned = trimmed.replace(/\s+/g, "");
      if (!/^[A-Za-z0-9]{3,10}$/.test(cleaned)) {
        return { ok: false, reason: "invalid postcode" };
      }
      return { ok: true, normalised: cleaned };
    }
    case "free_text_note": {
      // Already trimmed + length-capped above.
      return { ok: true, normalised: trimmed };
    }
    default: {
      // Custom tenant field — accept as-is. The forum-config schema
      // already validated that this is a non-empty string key when the
      // capture_policy was loaded.
      return { ok: true, normalised: trimmed };
    }
  }
}

/**
 * Returns `true` when the field is an identifier-grade key — i.e. a
 * value that should be promoted to the `contacts` table on submit.
 *
 * Exported for tests.
 */
export function isIdentifierField(field: string): boolean {
  return field === "email" || field === "mobile";
}

/**
 * SHA-256 the first 12 hex chars of a value, prefixed with a tag. Used
 * to mask identifier values in audit payloads so we have a stable
 * cross-reference key without storing PII in the events table.
 *
 * Pure. Exported for tests.
 */
export function hashIdentifierForAudit(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex")
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Injectable data-access seam (for tests)
// ---------------------------------------------------------------------------

type TenantLookupRow = { id: string } | null;
type ConversationLookupRow = { id: string; tenantId: string } | null;

export type CaptureRouteDeps = {
  getTenantById: (id: string) => Promise<TenantLookupRow>;
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string,
  ) => Promise<ConversationLookupRow>;
  getCaseById: (
    tenantId: string,
    caseId: string,
    opts?: CaseHelperOptions,
  ) => Promise<CaseRow | null>;
  setCaseAttribute: typeof setCaseAttribute;
  recordCaseEvent: typeof recordCaseEvent;
  upsertContact: typeof upsertContact;
  linkContactToConversation: typeof linkContactToConversation;
  /**
   * Patch a case to bind a contact_id once an identifier is captured.
   * Goes through the cases store directly because the public helpers in
   * `src/lib/cases/index.ts` don't expose a `setContactId` surface — we
   * use the lower-level store `updateCase` here.
   */
  updateCaseContactId: (
    tenantId: string,
    caseId: string,
    contactId: string,
  ) => Promise<void>;
};

function defaultUpdateCaseContactId(
  store: CasesStore,
): CaptureRouteDeps["updateCaseContactId"] {
  return async (tenantId, caseId, contactId) => {
    await store.updateCase(tenantId, caseId, { contactId });
  };
}

const defaultDeps: CaptureRouteDeps = {
  getTenantById,
  getConversationForVisitor,
  getCaseById,
  setCaseAttribute,
  recordCaseEvent,
  upsertContact,
  linkContactToConversation,
  updateCaseContactId: defaultUpdateCaseContactId(getDefaultCasesStore()),
};

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const actionEnum = z.enum(["submit", "skip", "decline"]);

const baseBodySchema = z.object({
  tenantId: z.string().uuid(),
  visitorId: z.string().min(1),
  conversationId: z.string().uuid(),
  action: actionEnum,
  field: z.string().min(1).max(128).optional(),
  value: z.string().max(4096).optional(),
});

type ParsedBody = z.infer<typeof baseBodySchema>;

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

function notFound(): Response {
  return jsonResponse({ error: "Not found" }, 404);
}

// ---------------------------------------------------------------------------
// Core handler (testable; deps injected, no Postgres at the seam)
// ---------------------------------------------------------------------------

export async function handleCaptureSubmit(
  req: { json: () => Promise<unknown> },
  caseId: string,
  deps: CaptureRouteDeps = defaultDeps,
): Promise<Response> {
  // caseId comes from the Next.js dynamic route segment, NOT the body —
  // body and URL must agree to prevent dumb visitors from POSTing to one
  // case while claiming to update another. We don't even accept a
  // `caseId` field in the body; the URL is the only source.
  if (!z.string().uuid().safeParse(caseId).success) {
    return badRequest("Invalid caseId");
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = baseBodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const fieldPath = issue?.path?.join(".") ?? "body";
    return badRequest(`Invalid request: ${fieldPath}`);
  }

  const body: ParsedBody = parsed.data;

  // Action-specific input requirements.
  if (body.action === "submit") {
    if (!body.field || body.value === undefined) {
      return badRequest("submit requires field + value");
    }
  } else if (body.action === "skip") {
    if (!body.field) {
      return badRequest("skip requires field");
    }
  }
  // decline: field/value ignored even if present.

  // ----------- Scope checks: tenant → conversation → case -----------

  const tenant = await deps.getTenantById(body.tenantId);
  if (!tenant) {
    return notFound();
  }

  const conversation = await deps.getConversationForVisitor(
    body.conversationId,
    body.tenantId,
    body.visitorId,
  );
  if (!conversation) {
    return notFound();
  }

  const kase = await deps.getCaseById(body.tenantId, caseId);
  if (!kase) {
    return notFound();
  }
  // The case must belong to the same conversation the widget claims —
  // otherwise we'd let visitor A's case_id leak across to visitor B's
  // conversation under the same tenant. Cheap belt-and-braces check.
  if (kase.conversationId !== body.conversationId) {
    return notFound();
  }

  // ----------- Dispatch by action -----------

  if (body.action === "decline") {
    return handleDecline(body, kase, deps);
  }
  if (body.action === "skip") {
    return handleSkip(body, kase, deps);
  }
  return handleSubmit(body, kase, deps);
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleDecline(
  body: ParsedBody,
  kase: CaseRow,
  deps: CaptureRouteDeps,
): Promise<Response> {
  await deps.recordCaseEvent(body.tenantId, {
    caseId: kase.id,
    conversationId: kase.conversationId,
    actorType: "visitor",
    actorId: body.visitorId,
    eventType: "capture_declined",
    payload: {
      // No value here — the visitor said "no" to capture entirely.
      // Staff still see the case (it was created before the SSE event)
      // and can act on the conversation summary instead.
    },
  });

  return jsonResponse({ ok: true, action: "decline" }, 200);
}

async function handleSkip(
  body: ParsedBody,
  kase: CaseRow,
  deps: CaptureRouteDeps,
): Promise<Response> {
  await deps.recordCaseEvent(body.tenantId, {
    caseId: kase.id,
    conversationId: kase.conversationId,
    actorType: "visitor",
    actorId: body.visitorId,
    eventType: "capture_field_skipped",
    payload: {
      field: body.field,
    },
  });

  return jsonResponse({ ok: true, action: "skip", field: body.field }, 200);
}

async function handleSubmit(
  body: ParsedBody,
  kase: CaseRow,
  deps: CaptureRouteDeps,
): Promise<Response> {
  const field = body.field as string; // narrowed above
  const rawValue = body.value as string;

  // Field-key sanity: canonical or non-empty custom. The forum-config
  // schema accepted both shapes at parse time; we accept the same here.
  if (!isCanonicalFieldKey(field) && field.trim().length === 0) {
    return badRequest("Invalid request: field");
  }

  const validation = validateCaptureField(field, rawValue);
  if (!validation.ok) {
    return badRequest(`Invalid value for ${field}: ${validation.reason}`);
  }

  const normalised = validation.normalised;
  const valueHash = hashIdentifierForAudit(normalised);

  // 1. Always persist the attribute (latest-wins per (case, key)).
  //    Stored as a structured payload so the dashboard can render the
  //    masked value later without round-tripping back to the contact.
  await deps.setCaseAttribute(body.tenantId, {
    caseId: kase.id,
    key: field,
    value: { value: normalised },
    source: "visitor_capture",
    confidence: 1,
  });

  let contact: ContactRow | null = null;
  let contactCreated = false;

  // 2. Identifier-grade fields (email / mobile) — upsert into contacts
  //    and link to the conversation. Non-identifier fields stay as
  //    attributes only; we never promote a postcode-only visitor to a
  //    contact row (that creates noisy half-records in the CRM).
  if (isIdentifierField(field)) {
    const upsertInput =
      field === "email"
        ? { emailNormalised: normaliseEmail(normalised) ?? undefined }
        : { phoneNormalised: normalisePhone(normalised) ?? undefined };

    const result = await deps.upsertContact(body.tenantId, upsertInput);
    contact = result.contact;
    contactCreated = result.created;

    await deps.linkContactToConversation(body.tenantId, {
      conversationId: kase.conversationId,
      contactId: contact.id,
      relationship: "primary_contact",
    });

    // 3. Bind the case to the contact if it wasn't already bound. We
    //    only set, never overwrite — once a case has a contact, the
    //    classifier/staff own that relationship.
    if (!kase.contactId) {
      await deps.updateCaseContactId(body.tenantId, kase.id, contact.id);
    }
  }

  // 4. Append-only audit event. Identifier values are HASHED in the
  //    payload — staff can correlate via the contact id (when present)
  //    or the attribute snapshot, but the events table never carries
  //    raw email/phone strings.
  await deps.recordCaseEvent(body.tenantId, {
    caseId: kase.id,
    conversationId: kase.conversationId,
    actorType: "visitor",
    actorId: body.visitorId,
    eventType: "capture_field_submitted",
    payload: {
      field,
      value_hash: isIdentifierField(field) ? valueHash : undefined,
      contact_id: contact?.id,
      contact_created: contact ? contactCreated : undefined,
    },
  });

  return jsonResponse(
    {
      ok: true,
      action: "submit",
      field,
      contact_id: contact?.id ?? null,
      contact_created: contactCreated || undefined,
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// Route handler — Next.js wires this to /api/cases/[caseId]/capture
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const { caseId } = await ctx.params;
  return handleCaptureSubmit(req, caseId);
}

// Suppress the unused-import warning for the contacts store dep that is
// only exercised through the default dep wiring. esbuild/tsc keep the
// import live because the default deps factory references it.
export type { ContactsStore };
