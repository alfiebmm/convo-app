/**
 * PUT /api/settings/test-webflow
 *
 * Tests Webflow connection by listing collections for the site.
 */
import { NextRequest, NextResponse } from "next/server";
import { testWebflowConnection } from "@/lib/publishing/webflow";

export async function PUT(req: NextRequest) {
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
