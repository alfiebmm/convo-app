/**
 * PUT /api/settings/test-generic
 *
 * Tests a generic/custom CMS connection by sending a GET to the base URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { testGenericConnection } from "@/lib/publishing/generic";

export async function PUT(req: NextRequest) {
  const body = await req.json();

  const { endpoint, headers, authType, authValue } = body as {
    endpoint?: string;
    headers?: Record<string, string>;
    authType?: string;
    authValue?: string;
  };

  if (!endpoint) {
    return NextResponse.json(
      { error: "endpoint is required" },
      { status: 400 }
    );
  }

  const result = await testGenericConnection({
    endpoint,
    headers: headers ?? {},
    authType: (authType as "none" | "basic" | "bearer" | "custom") ?? "none",
    authValue,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
