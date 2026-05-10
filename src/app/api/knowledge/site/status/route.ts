/**
 * GET /api/knowledge/site/status
 * 
 * Returns site indexing status for the current tenant.
 * Tenant-scoped via session auth.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserTenants } from "@/lib/tenant";
import { getIndexingStatus } from "@/lib/knowledge/indexer";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Get tenant from query param or first tenant user has access to
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  
  let targetTenantId: string;
  
  if (tenantId) {
    // Verify user has access to this tenant
    const userTenants = await getUserTenants(session.user.id);
    const hasAccess = userTenants.some((t) => t.tenant.id === tenantId);
    
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    targetTenantId = tenantId;
  } else {
    // Default to first tenant
    const userTenants = await getUserTenants(session.user.id);
    
    if (userTenants.length === 0) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }
    
    targetTenantId = userTenants[0].tenant.id;
  }
  
  try {
    const status = await getIndexingStatus(targetTenantId);
    return NextResponse.json(status);
  } catch (error) {
    console.error("[API] Failed to get indexing status:", error);
    return NextResponse.json(
      { error: "Failed to retrieve status" },
      { status: 500 }
    );
  }
}
