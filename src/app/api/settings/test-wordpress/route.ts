/**
 * PUT /api/settings/test-wordpress
 *
 * Tests WordPress connection by hitting the WP REST API.
 */
import { NextRequest, NextResponse } from "next/server";
import { testWordPressConnection, type WPConfig } from "@/lib/publishing/wordpress";

export async function PUT(req: NextRequest) {
  const body = await req.json();

  const { siteUrl, username, applicationPassword } = body as WPConfig;

  if (!siteUrl || !username || !applicationPassword) {
    return NextResponse.json(
      { error: "siteUrl, username, and applicationPassword are required" },
      { status: 400 }
    );
  }

  const result = await testWordPressConnection({
    siteUrl,
    username,
    applicationPassword,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
