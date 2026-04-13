/**
 * PUT /api/settings/test-shopify
 *
 * Tests Shopify connection by listing available blogs.
 */
import { NextRequest, NextResponse } from "next/server";
import { testShopifyConnection } from "@/lib/publishing/shopify";

export async function PUT(req: NextRequest) {
  const body = await req.json();

  const { shopDomain, accessToken } = body as {
    shopDomain?: string;
    accessToken?: string;
  };

  if (!shopDomain || !accessToken) {
    return NextResponse.json(
      { error: "shopDomain and accessToken are required" },
      { status: 400 }
    );
  }

  const result = await testShopifyConnection({ shopDomain, accessToken });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, blogs: result.blogs });
}
