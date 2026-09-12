import { NextRequest, NextResponse } from "next/server";

import { canMutateCases } from "@/lib/auth/permissions";
import {
  getDefaultConvosStore,
  type ConvoNote,
} from "@/lib/convos";
import { createConvoNoteBodySchema, createConvoNoteResponseSchema } from "@/lib/convos/schemas";
import {
  resolveConvosContext,
  type ConvosRouteDeps,
} from "../../route";
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

function serializeNote(note: ConvoNote) {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function handlePostConvoNote(
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
  const body = createConvoNoteBodySchema.safeParse(raw);
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { id } = await params;
  const note = await deps.store.appendNote(
    context.tenantId,
    id,
    body.data.body,
    context.userId
  );
  if (!note) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    createConvoNoteResponseSchema.parse({ ok: true, note: serializeNote(note) }),
    { status: 201 }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handlePostConvoNote(req, context);
}
