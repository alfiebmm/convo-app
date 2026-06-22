/**
 * PUT /api/settings/test-shopify
 *
 * Tests Shopify connection by listing available blogs.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withApiErrorLogging } from "@/lib/errors/wrap";
import { testShopifyConnection } from "@/lib/publishing/shopify";

async function putImpl(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export const PUT = withApiErrorLogging(putImpl, {
  route: "/api/settings/test-shopify",
});
