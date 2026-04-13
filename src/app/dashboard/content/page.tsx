import { db } from "@/lib/db";
import { content } from "@/lib/db/schema";
import { eq, and, desc, type SQL } from "drizzle-orm";
import ContentList from "./content-list";
import { StatusFilter, TypeFilter } from "./content-filters";
import { Suspense } from "react";

const DEMO_TENANT_ID = "5067d163-5edd-448c-a0e6-4dc8adaccb02";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;

  const conditions: SQL[] = [eq(content.tenantId, DEMO_TENANT_ID)];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(
      eq(
        content.status,
        statusFilter as
          | "pending"
          | "generating"
          | "review"
          | "approved"
          | "published"
          | "rejected"
          | "archived"
      )
    );
  }
  if (typeFilter && typeFilter !== "all") {
    conditions.push(eq(content.type, typeFilter));
  }

  const items = await db
    .select()
    .from(content)
    .where(and(...conditions))
    .orderBy(desc(content.createdAt))
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI-generated articles from your conversations. Review, edit, and
            publish.
          </p>
        </div>
        <Suspense>
          <div className="flex gap-2">
            <StatusFilter />
            <TypeFilter />
          </div>
        </Suspense>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="p-12 text-center text-sm text-slate-400">
            No content yet. As conversations come in, the pipeline will extract
            topics and generate articles for your review.
          </div>
        </div>
      ) : (
        <ContentList items={items} />
      )}
    </div>
  );
}
