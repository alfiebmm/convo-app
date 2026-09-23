import Link from "next/link";
import { marked } from "marked";

import type { PrePublishChecklistResult } from "@/lib/blog/pre-publish-checklist";
import type { BlogPostDetail } from "@/lib/blog/queries";

import { BlogPostStatusPill } from "../content-list";
import {
  regenerateHeroImage,
  revalidatePrePublishChecklist,
  revertHeroImage,
  saveBlogPostSeo,
} from "./actions";
import { PublishBlogPostButton } from "./publish-blog-post-button";

type JsonRecord = Record<string, unknown>;
type SeoSidecar = {
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string | null;
  targetAudience: string | null;
  articleType: string | null;
  internalLinkSuggestions: Array<{ url: string; label?: string }>;
  ctaGoal: string | null;
};
type EditorialBriefRow = {
  selectedPrimaryKeyword: string | null;
  selectionRationale: string | null;
  supportingKeywords: string[];
  supportingEntities: string[];
  conversationEvidence: unknown;
  tenantFactsUsed: unknown;
  missingDataFallbacks: unknown;
  requiredModules: string[];
  internalLinkPlan: unknown;
  ctaPlan: unknown;
  createUpdateSkip: string;
  createUpdateSkipRationale: string | null;
  noStrongTarget: boolean;
  needsReview: boolean;
};

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

function groundingSummary(metadata: JsonRecord): string | null {
  const grounding = metadata.grounding;
  if (!isRecord(grounding)) return null;
  if (grounding.ok === true) return null;
  return stringValue(grounding.summary) ?? "Grounding is uncertain; review tenant evidence before publishing.";
}

function heroImageState(metadata: JsonRecord) {
  const state = nestedRecord(metadata, "aiHeroImage");
  const images = Array.isArray(state.images) ? state.images : [];
  const activeUrl = stringValue(state.activeUrl);
  const hero = nestedRecord(metadata, "hero");
  return {
    activeUrl,
    currentUrl: activeUrl ?? stringValue(hero.url),
    imageCount: images.length,
    revertedAt: stringValue(state.revertedAt),
  };
}

function HeroImagePanel({ post }: { post: BlogPostDetail }) {
  const state = heroImageState(post.metadata);
  const regenerate = async () => {
    "use server";
    await regenerateHeroImage(post.id);
  };
  const revert = async () => {
    "use server";
    await revertHeroImage(post.id);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Hero image</h2>
          <p className="mt-1 text-sm text-slate-500">
            {state.activeUrl
              ? "AI hero image active"
              : state.revertedAt
                ? "Gradient placeholder active after revert"
                : "Gradient placeholder active"}
          </p>
          <p className="mt-2 break-all text-xs text-slate-500">
            {state.currentUrl ?? "No hero image URL recorded"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={regenerate}>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Regenerate hero image
            </button>
          </form>
          <form action={revert}>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Revert to gradient placeholder
            </button>
          </form>
        </div>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <DetailItem label="AI images generated" value={state.imageCount} />
        <DetailItem label="Active AI image" value={state.activeUrl ? "Yes" : "No"} />
      </dl>
    </section>
  );
}

export async function ArticleDetailView({ post }: { post: BlogPostDetail }) {
  return ArticleDetailViewWithPublishing({
    post,
    checklist: readChecklist(post.metadata),
    wordpressSiteUrl: null,
    seoFields: null,
    editorialBrief: null,
  });
}

export async function ArticleDetailViewWithPublishing({
  post,
  checklist,
  wordpressSiteUrl,
  seoFields: seoSidecar,
  editorialBrief,
}: {
  post: BlogPostDetail;
  checklist: PrePublishChecklistResult | null;
  wordpressSiteUrl: string | null;
  seoFields?: SeoSidecar | null;
  editorialBrief?: EditorialBriefRow | null;
}) {
  if (post.status === "generation_failed") {
    return <FailureState post={post} />;
  }

  const decision = metadataDecision(post.metadata);
  const seo = seoFields(post);
  const body = await articleBodyHtml(post);
  const similar = similarPosts(decision);
  const count = wordCount(post);
  const groundingWarning = groundingSummary(post.metadata);

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

      <ArticleSeoPanel post={post} seoFields={seoSidecar} decision={decision} />

      {groundingWarning ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-950">
            Grounding review needed
          </h2>
          <p className="mt-1 text-sm text-amber-900">{groundingWarning}</p>
        </section>
      ) : null}

      {editorialBrief ? <EditorialBriefPanel brief={editorialBrief} /> : null}

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

      <HeroImagePanel post={post} />

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

      {publishedUrl(post) ? (
        <a
          href={publishedUrl(post) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          View on WordPress
        </a>
      ) : null}

      {checklist ? (
        <PrePublishChecklistPanel postId={post.id} checklist={checklist} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {["Approve", "Reject", "Edit"].map((action) => (
          <DisabledAction key={action} tooltip="Coming in CON-107 / CON-111">
            {action}
          </DisabledAction>
        ))}
        <PublishBlogPostButton
          postId={post.id}
          status={post.status}
          prePublishChecklist={readChecklist(post.metadata)}
          wordpressSiteUrl={wordpressSiteUrl}
        />
      </div>
    </div>
  );
}

function textareaLines(values: string[] | null | undefined) {
  return (values ?? []).join("\n");
}

function linkLines(values: Array<{ url: string; label?: string }> | null | undefined) {
  return (values ?? [])
    .map((link) => (link.label ? `${link.url} | ${link.label}` : link.url))
    .join("\n");
}

function ArticleSeoPanel({
  post,
  seoFields,
  decision,
}: {
  post: BlogPostDetail;
  seoFields?: SeoSidecar | null;
  decision: JsonRecord;
}) {
  const action = async (formData: FormData) => {
    "use server";
    await saveBlogPostSeo(post.id, formData);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Article SEO fields</h2>
      <form action={action} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Primary keyword</span>
          <input
            name="primaryKeyword"
            defaultValue={
              seoFields?.primaryKeyword ??
              stringValue(decision.primary_keyword) ??
              post.persona ??
              ""
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Search intent</span>
          <select
            name="searchIntent"
            defaultValue={seoFields?.searchIntent ?? stringValue(decision.intent) ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            <option value="informational">Informational</option>
            <option value="commercial">Commercial</option>
            <option value="transactional">Transactional</option>
            <option value="navigational">Navigational</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Target audience</span>
          <input
            name="targetAudience"
            defaultValue={seoFields?.targetAudience ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Article type</span>
          <select
            name="articleType"
            defaultValue={seoFields?.articleType ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            <option value="guide">Guide</option>
            <option value="comparison">Comparison</option>
            <option value="pricing">Pricing</option>
            <option value="explainer">Explainer</option>
            <option value="listicle">Listicle</option>
            <option value="case-study">Case study</option>
            <option value="faq">FAQ</option>
            <option value="landing-support">Landing support</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Secondary keywords or questions
          </span>
          <textarea
            name="secondaryKeywords"
            rows={3}
            defaultValue={textareaLines(seoFields?.secondaryKeywords)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-slate-700">
            Internal link suggestions
          </span>
          <textarea
            name="internalLinkSuggestions"
            rows={3}
            defaultValue={linkLines(seoFields?.internalLinkSuggestions)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-slate-700">CTA goal</span>
          <input
            name="ctaGoal"
            defaultValue={seoFields?.ctaGoal ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Save SEO fields
          </button>
        </div>
      </form>
    </section>
  );
}

function EditorialBriefPanel({ brief }: { brief: EditorialBriefRow }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
        Editorial brief
      </summary>
      <div className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2">
        <DetailItem label="Selected keyword" value={brief.selectedPrimaryKeyword} />
        <DetailItem label="Decision" value={brief.createUpdateSkip} />
        <DetailItem
          label="Needs review"
          value={brief.needsReview || brief.noStrongTarget ? "Yes" : "No"}
        />
        <DetailItem
          label="Required modules"
          value={brief.requiredModules.length ? brief.requiredModules.join(", ") : null}
        />
        <div className="md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Rationale
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {brief.selectionRationale ?? brief.createUpdateSkipRationale ?? "None"}
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Brief data
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-50">
            {JSON.stringify(
              {
                supportingKeywords: brief.supportingKeywords,
                supportingEntities: brief.supportingEntities,
                conversationEvidence: brief.conversationEvidence,
                tenantFactsUsed: brief.tenantFactsUsed,
                missingDataFallbacks: brief.missingDataFallbacks,
                internalLinkPlan: brief.internalLinkPlan,
                ctaPlan: brief.ctaPlan,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </details>
  );
}

function PrePublishChecklistPanel({
  postId,
  checklist,
}: {
  postId: string;
  checklist: PrePublishChecklistResult;
}) {
  const passed = checklist.items.filter((item) => item.status === "pass").length;
  const action = async () => {
    "use server";
    await revalidatePrePublishChecklist(postId);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pre-publish checklist
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {passed} / {checklist.items.length} checks passed
          </p>
        </div>
        <form action={action}>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Re-run checklist
          </button>
        </form>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {checklist.items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3 text-sm">
            <span
              aria-hidden="true"
              className={item.status === "pass" ? "text-green-700" : "text-red-700"}
            >
              {item.status === "pass" ? "✓" : "×"}
            </span>
            <span>
              <span className="font-medium text-slate-900">{item.label}</span>
              {item.status === "fail" && item.message ? (
                <span className="mt-1 block text-slate-600">{item.message}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function publishedUrl(post: BlogPostDetail) {
  const published = nestedRecord(post.metadata, "published");
  return stringValue(published.wp_post_url);
}

function readChecklist(metadata: JsonRecord): PrePublishChecklistResult | null {
  const checklist = metadata.prePublishChecklist;
  if (!isRecord(checklist) || !Array.isArray(checklist.items)) return null;
  if (typeof checklist.ok !== "boolean" || typeof checklist.ranAt !== "string") {
    return null;
  }
  return checklist as PrePublishChecklistResult;
}
