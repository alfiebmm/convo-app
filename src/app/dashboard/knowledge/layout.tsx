import Link from "next/link";
import { KnowledgeTabs } from "./tabs";

/**
 * Knowledge section layout — introduces sub-tab navigation.
 *
 * Tabs:
 *   - Documents  → /dashboard/knowledge/documents (existing K-01/K-06 surface)
 *   - Follow-up  → /dashboard/knowledge/follow-up (CON-158, read-only V1)
 *
 * The tab strip itself is a small client component (`./tabs.tsx`) so it can
 * read `usePathname()` to highlight the active tab. Everything else here is
 * pure server output.
 *
 * CON-158 (Epic A2 — Configurable Follow-Up program, CON-149).
 */
export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage what your chatbot knows and how it follows up with visitors.
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="hidden text-xs text-slate-500 hover:text-slate-900 sm:block"
        >
          ⚙ Site settings
        </Link>
      </div>

      <div className="mt-6 border-b border-slate-200">
        <KnowledgeTabs />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
