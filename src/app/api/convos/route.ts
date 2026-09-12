import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  getActiveTenantIdForUser,
  getTenantMembership,
} from "@/lib/auth-context";
import {
  getDefaultConvosStore,
  type ConvoListItem,
  type ConvosStore,
} from "@/lib/convos";
import {
  listConvosQuerySchema,
  listConvosResponseSchema,
} from "@/lib/convos/schemas";

export interface ConvosRouteDeps {
  auth: () => Promise<{ user?: { id?: string | null } } | null>;
  getActiveTenantIdForUser: typeof getActiveTenantIdForUser;
  getTenantMembership: typeof getTenantMembership;
  store: ConvosStore;
}

const defaultDeps: ConvosRouteDeps = {
  auth,
  getActiveTenantIdForUser,
  getTenantMembership,
  store: getDefaultConvosStore(),
};

function iso(date: Date): string {
  return date.toISOString();
}

export function serializeConvoListItem(item: ConvoListItem) {
  return {
    ...item,
    startedAt: iso(item.startedAt),
    lastActivityAt: iso(item.lastActivityAt),
  };
}

export async function resolveConvosContext(deps: ConvosRouteDeps): Promise<
  | {
      tenantId: string;
      userId: string;
      membership: NonNullable<
        Awaited<ReturnType<typeof getTenantMembership>>
      >;
    }
  | { response: NextResponse }
> {
  const session = await deps.auth();
  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const tenantId = await deps.getActiveTenantIdForUser(session.user.id);
  if (!tenantId) {
    return {
      response: NextResponse.json({ error: "not_found" }, { status: 404 }),
    };
  }
  const membership = await deps.getTenantMembership(session.user.id, tenantId);
  if (!membership) {
    return {
      response: NextResponse.json({ error: "not_found" }, { status: 404 }),
    };
  }
  return { tenantId, userId: session.user.id, membership };
}

export async function handleGetConvos(
  req: Pick<NextRequest, "nextUrl">,
  deps: ConvosRouteDeps = defaultDeps
) {
  const context = await resolveConvosContext(deps);
  if ("response" in context) return context.response;

  const query = listConvosQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!query.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const result = await deps.store.listConvos(context.tenantId, query.data);
  const payload = listConvosResponseSchema.parse({
    items: result.items.map(serializeConvoListItem),
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      nextOffset: result.nextOffset,
    },
  });

  return NextResponse.json(payload);
}

export async function GET(req: NextRequest) {
  return handleGetConvos(req);
}
