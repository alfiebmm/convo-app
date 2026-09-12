import { NextRequest, NextResponse } from "next/server";

import { canMutateCases } from "@/lib/auth/permissions";
import {
  getDefaultConvosStore,
  type ConvoActivity,
  type ConvoDetail,
  type ConvoMessage,
  type ConvoNote,
} from "@/lib/convos";
import {
  convoDetailResponseSchema,
  mutateConvoResponseSchema,
  patchConvoBodySchema,
} from "@/lib/convos/schemas";
import {
  resolveConvosContext,
  serializeConvoListItem,
  type ConvosRouteDeps,
} from "../route";
import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";

const defaultDeps: ConvosRouteDeps = {
  auth,
  getActiveTenantIdForUser,
  getTenantMembership,
  store: getDefaultConvosStore(),
};

function iso(date: Date): string {
  return date.toISOString();
}

function serializeMessage(message: ConvoMessage) {
  return { ...message, createdAt: iso(message.createdAt) };
}

function serializeNote(note: ConvoNote) {
  return { ...note, createdAt: iso(note.createdAt) };
}

function serializeActivity(event: ConvoActivity) {
  return { ...event, createdAt: iso(event.createdAt) };
}

export function serializeConvoDetail(detail: ConvoDetail) {
  return {
    convo: {
      ...serializeConvoListItem(detail.convo),
      visitorId: detail.convo.visitorId,
      metadata: detail.convo.metadata,
      completedAt: detail.convo.completedAt?.toISOString() ?? null,
      summary: detail.convo.summary,
      summaryGeneratedAt:
        detail.convo.summaryGeneratedAt?.toISOString() ?? null,
    },
    transcript: detail.transcript.map(serializeMessage),
    tags: detail.tags,
    capturedCustomerDetails: detail.capturedCustomerDetails,
    internalNotes: detail.internalNotes.map(serializeNote),
    activityHistory: detail.activityHistory.map(serializeActivity),
    linkedBlogArticle: detail.linkedBlogArticle
      ? {
          ...detail.linkedBlogArticle,
          publishedAt:
            detail.linkedBlogArticle.publishedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export async function handleGetConvo(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  deps: ConvosRouteDeps = defaultDeps
) {
  const context = await resolveConvosContext(deps);
  if ("response" in context) return context.response;

  const { id } = await params;
  const detail = await deps.store.getConvoDetail(context.tenantId, id);
  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    convoDetailResponseSchema.parse(serializeConvoDetail(detail))
  );
}

export async function handlePatchConvo(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  deps: ConvosRouteDeps = defaultDeps
) {
  const context = await resolveConvosContext(deps);
  if ("response" in context) return context.response;
  if (!canMutateCases(context.membership)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = patchConvoBodySchema.safeParse(raw);
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  if (body.data.note) {
    const note = await deps.store.appendNote(
      context.tenantId,
      id,
      body.data.note,
      context.userId
    );
    if (!note) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const item = await deps.store.updateConvo(context.tenantId, id, {
    followUpStatus: body.data.followUpStatus,
    assignedOwnerId: body.data.assignedOwnerId,
  });
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    mutateConvoResponseSchema.parse({
      ok: true,
      convo: serializeConvoListItem(item),
    })
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleGetConvo(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handlePatchConvo(req, context);
}
