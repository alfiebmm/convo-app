"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ResourceArticle } from "@/lib/resources/content";
import { resourceCategoryLabel } from "./resource-article-view";

type ResourceSearchProps = {
  articles: ResourceArticle[];
  basePath: "/resources" | "/dashboard/help";
  placeholder: string;
  variant?: "marketing" | "dashboard";
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "and",
  "are",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "where",
  "why",
  "with",
]);

export function ResourceSearch({
  articles,
  basePath,
  placeholder,
  variant = "marketing",
}: ResourceSearchProps) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => rankArticles(articles, trimmedQuery).slice(0, 6),
    [articles, trimmedQuery]
  );
  const isDashboard = variant === "dashboard";

  return (
    <section
      aria-label="Search guides"
      className={
        isDashboard
          ? "rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          : "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      }
    >
      <label
        htmlFor={`resource-search-${basePath}`}
        className={
          isDashboard
            ? "text-sm font-semibold text-slate-900"
            : "font-display text-lg font-bold text-zinc-950"
        }
      >
        Ask a question or search a topic
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={`resource-search-${basePath}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className={
            isDashboard
              ? "min-h-11 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
              : "min-h-12 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          }
        />
        {trimmedQuery ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className={
              isDashboard
                ? "min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:text-[var(--convo-orange)]"
                : "min-h-12 rounded-lg border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-orange-200 hover:text-[var(--convo-orange)]"
            }
          >
            Clear
          </button>
        ) : null}
      </div>

      {trimmedQuery ? (
        <div className="mt-5">
          <p
            className={
              isDashboard
                ? "text-xs font-semibold uppercase tracking-[0.12em] text-slate-400"
                : "text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400"
            }
          >
            {results.length > 0
              ? `Most relevant guides (${results.length})`
              : "No close matches"}
          </p>

          {results.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {results.map((result) => (
                <Link
                  key={result.article.slug}
                  href={`${basePath}/${result.article.slug}`}
                  className={
                    isDashboard
                      ? "rounded-lg border border-slate-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40"
                      : "rounded-lg border border-zinc-200 p-4 transition hover:border-orange-200 hover:bg-orange-50/40"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[var(--convo-orange)]">
                      {resourceCategoryLabel(result.article.category)}
                    </span>
                    <span
                      className={
                        isDashboard
                          ? "text-xs font-medium text-slate-400"
                          : "text-xs font-medium text-zinc-400"
                      }
                    >
                      {result.reason}
                    </span>
                  </div>
                  <h3
                    className={
                      isDashboard
                        ? "mt-2 text-base font-bold leading-snug text-slate-950"
                        : "mt-2 text-base font-bold leading-snug text-zinc-950"
                    }
                  >
                    {result.article.title}
                  </h3>
                  <p
                    className={
                      isDashboard
                        ? "mt-1 text-sm leading-6 text-slate-600"
                        : "mt-1 text-sm leading-6 text-zinc-600"
                    }
                  >
                    {result.article.description}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p
              className={
                isDashboard
                  ? "mt-3 text-sm leading-6 text-slate-500"
                  : "mt-3 text-sm leading-6 text-zinc-600"
              }
            >
              Try a shorter phrase like widget, booking forms, security, content,
              publishing, leads, or knowledge.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

type SearchResult = {
  article: ResourceArticle;
  score: number;
  reason: string;
};

function rankArticles(articles: ResourceArticle[], query: string): SearchResult[] {
  const terms = tokenize(query);

  if (terms.length === 0) {
    return [];
  }

  return articles
    .map((article) => scoreArticle(article, terms, query))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
}

function scoreArticle(
  article: ResourceArticle,
  terms: string[],
  rawQuery: string
): SearchResult {
  let score = 0;
  let reason = "Topic match";
  const normalizedQuery = normalize(rawQuery);

  const weightedFields: Array<{
    label: string;
    weight: number;
    value: string;
  }> = [
    { label: "Title match", weight: 14, value: article.title },
    { label: "FAQ match", weight: 10, value: article.faqs.map((faq) => `${faq.question} ${faq.answer}`).join(" ") },
    { label: "Keyword match", weight: 9, value: [article.primaryKeyword, ...article.secondaryKeywords].join(" ") },
    { label: "Summary match", weight: 7, value: `${article.description} ${article.quickAnswer} ${article.intent}` },
    { label: "Guide content match", weight: 4, value: article.sections.map((section) => `${section.heading} ${section.body} ${section.bullets.join(" ")}`).join(" ") },
  ];

  for (const field of weightedFields) {
    const normalizedValue = normalize(field.value);

    if (normalizedValue.includes(normalizedQuery)) {
      score += field.weight * 3;
      reason = field.label;
      continue;
    }

    const matches = terms.filter((term) => normalizedValue.includes(term)).length;
    if (matches > 0) {
      score += matches * field.weight;
      reason = field.label;
    }
  }

  return { article, score, reason };
}

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
