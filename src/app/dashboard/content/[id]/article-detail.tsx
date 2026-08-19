import Link from "next/link";
import { marked } from "marked";

import type { BlogPostDetail } from "@/lib/blog/queries";

import { BlogPostStatusPill } from "../content-list";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nestedRecord(source: JsonRecord, key: string): JsonRecord {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) return Number(value);
  return null;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "None" : value;
}

function metadataDecision(metadata: JsonRecord): JsonRecord {
  const direct = nestedRecord(metadata, "decision");
  if (Object.keys(direct).length > 0) return direct;

  const generation = nestedRecord(metadata, "generation");
  const generationDecision = nestedRecord(generation, "decision");
  if (Object.keys(generationDecision).length > 0) return generationDecision;

  const failure = nestedRecord(metadata, "generation_failure");
  return nestedRecord(failure, "decision");
}

function failureDetails(metadata: JsonRecord) {
  const failure = nestedRecord(metadata, "generation_failure");
  const decision = nestedRecord(failure, "decision");

  return {
    reason: stringValue(failure.reason) ?? "Article generation failed.",
    decision,
    failedAt: stringValue(failure.failedAt),
    logId:
      stringValue(failure.log_id) ??
      stringValue(failure.logId) ??
      stringValue(decision.log_id) ??
      stringValue(decision.logId),
  };
}

function similarPosts(decision: JsonRecord): Array<{
  title: string;
  score: number | null;
}> {
  const raw = decision.similar_posts;
  if (!Array.isArray(raw)) return [];

  return raw.filter(isRecord).map((post) => ({
    title:
      stringValue(post.title) ??
      stringValue(post.slug) ??
      stringValue(post.blog_post_id) ??
      stringValue(post.id) ??
      "Untitled article",
    score: numberValue(post.score),
  }));
}

function relinkExternalAnchors(html: string) {
  return html.replace(/<a\b([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi, (match) => {
    const hasRel = /\srel\s*=/.test(match);
    const hasTarget = /\starget\s*=/.test(match);
    const rel = hasRel ? "" : ' rel="noopener noreferrer"';
    const target = hasTarget ? "" : ' target="_blank"';
    return match.replace(/>$/, `${rel}${target}>`);
  });
}

function safeTrustedHtml(html: string) {
  // TODO(XSS-hardening): swap this for DOMPurify or sanitize-html if the repo adds one.
  return relinkExternalAnchors(
    html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""),
  );
}

function bodyFragment(html: string) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

async function articleBodyHtml(post: BlogPostDetail) {
  const bodyHtml =
    stringValue(post.metadata.body_html) ??
    stringValue(post.metadata.bodyHtml);

  if (bodyHtml) return safeTrustedHtml(bodyFragment(bodyHtml));

  const bodyMd =
    stringValue(post.metadata.body_md) ??
    stringValue(post.metadata.bodyMarkdown) ??
    stringValue(post.metadata.body_markdown);

  if (bodyMd) {
    return safeTrustedHtml(await marked.parse(bodyMd));
  }

  return post.content ? safeTrustedHtml(bodyFragment(post.content)) : "";
}

function extractMeta(content: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\s+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  return stringValue(content.match(pattern)?.[1]);
}

function extractCanonical(content: string) {
  return stringValue(
    content.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i)?.[1],
  );
}

function extractJsonLd(content: string) {
  return stringValue(
    content.match(
      /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    )?.[1],
  );
}

function seoFields(post: BlogPostDetail) {
  const seo = nestedRecord(post.metadata, "seo");
  return {
    metaTitle:
      stringValue(seo.metaTitle) ??
      stringValue(seo.title) ??
      stringValue(post.metadata.meta_title) ??
      post.title,
    metaDescription:
      stringValue(seo.metaDescription) ??
      stringValue(post.metadata.meta_description) ??
      extractMeta(post.content, "description"),
    canonicalUrl:
      stringValue(seo.canonicalUrl) ??
      stringValue(post.metadata.canonical_url) ??
      extractCanonical(post.content),
    ogTitle:
      stringValue(seo.ogTitle) ??
      stringValue(post.metadata.og_title) ??
      extractMeta(post.content, "og:title"),
    ogDescription:
      stringValue(seo.ogDescription) ??
      stringValue(post.metadata.og_description) ??
      extractMeta(post.content, "og:description"),
    ogImage:
      stringValue(seo.ogImage) ??
      stringValue(post.metadata.og_image) ??
      extractMeta(post.content, "og:image"),
    jsonLd:
      stringValue(post.metadata.json_ld) ??
      stringValue(post.metadata.jsonLd) ??
      stringValue(seo.jsonLd) ??
      extractJsonLd(post.content),
  };
}

function wordCount(post: BlogPostDetail) {
  return (
    numberValue(post.metadata.word_count) ??
    numberValue(post.metadata.wordCount) ??
    null
  );
}

function DetailItem({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{displayValue(value)}</dd>
    </div>
  );
}

function DisabledAction({ children, tooltip }: { children: string; tooltip: string }) {
  return (
    <button
      type="button"
      disabled
      title={tooltip}
      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400"
    >
      {children}
    </button>
  );
}

function FailureState({ post }: { post: BlogPostDetail }) {
  const failure = failureDetails(post.metadata);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h1 className="text-3xl font-bold text-red-900">
          Article generation failed
        </h1>
        <p className="mt-2 text-sm text-red-800">{failure.reason}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Decision</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem
            label="Primary keyword"
            value={stringValue(failure.decision.primary_keyword) ?? post.persona}
          />
          <DetailItem
            label="Intent"
            value={stringValue(failure.decision.intent) ?? post.topic}
          />
          <DetailItem label="Log ID" value={failure.logId} />
          <DetailItem label="Failed at" value={failure.failedAt} />
        </dl>
      </section>

      <DisabledAction tooltip="Coming in CON-276">Retry</DisabledAction>
    </div>
  );
}

export async function ArticleDetailView({ post }: { post: BlogPostDetail }) {
  if (post.status === "generation_failed") {
    return <FailureState post={post} />;
  }

  const decision = metadataDecision(post.metadata);
  const seo = seoFields(post);
  const body = await articleBodyHtml(post);
  const similar = similarPosts(decision);
  const count = wordCount(post);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <BlogPostStatusPill status={post.status} />
          <span>{formatDate(post.createdAt)}</span>
          {count !== null ? <span>{count.toLocaleString("en-AU")} words</span> : null}
          {post.topic ? <span>{post.topic}</span> : null}
          {post.persona ? <span>{post.persona}</span> : null}
        </div>
      </header>

      <dl className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <DetailItem
          label="Primary keyword"
          value={stringValue(decision.primary_keyword) ?? post.persona}
        />
        <DetailItem label="Intent" value={stringValue(decision.intent) ?? post.topic} />
      </dl>

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
          SEO
        </summary>
        <dl className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2">
          <DetailItem label="Meta title" value={seo.metaTitle} />
          <DetailItem label="Meta description" value={seo.metaDescription} />
          <DetailItem label="Canonical URL" value={seo.canonicalUrl} />
          <DetailItem label="OG title" value={seo.ogTitle} />
          <DetailItem label="OG description" value={seo.ogDescription} />
          <DetailItem label="OG image" value={seo.ogImage} />
        </dl>
        <div className="border-t border-slate-100 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            JSON-LD
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">
            {seo.jsonLd ?? "None"}
          </pre>
        </div>
      </details>

      <article
        className="prose prose-slate max-w-none [&_img]:mx-auto [&_img]:w-auto [&_img]:max-h-[400px] [&_.gh-blog-site-header__logo_img]:max-h-[36px] [&_.gh-blog-article-hero__image_img]:max-h-[280px] [&_.gh-blog-article-hero__image_img]:rounded-lg"
        dangerouslySetInnerHTML={{ __html: body }}
      />

      {similar.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Similar posts</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {similar.map((post, index) => (
              <li key={`${post.title}-${index}`} className="flex justify-between gap-4">
                <span>{post.title}</span>
                <span className="text-slate-500">
                  {post.score === null ? "No score" : post.score.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {post.threadId ? (
        <Link
          href={`/dashboard/conversations/${post.threadId}`}
          className="inline-flex text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          View source conversation
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {["Approve", "Reject", "Edit", "Publish"].map((action) => (
          <DisabledAction key={action} tooltip="Coming in CON-107 / CON-111">
            {action}
          </DisabledAction>
        ))}
      </div>
    </div>
  );
}
