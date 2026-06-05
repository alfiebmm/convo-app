import { getCurrentTenant } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { FileUploadZone } from "../file-upload-zone";
import { FileList } from "../file-list";
import { WebsiteContent } from "../website-content";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeItems } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

export default async function KnowledgePage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/onboarding");

  // Fetch files with chunk counts. Same bigint-as-string trap as above — cast
  // to int so the file-list UI sees a real number for chunksIndexed.
  const files = await db
    .select({
      id: knowledgeFiles.id,
      originalFilename: knowledgeFiles.originalFilename,
      mimeType: knowledgeFiles.mimeType,
      byteSize: knowledgeFiles.byteSize,
      status: knowledgeFiles.status,
      uploadedAt: knowledgeFiles.uploadedAt,
      indexedAt: knowledgeFiles.indexedAt,
      errorMessage: knowledgeFiles.errorMessage,
      chunksIndexed: sql<number>`COUNT(${knowledgeItems.id})::int`.as(
        "chunks_indexed"
      ),
    })
    .from(knowledgeFiles)
    .leftJoin(knowledgeItems, eq(knowledgeItems.parentId, knowledgeFiles.id))
    .where(eq(knowledgeFiles.tenantId, tenant.id))
    .groupBy(knowledgeFiles.id)
    .orderBy(sql`${knowledgeFiles.uploadedAt} DESC`);

  // Fetch website indexing stats. NOTE: COUNT(...) returns Postgres bigint which
  // the `pg` driver serializes as a string ("0", "42"). Cast to integer in SQL
  // so the typed result is actually a number — otherwise downstream strict
  // equality (pagesIndexed === 0) silently fails and the status pill misreads.
  const [websiteStats] = await db
    .select({
      pagesIndexed: sql<number>`COUNT(DISTINCT ${knowledgeItems.sourceUrl})::int`.as(
        "pages_indexed"
      ),
      lastSynced: sql<Date | null>`MAX(${knowledgeItems.lastSyncedAt})`.as(
        "last_synced"
      ),
    })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenant.id),
        eq(knowledgeItems.type, "page")
      )
    );

  return (
    <div>
      {/* Website Content Section (CON-85) */}
      <div>
        <WebsiteContent
          domain={tenant.domain}
          pagesIndexed={websiteStats?.pagesIndexed || 0}
          lastSynced={websiteStats?.lastSynced}
          nowMs={Date.now()}
        />
      </div>

      {/* File Upload Section (CON-87) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Upload Documents</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload PDF, DOCX, or TXT files to expand your knowledge base.
        </p>
      </div>

      <div className="mt-4">
        <FileUploadZone />
      </div>

      {files.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No files uploaded yet. Upload PDF, DOCX, or TXT files to get
            started.
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <FileList files={files} />
        </div>
      )}

      {/* TODO (CON-89): Integrate retrieval into chat API */}
      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>Next step:</strong> File chunks are indexed and ready.
          Retrieval integration into the chat API is tracked in{" "}
          <span className="font-mono">CON-89</span>.
        </p>
      </div>
    </div>
  );
}
