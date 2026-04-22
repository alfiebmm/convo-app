import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/widget/config?tenant=<tenantId>
 *
 * Public endpoint that returns the widget-safe portion of tenant settings
 * so the embedded widget can reflect dashboard changes without the site
 * owner needing to edit their <script> embed every time.
 *
 * Only exposes fields that are already visible to any visitor (colour,
 * welcome message, chatbot name). Does NOT expose systemPrompt,
 * allowedTopics, or any private guardrails config — those stay on the
 * server and are enforced in /api/chat.
 *
 * CORS: wide open because the widget is cross-origin by design.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // Short cache so dashboard edits propagate within ~30s, but we don't hammer DB
  "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
};

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenant");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenant query param required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const widget = (settings.widget as Record<string, unknown> | undefined) ?? {};

    // Only public-safe fields. Use the chatbot-facing name if set, else fall
    // back to the tenant name.
    const name =
      (typeof widget.chatbotName === "string" && widget.chatbotName.trim()) ||
      tenant.name ||
      "Convo";

    const welcome =
      (typeof widget.welcomeMessage === "string" && widget.welcomeMessage.trim()) ||
      null;

    const color =
      (typeof widget.primaryColor === "string" && widget.primaryColor.trim()) ||
      null;

    return NextResponse.json(
      {
        name,
        welcome,
        color,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("widget config error", err);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
