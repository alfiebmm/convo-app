import { after, NextRequest, NextResponse } from "next/server";

import { requestBlogPipeline } from "@/lib/blog/trigger";
import { getConversationForVisitor } from "@/lib/conversations";
import { withApiErrorLogging } from "@/lib/errors/wrap";

export const runtime = "nodejs";

type EnqueueConversation = {
  id: string;
  status: string;
};

export type BlogEnqueueDeps = {
  getConversationForVisitor: (
    conversationId: string,
    tenantId: string,
    visitorId: string
  ) => Promise<EnqueueConversation | null>;
  requestBlogPipeline: typeof requestBlogPipeline;
  schedule: (task: () => Promise<void>) => void;
};

const defaultDeps: BlogEnqueueDeps = {
  getConversationForVisitor,
  requestBlogPipeline,
  schedule: (task) => after(task),
};

export async function handleBlogEnqueue(
  req: { json: () => Promise<unknown> },
  deps: BlogEnqueueDeps = defaultDeps
) {
  try {
    const body = await req.json();
    const { conversationId, tenantId, visitorId } = body as {
      conversationId?: string;
      tenantId?: string;
      visitorId?: string;
    };

    if (!conversationId || !tenantId || !visitorId) {
      return NextResponse.json(
        { error: "conversationId, tenantId, and visitorId are required" },
        { status: 400 }
      );
    }

    const convo = await deps.getConversationForVisitor(
      conversationId,
      tenantId,
      visitorId
    );

    if (!convo) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const result = await deps.requestBlogPipeline(conversationId, {
      source: "idle",
      tenantId,
      markCompleted: true,
      schedule: deps.schedule,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

async function postImpl(req: NextRequest) {
  return handleBlogEnqueue(req);
}

export const POST = withApiErrorLogging(postImpl, {
  route: "/api/blog/enqueue",
});

/** Handle CORS preflight for widget cross-origin requests */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
