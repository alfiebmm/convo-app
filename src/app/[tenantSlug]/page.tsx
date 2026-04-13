import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublishedContent, getTopicsForTenant } from "@/lib/db/queries";
import { APP_CONFIG } from "@/config/app";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ page?: string; topic?: string; q?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return {};

  const title = `${tenant.name} — Knowledge Hub`;
  const description = `Browse answers, guides, and articles from ${tenant.name}. Find helpful content powered by real conversations.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${APP_CONFIG.url}/${tenantSlug}`,
      siteName: tenant.name,
    },
    alternates: {
      types: {
        "application/rss+xml": `${APP_CONFIG.url}/${tenantSlug}/feed.xml`,
      },
    },
  };
}

function getExcerpt(body: string | null, maxLength = 160): string {
  if (!body) return "";
  // Strip markdown syntax for excerpt
  const plain = body
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLength ? plain.slice(0, maxLength) + "…" : plain;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    blog: "bg-blue-50 text-blue-700 ring-blue-600/10",
    faq: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    page_section: "bg-purple-50 text-purple-700 ring-purple-600/10",
  };
  const labels: Record<string, string> = {
    blog: "Article",
    faq: "FAQ",
    page_section: "Guide",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        colors[type] ?? "bg-slate-50 text-slate-700 ring-slate-600/10"
      }`}
    >
      {labels[type] ?? type}
    </span>
  );
}

export default async function TenantHubPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) notFound();

  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const topicSlug = sp.topic || undefined;
  const search = sp.q || undefined;

  const [result, allTopics] = await Promise.all([
    getPublishedContent(tenant.id, { page, perPage: 12, topicSlug, search }),
    getTopicsForTenant(tenant.id),
  ]);

  const { items, totalPages } = result;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Knowledge Hub
        </h1>
        <p className="mt-2 text-lg text-slate-500">
          Answers, guides, and articles from real conversations.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <form method="GET" className="flex-1">
          {topicSlug && <input type="hidden" name="topic" value={topicSlug} />}
          <input
            type="search"
            name="q"
            placeholder="Search articles…"
            defaultValue={search ?? ""}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        {/* Topic filter */}
        {allTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Link
              href={`/${tenantSlug}${search ? `?q=${encodeURIComponent(search)}` : ""}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !topicSlug
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </Link>
            {allTopics.map((t) => (
              <Link
                key={t.id}
                href={`/${tenantSlug}?topic=${t.slug}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  topicSlug === t.slug
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Content Grid */}
      {items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-slate-400 text-lg">No articles found.</p>
          {(search || topicSlug) && (
            <Link
              href={`/${tenantSlug}`}
              className="mt-3 inline-block text-sm text-blue-500 hover:text-blue-600"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${tenantSlug}/${item.slug}`}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <TypeBadge type={item.type} />
                {item.publishedAt && (
                  <time
                    dateTime={item.publishedAt.toISOString()}
                    className="text-xs text-slate-400"
                  >
                    {new Intl.DateTimeFormat("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(item.publishedAt)}
                  </time>
                )}
              </div>
              <h2 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500 line-clamp-3">
                {item.metaDescription || getExcerpt(item.body)}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/${tenantSlug}?page=${page - 1}${topicSlug ? `&topic=${topicSlug}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/${tenantSlug}?page=${page + 1}${topicSlug ? `&topic=${topicSlug}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
