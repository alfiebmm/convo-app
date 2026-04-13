import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { marked } from "marked";
import {
  getTenantBySlug,
  getContentBySlug,
  getRelatedContent,
  getTopicById,
} from "@/lib/db/queries";
import { APP_CONFIG } from "@/config/app";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ tenantSlug: string; contentSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug, contentSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return {};

  const item = await getContentBySlug(tenant.id, contentSlug);
  if (!item) return {};

  const url = `${APP_CONFIG.url}/${tenantSlug}/${contentSlug}`;
  const title = item.title || "Untitled";
  const description = item.metaDescription || `Read about ${title} on ${tenant.name}`;

  return {
    title: `${title} — ${tenant.name}`,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: tenant.name,
      publishedTime: item.publishedAt?.toISOString(),
      modifiedTime: item.updatedAt.toISOString(),
    },
  };
}

function ShareButtons({ url, title }: { url: string; title: string }) {
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Share</span>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Post
      </a>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors copy-link-btn"
        data-url={url}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
        Copy link
      </button>
    </div>
  );
}

function FeedbackWidget() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">Was this helpful?</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          👍 Yes
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          👎 Not really
        </button>
      </div>
    </div>
  );
}

export default async function ContentArticlePage({ params }: PageProps) {
  const { tenantSlug, contentSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const item = await getContentBySlug(tenant.id, contentSlug);
  if (!item) notFound();

  const [related, topic] = await Promise.all([
    getRelatedContent(tenant.id, item.topicId, item.id),
    item.topicId ? getTopicById(item.topicId) : null,
  ]);

  const htmlBody = item.body ? await marked.parse(item.body) : "";
  const articleUrl = `${APP_CONFIG.url}/${tenantSlug}/${contentSlug}`;
  const title = item.title || "Untitled";

  // Build JSON-LD
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": item.type === "faq" ? "FAQPage" : "Article",
    headline: title,
    description: item.metaDescription || "",
    url: articleUrl,
    datePublished: item.publishedAt?.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    publisher: {
      "@type": "Organization",
      name: tenant.name,
    },
  };

  // For FAQ type, try to extract Q&A pairs from markdown
  if (item.type === "faq" && item.body) {
    const faqEntities = extractFaqEntities(item.body);
    if (faqEntities.length > 0) {
      jsonLd.mainEntity = faqEntities;
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Copy link script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('click', function(e) {
              var btn = e.target.closest('.copy-link-btn');
              if (btn) {
                navigator.clipboard.writeText(btn.dataset.url || window.location.href);
                var orig = btn.innerHTML;
                btn.textContent = '✓ Copied!';
                setTimeout(function() { btn.innerHTML = orig; }, 2000);
              }
            });
          `,
        }}
      />

      <article className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumbs */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <Link href={`/${tenantSlug}`} className="hover:text-slate-600 transition-colors">
            {tenant.name}
          </Link>
          <span>/</span>
          <Link href={`/${tenantSlug}`} className="hover:text-slate-600 transition-colors">
            Hub
          </Link>
          <span>/</span>
          <span className="text-slate-600 truncate max-w-xs">{title}</span>
        </nav>

        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-12">
          {/* Article body */}
          <div className="min-w-0">
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <TypeBadge type={item.type} />
                {topic && (
                  <Link
                    href={`/${tenantSlug}?topic=${topic.slug}`}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {topic.name}
                  </Link>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
                {title}
              </h1>
              {item.publishedAt && (
                <time
                  dateTime={item.publishedAt.toISOString()}
                  className="mt-3 block text-sm text-slate-400"
                >
                  Published{" "}
                  {new Intl.DateTimeFormat("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(item.publishedAt)}
                </time>
              )}
            </header>

            {/* Share buttons top */}
            <div className="mb-8">
              <ShareButtons url={articleUrl} title={title} />
            </div>

            {/* Article content */}
            <div
              className="prose prose-slate max-w-none prose-headings:tracking-tight prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />

            {/* Share buttons bottom */}
            <div className="mt-10 pt-6 border-t border-slate-200">
              <ShareButtons url={articleUrl} title={title} />
            </div>

            {/* Feedback */}
            <div className="mt-8">
              <FeedbackWidget />
            </div>

            {/* Back link */}
            <div className="mt-8">
              <Link
                href={`/${tenantSlug}`}
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← Back to Knowledge Hub
              </Link>
            </div>
          </div>

          {/* Sidebar — Related articles */}
          {related.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
                  Related Articles
                </h3>
                <div className="space-y-4">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      href={`/${tenantSlug}/${r.slug}`}
                      className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <TypeBadge type={r.type} />
                      </div>
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">
                        {r.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Related articles on mobile */}
        {related.length > 0 && (
          <div className="lg:hidden mt-10 pt-8 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Related Articles
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/${tenantSlug}/${r.slug}`}
                  className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={r.type} />
                  </div>
                  <p className="text-sm font-medium text-slate-900 line-clamp-2">
                    {r.title}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
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

/**
 * Extract FAQ Q&A pairs from markdown.
 * Expects ## headings as questions and following paragraphs as answers.
 */
function extractFaqEntities(markdown: string) {
  const lines = markdown.split("\n");
  const entities: Array<Record<string, unknown>> = [];
  let currentQuestion = "";
  let currentAnswer = "";

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentQuestion && currentAnswer.trim()) {
        entities.push({
          "@type": "Question",
          name: currentQuestion,
          acceptedAnswer: {
            "@type": "Answer",
            text: currentAnswer.trim(),
          },
        });
      }
      currentQuestion = headingMatch[1].trim();
      currentAnswer = "";
    } else {
      currentAnswer += line + "\n";
    }
  }

  // Push last
  if (currentQuestion && currentAnswer.trim()) {
    entities.push({
      "@type": "Question",
      name: currentQuestion,
      acceptedAnswer: {
        "@type": "Answer",
        text: currentAnswer.trim(),
      },
    });
  }

  return entities;
}
