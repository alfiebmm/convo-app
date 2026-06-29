import Link from "next/link";
import type { ResourceArticle, ResourceAudience } from "@/lib/resources/content";
import { getResourceArticle } from "@/lib/resources/content";

export function resourceCategoryLabel(category: ResourceAudience) {
  switch (category) {
    case "Business owners and marketers":
      return "Product education";
    case "Customer dashboard users":
      return "Setup and help";
    case "Comparison and alternatives":
      return "Comparison guides";
    case "Troubleshooting":
      return "Troubleshooting";
    case "Public website visitors":
    default:
      return "Resources";
  }
}

export function ArticleMetaPills({ article }: { article: ResourceArticle }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-[var(--convo-orange)]">
        {resourceCategoryLabel(article.category)}
      </span>
      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600">
        Guide
      </span>
    </div>
  );
}

export function PublicResourceCard({ article }: { article: ResourceArticle }) {
  return (
    <Link
      href={`/resources/${article.slug}`}
      className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        {resourceCategoryLabel(article.category)}
      </p>
      <h2 className="mt-3 font-display text-xl font-bold leading-tight text-zinc-950 group-hover:text-[var(--convo-orange)]">
        {article.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">
        {article.description}
      </p>
      <p className="mt-5 text-sm font-semibold text-[var(--convo-orange)]">
        Read guide
      </p>
    </Link>
  );
}

export function DashboardHelpCard({ article }: { article: ResourceArticle }) {
  return (
    <Link
      href={`/dashboard/help/${article.slug}`}
      className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        {resourceCategoryLabel(article.category)}
      </p>
      <h2 className="mt-2 text-lg font-bold leading-tight text-slate-950">
        {article.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {article.description}
      </p>
      <p className="mt-4 text-sm font-semibold text-[var(--convo-orange)]">
        Read guide
      </p>
    </Link>
  );
}

export function ResourceArticleView({
  article,
  allArticlesHref,
  allArticlesLabel,
  relatedHref,
}: {
  article: ResourceArticle;
  allArticlesHref: string;
  allArticlesLabel: string;
  relatedHref: (slug: string) => string;
}) {
  return (
    <article className="mx-auto max-w-5xl px-5 py-12 sm:px-8 lg:py-16">
      <Link
        href={allArticlesHref}
        className="text-sm font-semibold text-zinc-500 transition hover:text-zinc-950"
      >
        Back to {allArticlesLabel}
      </Link>

      <header className="mt-6">
        <ArticleMetaPills article={article} />
        <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-normal text-zinc-950 sm:text-5xl">
          {article.title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
          {article.description}
        </p>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
              Quick answer
            </p>
            <p className="mt-3 text-base font-semibold leading-7 text-zinc-950">
              {article.quickAnswer}
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              Who this is for
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-600">
              {article.whoThisIsFor}
            </p>
          </section>

          {article.sections.map((section) => (
            <section
              key={section.heading}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h2 className="font-display text-2xl font-bold text-zinc-950">
                {section.heading}
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {section.body}
              </p>
              <ul className="mt-5 grid gap-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-zinc-700">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[var(--convo-orange)]">
                      ✓
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              Common mistakes
            </h2>
            <ul className="mt-5 grid gap-3">
              {article.mistakes.map((mistake) => (
                <li key={mistake} className="flex gap-3 text-sm leading-6 text-zinc-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--convo-orange)]" />
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              FAQ
            </h2>
            <div className="mt-5 grid gap-4">
              {article.faqs.map((faq) => (
                <div key={faq.question} className="border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0">
                  <h3 className="font-semibold text-zinc-950">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-200">
              Next step
            </p>
            <p className="mt-3 text-xl font-bold">{article.cta}</p>
            <Link
              href="/signup"
              className="mt-5 inline-flex rounded-lg bg-[var(--convo-orange)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--convo-orange-hover)]"
            >
              Start free
            </Link>
          </div>

          {article.related.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                Related guides
              </p>
              <div className="mt-4 grid gap-3">
                {article.related.map((slug) => (
                  <Link
                    key={slug}
                    href={relatedHref(slug)}
                    className="text-sm font-semibold leading-6 text-zinc-700 transition hover:text-[var(--convo-orange)]"
                  >
                    {getResourceArticle(slug)?.title ?? slug}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
