/**
 * DELETE /api/knowledge/files/[id]
 * Delete a knowledge file and all its associated chunks.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSupabaseClient } from "@/lib/supabase-client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant" },
        { status: 401 }
      );
    }

    // Fetch file (tenant-scoped)
    const [file] = await db
      .select()
      .from(knowledgeFiles)
      .where(
        and(
          eq(knowledgeFiles.id, id),
          eq(knowledgeFiles.tenantId, tenant.id)
        )
      )
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from Supabase Storage
    const supabase = getSupabaseClient();
    const { error: deleteError } = await supabase.storage
      .from("knowledge-files")
      .remove([file.storagePath]);

    if (deleteError) {
      console.error("Supabase delete error:", deleteError);
      // Continue anyway — we still want to clean up DB records
    }

    // Delete knowledge_items chunks (cascade will also work via DB constraints)
    await db
      .delete(knowledgeItems)
      .where(eq(knowledgeItems.parentId, file.id));

    // Delete file record
    await db.delete(knowledgeFiles).where(eq(knowledgeFiles.id, file.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("DELETE /api/knowledge/files/[id] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
