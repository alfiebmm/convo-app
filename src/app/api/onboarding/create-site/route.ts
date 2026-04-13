/**
 * POST /api/onboarding/create-site
 *
 * Creates a new tenant and assigns the authenticated user as owner.
 * Accepts: { name, domain? }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTenant } from "@/lib/tenant";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, domain } = body;

  if (!name) {
    return NextResponse.json(
      { error: "Site name is required" },
      { status: 400 }
    );
  }

  const slug = slugify(name) + "-" + Date.now().toString(36);

  const tenant = await createTenant({
    name,
    slug,
    domain: domain || undefined,
    ownerUserId: session.user.id,
  });

  return NextResponse.json({ tenantId: tenant.id, slug: tenant.slug });
}
