/**
 * PUT /api/settings/test-webflow
 *
 * Tests Webflow connection by listing collections for the site.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testWebflowConnection } from "@/lib/publishing/webflow";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const { siteId, accessToken } = body as {
    siteId?: string;
    accessToken?: string;
  };

  if (!siteId || !accessToken) {
    return NextResponse.json(
      { error: "siteId and accessToken are required" },
      { status: 400 }
    );
  }

  const result = await testWebflowConnection({ siteId, accessToken });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    collections: result.collections,
  });
}
