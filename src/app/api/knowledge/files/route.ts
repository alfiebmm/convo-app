/**
 * POST /api/knowledge/files - Upload a file to tenant knowledge base
 * GET  /api/knowledge/files - List tenant knowledge files with stats
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getCurrentTenant } from "@/lib/auth-context";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeItems } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSupabaseClient } from "@/lib/supabase-client";
import { ingestFile } from "@/lib/knowledge/file-ingest";
import { randomUUID } from "crypto";

// Force Node runtime: pdf-parse, mammoth, and Supabase service-role client all
// need full Node APIs. Edge runtime would 500 here.
export const runtime = "nodejs";
// Upload + DB insert is fast (<5s); ingestion runs in `after()` and can use the
// full waitUntil budget on Vercel Pro (~5min). Bumping this only affects the
// foreground request — kept short so the user sees the 201 quickly.
export const maxDuration = 30;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

/**
 * GET /api/knowledge/files
 * List all knowledge files for the current tenant with chunk counts.
 */
export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant" },
        { status: 401 }
      );
    }

    // Fetch files with chunk counts
    const filesWithCounts = await db
      .select({
        id: knowledgeFiles.id,
        originalFilename: knowledgeFiles.originalFilename,
        mimeType: knowledgeFiles.mimeType,
        byteSize: knowledgeFiles.byteSize,
        status: knowledgeFiles.status,
        uploadedAt: knowledgeFiles.uploadedAt,
        indexedAt: knowledgeFiles.indexedAt,
        errorMessage: knowledgeFiles.errorMessage,
        chunksIndexed: sql<number>`COUNT(${knowledgeItems.id})`.as(
          "chunks_indexed"
        ),
      })
      .from(knowledgeFiles)
      .leftJoin(
        knowledgeItems,
        eq(knowledgeItems.parentId, knowledgeFiles.id)
      )
      .where(eq(knowledgeFiles.tenantId, tenant.id))
      .groupBy(knowledgeFiles.id)
      .orderBy(sql`${knowledgeFiles.uploadedAt} DESC`);

    return NextResponse.json({ files: filesWithCounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/knowledge/files error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/knowledge/files
 * Upload a file and trigger background ingestion.
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: PDF, DOCX, TXT. Got: ${file.type}`,
        },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max: 20MB. Got: ${file.size} bytes` },
        { status: 400 }
      );
    }

    // Generate storage path
    const fileId = randomUUID();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `tenants/${tenant.id}/${fileId}-${sanitizedFilename}`;

    // Upload to Supabase Storage
    const supabase = getSupabaseClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("knowledge-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Insert file record
    const [fileRecord] = await db
      .insert(knowledgeFiles)
      .values({
        id: fileId,
        tenantId: tenant.id,
        originalFilename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        storagePath,
        status: "pending",
      })
      .returning();

    // Run ingestion AFTER the response is sent so Vercel keeps the function
    // alive via `waitUntil`. `setImmediate` would be cut off when the function
    // freezes, leaving the file stuck on status='pending' forever.
    after(async () => {
      try {
        await ingestFile(fileId);
      } catch (err) {
        console.error(`[Knowledge] Background ingestion failed for ${fileId}:`, err);
      }
    });

    return NextResponse.json(
      {
        success: true,
        file: {
          id: fileRecord.id,
          filename: fileRecord.originalFilename,
          status: fileRecord.status,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/knowledge/files error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
