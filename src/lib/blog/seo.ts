import type { BlogPostJson } from "./writing-rules";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "for",
  "to",
  "in",
  "on",
  "with",
]);

export type SeoValidationResult = {
  ok: boolean;
  issues: string[];
};

function countChars(value: string | null | undefined): number {
  return (value ?? "").trim().length;
}

function tokeniseForSlug(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function withSuffix(base: string, suffix: number): string {
  const suffixText = `-${suffix}`;
  return `${base.slice(0, 70 - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
}

export function generateSlug(
  title: string,
  existingSlugs: Iterable<string> = []
): string {
  const existing = new Set(existingSlugs);
  const tokens = tokeniseForSlug(title).filter((token) => !STOPWORDS.has(token));
  const base = (tokens.length > 0 ? tokens.join("-") : "post").slice(0, 70).replace(/-+$/g, "");
  let candidate = base || "post";
  let suffix = 2;

  while (existing.has(candidate)) {
    candidate = withSuffix(base || "post", suffix);
    suffix++;
  }

  return candidate;
}

export function validateSeoMetadata(post: BlogPostJson): SeoValidationResult {
  const issues: string[] = [];
  let ok = true;
  const seo = post.seo;

  const metaTitleLength = countChars(seo?.metaTitle);
  if (metaTitleLength < 30 || metaTitleLength > 75) {
    ok = false;
    issues.push(`error: metaTitle must be 30-75 characters, got ${metaTitleLength}`);
  } else if (metaTitleLength < 45 || metaTitleLength > 65) {
    issues.push(`warning: metaTitle target is 50-60 characters, got ${metaTitleLength}`);
  }

  const metaDescriptionLength = countChars(seo?.metaDescription);
  if (metaDescriptionLength < 80 || metaDescriptionLength > 200) {
    ok = false;
    issues.push(
      `error: metaDescription must be 80-200 characters, got ${metaDescriptionLength}`
    );
  } else if (metaDescriptionLength < 120 || metaDescriptionLength > 180) {
    issues.push(
      `warning: metaDescription target is 140-160 characters, got ${metaDescriptionLength}`
    );
  }

  if (post.slug.length > 70) {
    ok = false;
    issues.push(`error: slug must be 70 characters or fewer, got ${post.slug.length}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    ok = false;
    issues.push("error: slug must be lowercase, hyphenated, and contain no punctuation except hyphen");
  }
  const firstSlugTokens = post.slug.split("-").filter(Boolean).slice(0, 3);
  const firstStopword = firstSlugTokens.find((token) => STOPWORDS.has(token));
  if (firstStopword) {
    ok = false;
    issues.push(`error: slug must not include stopword "${firstStopword}" in the first 3 tokens`);
  }

  const canonicalUrl = seo?.canonicalUrl?.trim();
  if (canonicalUrl) {
    try {
      const url = new URL(canonicalUrl);
      if (url.protocol !== "https:" || !url.hostname.includes(".")) {
        ok = false;
        issues.push("error: canonicalUrl must be an absolute HTTPS URL with a valid host");
      }
    } catch {
      ok = false;
      issues.push("error: canonicalUrl must be an absolute HTTPS URL with a valid host");
    }
  }

  return { ok, issues };
}
