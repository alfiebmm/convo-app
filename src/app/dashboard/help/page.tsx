import {
  DashboardHelpCard,
  resourceCategoryLabel,
} from "@/components/resources/resource-article-view";
import { ResourceSearch } from "@/components/resources/resource-search";
import type { ResourceAudience } from "@/lib/resources/content";
import {
  dashboardHelpArticles,
  getArticlesByCategory,
} from "@/lib/resources/content";

export default function DashboardHelpPage() {
  const grouped = getArticlesByCategory(dashboardHelpArticles);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
            Help centre
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Convo setup, help, and troubleshooting
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Guides for setting up the assistant, managing conversations and
            contacts, reviewing content, publishing, and fixing common website
            issues.
          </p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-[var(--convo-orange)]">
          {dashboardHelpArticles.length} guides
        </div>
      </div>

      <div className="mt-6">
        <ResourceSearch
          articles={dashboardHelpArticles}
          basePath="/dashboard/help"
          placeholder="Try widget not appearing, documents, follow-up rules, publishing..."
          variant="dashboard"
        />
      </div>

      <div className="mt-8 space-y-8">
        {Object.entries(grouped)
          .filter(([, articles]) => articles.length > 0)
          .map(([category, articles]) => (
            <section key={category}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {resourceCategoryLabel(category as ResourceAudience)}
                </h2>
                <span className="text-xs font-medium text-slate-400">
                  {articles.length} guides
                </span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {articles.map((article) => (
                  <DashboardHelpCard key={article.slug} article={article} />
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
