import { redirect } from "next/navigation";

/**
 * /dashboard/knowledge is now a tabbed surface (Documents, Follow-up).
 * Default the bare URL to the Documents tab so existing bookmarks keep
 * working unchanged.
 *
 * CON-158 (Epic A2).
 */
export default function KnowledgeIndexPage() {
  redirect("/dashboard/knowledge/documents");
}
