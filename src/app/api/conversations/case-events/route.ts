/**
 * POST /api/conversations/case-events (CON-169, Epic D1)
 *
 * Visitor-facing endpoint used by the widget to acknowledge an
 * `offer_follow_up` prompt (Yes/No). Stubbed for D1 — body is validated +
 * logged but not persisted. Epic B5 will wire `follow_up_events`
 * persistence in once schema lands.
 *
 * Security model (mirrors `/api/chat`):
 *   - Public route (allowlisted in middleware so the widget can POST
 *     without an authenticated session).
 *   - Visitor-scoped: the caller supplies `tenantId` + `visitorId` +
 *     `conversationId`, and the server verifies the conversation
 *     actually belongs to that tuple. Cross-tenant / cross-visitor
 *     attempts return 404 (non-enumerating — never "found elsewhere").
 *
 * Body:
 *   {
 *     tenantId: uuid,
 *     visitorId: string,
 *     conversationId: uuid,
 *     caseEventType: "offer_accepted" | "offer_declined",
 *     metadata?: { rule_id?, confidence?, ... }
 *   }
 *
 * Response: 200 `{ ok: true }` on success; 400 on bad input; 404 on
 * unknown tenant/conversation or cross-tenant mismatch.
 *
 * TODO(B5): persist to follow_up_events when Epic B unblocks.
 */
import { NextRequest } from "next/server";
import { z } from "zod";

import { getConversationForVisitor } from "@/lib/conversations";
import { getTenantById } from "@/lib/tenant";

// ---------------------------------------------------------------------------
// Injectable data-access seam (for tests)
// ---------------------------------------------------------------------------

/**
 * Minimal subset of the tenant row we need for the scope check.
 * Anything narrower than `{ id }` is fine — the row is opaque otherwise.
 */
type TenantLookupRow = { id: string } | null;
type ConversationLookupRow = { id: string; tenantId: string } | null;

export type CaseEventDeps = {
  getTenantById: (id: string) => Promise<TenantLookupRow>;
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string
  ) => Promise<ConversationLookupRow>;
};

const defaultDeps: CaseEventDeps = {
  getTenantById,
  getConversationForVisitor,
};

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const caseEventTypeSchema = z.enum(["offer_accepted", "offer_declined"]);

const requestBodySchema = z.object({
  tenantId: z.string().uuid(),
  visitorId: z.string().min(1),
  conversationId: z.string().uuid(),
  caseEventType: caseEventTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
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
  // Non-enumerating 404 — never hint that a resource exists under a
  // different scope.
  return jsonResponse({ error: "Not found" }, 404);
}

// ---------------------------------------------------------------------------
// Core handler (testable; deps injected)
// ---------------------------------------------------------------------------

export async function handleCaseEvent(
  req: { json: () => Promise<unknown> },
  deps: CaseEventDeps = defaultDeps,
): Promise<Response> {
  // Parse JSON body defensively — malformed JSON is a client bug.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = requestBodySchema.safeParse(raw);
  if (!parsed.success) {
    // Surface the first issue path so the widget can debug, but don't
    // dump the full Zod tree — keep responses small.
    const issue = parsed.error.issues[0];
    const fieldPath = issue?.path?.join(".") ?? "body";
    return badRequest(`Invalid request: ${fieldPath}`);
  }

  const { tenantId, visitorId, conversationId, caseEventType, metadata } = parsed.data;

  // Tenant scope check: tenant must exist.
  const tenant = await deps.getTenantById(tenantId);
  if (!tenant) {
    return notFound();
  }

  // Conversation must exist AND belong to the supplied tenant + visitor.
  const conversation = await deps.getConversationForVisitor(
    conversationId,
    tenantId,
    visitorId
  );
  if (!conversation) {
    return notFound();
  }

  // Stub: log the event so it's visible in Vercel logs during D1 smoke
  // testing. B5 will replace this with a `follow_up_events` insert.
  // TODO(B5): persist to follow_up_events when Epic B unblocks.
  console.info("[follow-up] case event", {
    tenantId,
    conversationId,
    caseEventType,
    metadata: metadata ?? null,
  });

  return jsonResponse({ ok: true }, 200);
}

// ---------------------------------------------------------------------------
// Route handler (Next.js wires this up at /api/conversations/case-events)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  return handleCaseEvent(req);
}
