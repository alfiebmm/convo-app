import { NextRequest, NextResponse } from "next/server";

import {
  getDefaultConvosStore,
} from "@/lib/convos";
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

export async function handleGenerateSummary(
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

  // TODO(CON-121): wire finalisation/on-demand AI summary generation.
  return NextResponse.json(
    { error: "not_implemented", summary: null },
    { status: 501 }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleGenerateSummary(req, context);
}
