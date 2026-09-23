import Ajv from "ajv";

import type { TenantSettings } from "@/lib/publishing";

import { validateJsonLd } from "./jsonld-validator";
import { groundingReportFromMetadata } from "./grounding";
import type { BlogPostDetail } from "./queries";
import postSchema from "./schemas/post.schema.json";
import { validateSeoMetadata } from "./seo";
import {
  findAustralianEnglishViolation,
  findBannedTerm,
  slugIsValid,
  tenantBannedTerms,
  validatePostStructure,
  validatePrimaryKeywordPlacement,
  validateWordCountGates,
  type BlogPostJson,
} from "./writing-rules";

export type ChecklistItemId =
  | "keyword_placement"
  | "meta_title_length"
  | "meta_description_length"
  | "slug_format"
  | "schema_valid"
  | "canonical_url"
  | "internal_links"
  | "og_fields"
  | "locale_en_au"
  | "no_em_dashes"
  | "no_banned_terms"
  | "word_count"
  | "single_cta"
  | "grounding"
  | "no_pii_from_thread";

export type ChecklistItemResult = {
  id: ChecklistItemId;
  label: string;
  status: "pass" | "fail";
  message?: string;
};

export type PrePublishChecklistResult = {
  ok: boolean;
  items: ChecklistItemResult[];
  ranAt: string;
};

export type PrePublishChecklistTenant = {
  settings: TenantSettings;
  brandJson: unknown;
  domain?: string | null;
  sourceMessages?: Array<{ content: string | null }>;
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validatePostSchema = ajv.compile(postSchema);

const ITEM_LABELS: Record<ChecklistItemId, string> = {
  keyword_placement: "Primary keyword placement",
  meta_title_length: "Meta title 30-75 chars",
  meta_description_length: "Meta description 80-200 chars",
  slug_format: "Slug format",
  schema_valid: "Post schema and JSON-LD valid",
  canonical_url: "Canonical URL",
  internal_links: "At least one internal link",
  og_fields: "Open Graph fields",
  locale_en_au: "Australian English",
  no_em_dashes: "No em dashes",
  no_banned_terms: "No banned terms",
  word_count: "Word count gates",
  single_cta: "Exactly one CTA",
  grounding: "Grounded in tenant facts",
  no_pii_from_thread: "No source-thread contact details",
};

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?61|0)[\s-]?\d(?:[\s-]?\d){7,9}\b/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asBlogPostJson(post: BlogPostDetail): BlogPostJson {
  const metadata = post.metadata as Record<string, unknown>;
  return {
    slug: stringField(metadata.slug) ?? post.slug,
    category: metadata.category,
    title: stringField(metadata.title) ?? post.title,
    dek: metadata.dek,
    meta: metadata.meta,
    seo: metadata.seo,
    hero: metadata.hero,
    stats: metadata.stats,
    toc: Array.isArray(metadata.toc) ? metadata.toc : [],
    intro: stringField(metadata.intro) ?? "",
    sections: Array.isArray(metadata.sections) ? metadata.sections : [],
    faqs: Array.isArray(metadata.faqs) ? metadata.faqs : [],
    related: metadata.related,
  } as BlogPostJson;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function issueFor(prefix: string, issues: string[]): string | undefined {
  return issues.find((issue) => issue.startsWith("error:") && issue.includes(prefix));
}

function result(
  id: ChecklistItemId,
  message?: string | null,
): ChecklistItemResult {
  return message
    ? { id, label: ITEM_LABELS[id], status: "fail", message }
    : { id, label: ITEM_LABELS[id], status: "pass" };
}

function extractJsonLd(content: string): object[] {
  const nodes: object[] = [];
  const pattern =
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content))) {
    try {
      const parsed = JSON.parse(match[1] ?? "");
      if (isRecord(parsed)) nodes.push(parsed);
      if (Array.isArray(parsed)) {
        nodes.push(...parsed.filter(isRecord));
      }
    } catch {
      nodes.push({ "@type": "" });
    }
  }

  return nodes;
}

function schemaMessage(post: BlogPostJson, renderedContent: string): string | null {
  const structure = validatePostStructure(post);
  if (structure) return structure.message;

  if (!validatePostSchema(post)) {
    const first = validatePostSchema.errors?.[0];
    return `post.schema.json failed${first ? ` at ${first.instancePath || "/"}: ${first.message}` : ""}`;
  }

  const jsonLdNodes = extractJsonLd(renderedContent);
  if (jsonLdNodes.length === 0) return "JSON-LD script is missing.";

  const jsonLd = validateJsonLd(jsonLdNodes.length === 1 ? jsonLdNodes[0] : jsonLdNodes);
  const firstError = jsonLd.issues.find((issue) => issue.severity === "error");
  return firstError ? `JSON-LD ${firstError.path}: ${firstError.message}` : null;
}

function allChecklistText(post: BlogPostJson): string {
  const pieces = [
    post.title,
    post.dek,
    post.intro,
    ...post.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap((block) => Object.values(block).flatMap((value) => {
        if (typeof value === "string") return [value];
        if (Array.isArray(value)) return value.flatMap((nested) =>
          typeof nested === "string"
            ? [nested]
            : isRecord(nested)
              ? Object.values(nested).filter((item): item is string => typeof item === "string")
              : []
        );
        return [];
      })),
    ]),
    ...post.faqs.flatMap((faq) => [faq.q, faq.a]),
  ];

  return pieces.filter(Boolean).join("\n");
}

function textOnlyPost(post: BlogPostJson): BlogPostJson {
  return {
    ...post,
    hero: { url: "", alt: "" },
    seo: null as unknown as BlogPostJson["seo"],
    meta: { updated: "", readMinutes: 0 },
    stats: [],
    toc: [],
    related: [],
  };
}

function internalLinkMessage(post: BlogPostJson, tenant: PrePublishChecklistTenant): string | null {
  const domains = tenantDomains(tenant);
  const urls = post.sections.flatMap((section) =>
    section.blocks.flatMap((block) => {
      if (block.type === "readNext") return block.links.map((link) => link.url);
      if (block.type === "cta") return [block.linkUrl];
      return [];
    }),
  );

  const hasInternal = urls.some((url) => {
    if (url.startsWith("/") && !url.startsWith("//")) return true;
    try {
      const parsed = new URL(url);
      return domains.has(parsed.hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  });

  return hasInternal ? null : "Add at least one same-tenant internal link.";
}

function tenantDomains(tenant: PrePublishChecklistTenant): Set<string> {
  const settings = tenant.settings as Record<string, unknown>;
  const brand = isRecord(tenant.brandJson) ? tenant.brandJson : {};
  const site = nestedRecord(brand, "site");
  const candidates = [
    tenant.domain,
    stringField(settings.domain),
    stringField(settings.siteUrl),
    stringField(site.url),
    stringField(site.baseUrl),
  ];

  const domains = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const host = candidate.includes("://") ? new URL(candidate).hostname : candidate;
      domains.add(host.replace(/^www\./, ""));
    } catch {
      domains.add(candidate.replace(/^www\./, ""));
    }
  }
  return domains;
}

function singleCtaMessage(post: BlogPostJson): string | null {
  const count = post.sections.reduce(
    (total, section) => total + section.blocks.filter((block) => block.type === "cta").length,
    0,
  );
  return count === 1 ? null : `Expected exactly 1 CTA block, found ${count}.`;
}

function piiMessage(post: BlogPostJson, tenant: PrePublishChecklistTenant): string | null {
  const messages = tenant.sourceMessages ?? [];
  const sourcePii = new Set<string>();

  for (const message of messages) {
    const content = message.content ?? "";
    for (const email of content.match(EMAIL_RE) ?? []) sourcePii.add(email.toLowerCase());
    for (const phone of content.match(PHONE_RE) ?? []) sourcePii.add(normalisePhone(phone));
  }

  if (sourcePii.size === 0) return null;

  const body = allChecklistText(post).toLowerCase();
  const normalisedBody = normalisePhone(body);
  for (const pii of sourcePii) {
    if (body.includes(pii) || normalisedBody.includes(pii)) {
      return "Remove contact details copied from the source conversation.";
    }
  }

  return null;
}

function groundingMessage(post: BlogPostDetail): string | null {
  const report = groundingReportFromMetadata(post.metadata);
  if (!report) return null;
  if (report.ok) return null;
  const unsupported = report.claims.filter((claim) => claim.decision === "unsupported");
  const uncertain = report.claims.filter((claim) => claim.decision === "uncertain");
  if (unsupported.length > 0) {
    const first = unsupported[0];
    return `${report.summary} First issue: ${first.sentence || first.reason}`;
  }
  if (uncertain.length > 0) return report.summary;
  return "Grounding is uncertain; review tenant evidence before publishing.";
}

function normalisePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function primaryKeyword(post: BlogPostDetail): string {
  const decision = nestedRecord(post.metadata, "decision");
  const generation = nestedRecord(post.metadata, "generation");
  const generationDecision = nestedRecord(generation, "decision");
  return (
    stringField(decision.primary_keyword) ??
    stringField(generationDecision.primary_keyword) ??
    post.persona ??
    post.topic ??
    ""
  );
}

export function runPrePublishChecklist(
  post: BlogPostDetail,
  tenant: PrePublishChecklistTenant,
): PrePublishChecklistResult {
  const checklistTenant = tenant;
  const postJson = asBlogPostJson(post);
  const seo = validateSeoMetadata(postJson);
  const contentForSchema = post.contentSemantic ?? post.content;

  const items: ChecklistItemResult[] = [
    result(
      "keyword_placement",
      validatePrimaryKeywordPlacement(postJson, primaryKeyword(post))?.message,
    ),
    result("meta_title_length", issueFor("metaTitle", seo.issues)),
    result("meta_description_length", issueFor("metaDescription", seo.issues)),
    result(
      "slug_format",
      issueFor("slug", seo.issues) ??
        (slugIsValid(postJson.slug) ? null : "Slug must be lowercase kebab-case."),
    ),
    result("schema_valid", schemaMessage(postJson, contentForSchema)),
    result(
      "canonical_url",
      postJson.seo?.canonicalUrl
        ? issueFor("canonicalUrl", seo.issues)
        : "Canonical URL is required.",
    ),
    result("internal_links", internalLinkMessage(postJson, checklistTenant)),
    result(
      "og_fields",
      postJson.seo?.ogImage && postJson.seo?.metaTitle
        ? null
        : "Open Graph image and title are required.",
    ),
    result("locale_en_au", findAustralianEnglishViolation(postJson)?.message),
    result(
      "no_em_dashes",
      /—/.test(allChecklistText(postJson)) ? "Replace em dashes with commas, colons, or full stops." : null,
    ),
    result(
      "no_banned_terms",
      findBannedTerm(textOnlyPost(postJson), tenantBannedTerms(tenant.settings))?.message,
    ),
    result("word_count", validateWordCountGates(postJson)?.message),
    result("single_cta", singleCtaMessage(postJson)),
    result("grounding", groundingMessage(post)),
    result("no_pii_from_thread", piiMessage(postJson, checklistTenant)),
  ];

  return {
    ok: items.every((item) => item.status === "pass"),
    items,
    ranAt: new Date().toISOString(),
  };
}
