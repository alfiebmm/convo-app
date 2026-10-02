/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

import type { BlogPostDetail } from "@/lib/blog/queries";

type JsonRecord = Record<string, unknown>;

type PreviewBrand = {
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  surfaceTint: string;
  text: string;
  muted: string;
  border: string;
  background: string;
  fontBody: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(source: unknown, key: string): JsonRecord {
  if (!isRecord(source)) return {};
  const value = source[key];
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cssColour(value: unknown, fallback: string) {
  const colour = stringValue(value);
  return colour && /^#[0-9a-f]{3,8}$/i.test(colour) ? colour : fallback;
}

function extractJsonLd(html: string): JsonRecord[] {
  const matches = html.matchAll(
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const parsed: JsonRecord[] = [];

  for (const match of matches) {
    try {
      const value = JSON.parse(match[1] ?? "");
      if (Array.isArray(value)) {
        parsed.push(...value.filter(isRecord));
      } else if (isRecord(value)) {
        parsed.push(value);
      }
    } catch {
      // Ignore malformed structured data in preview; the checklist owns validation.
    }
  }

  return parsed;
}

function firstPublisherLogo(jsonLd: JsonRecord[]) {
  for (const node of jsonLd) {
    const publisher = recordValue(node, "publisher");
    const logo = publisher.logo;
    if (typeof logo === "string") return logo;
    const logoRecord = recordValue(publisher, "logo");
    const url = stringValue(logoRecord.url);
    if (url) return url;
  }
  return null;
}

function buildBrand({
  brandJson,
  fallbackName,
  publishHtml,
}: {
  brandJson: unknown;
  fallbackName: string;
  publishHtml: string;
}): PreviewBrand {
  const brand = isRecord(brandJson) ? brandJson : {};
  const colors = recordValue(brand, "colors");
  const logo = recordValue(brand, "logo");
  const fonts = recordValue(brand, "fonts");
  const jsonLd = extractJsonLd(publishHtml);
  const publisherName = jsonLd
    .map((node) => stringValue(recordValue(node, "publisher").name))
    .find(Boolean);

  const name = stringValue(brand.name) ?? publisherName ?? fallbackName;
  const logoUrl = stringValue(logo.url) ?? firstPublisherLogo(jsonLd);

  return {
    name,
    logoUrl,
    logoAlt: stringValue(logo.alt) ?? name,
    primary: cssColour(colors.primary, "#FF6B2C"),
    primaryHover: cssColour(colors.primaryHover, "#E85A1E"),
    secondary: cssColour(colors.secondary, "#18181B"),
    surfaceTint: cssColour(colors.surfaceTint, "#FFF7ED"),
    text: cssColour(colors.text, "#18181B"),
    muted: cssColour(colors.textMuted, "#52525B"),
    border: cssColour(colors.border, "#E4E4E7"),
    background: cssColour(colors.bg, "#FFFFFF"),
    fontBody:
      stringValue(fonts.body) ??
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  };
}

function stripPreviewChrome(html: string, post: BlogPostDetail) {
  let body = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, "");

  const dek = stringValue(post.metadata.dek);
  if (dek) {
    const escapedDek = dek.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`<p[^>]*>\\s*${escapedDek}\\s*<\\/p>`, "i"), "");
  }

  const hero = recordValue(post.metadata, "hero");
  const heroUrl = stringValue(hero.url);
  if (heroUrl) {
    const escapedHeroUrl = heroUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(
      new RegExp(`<figure[^>]*>[\\s\\S]*?<img[^>]+src=["']${escapedHeroUrl}["'][\\s\\S]*?<\\/figure>`, "i"),
      "",
    );
  }

  return body.trim();
}

function safeTrustedHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
}

function heroFromPost(post: BlogPostDetail) {
  const hero = recordValue(post.metadata, "hero");
  return {
    url: stringValue(hero.url),
    alt: stringValue(hero.alt) ?? post.title,
  };
}

function metaDek(post: BlogPostDetail) {
  return (
    stringValue(post.metadata.dek) ??
    stringValue(recordValue(post.metadata, "seo").metaDescription) ??
    stringValue(post.metadata.meta_description)
  );
}

function readMinutes(post: BlogPostDetail) {
  const meta = recordValue(post.metadata, "meta");
  const minutes = numberValue(meta.readMinutes) ?? numberValue(post.metadata.read_minutes);
  return minutes ? `${minutes} min read` : null;
}

export function WordPressArticlePreview({
  post,
  brandJson,
  tenantName,
  publishHtml,
}: {
  post: BlogPostDetail;
  brandJson: unknown;
  tenantName: string;
  publishHtml: string;
}) {
  const brand = buildBrand({
    brandJson,
    fallbackName: tenantName,
    publishHtml,
  });
  const body = safeTrustedHtml(stripPreviewChrome(publishHtml, post));
  const hero = heroFromPost(post);
  const dek = metaDek(post);
  const readingTime = readMinutes(post);
  const updated = stringValue(recordValue(post.metadata, "meta").updated);

  return (
    <div
      className="min-h-screen bg-white"
      style={
        {
          "--wp-brand-primary": brand.primary,
          "--wp-brand-primary-hover": brand.primaryHover,
          "--wp-brand-secondary": brand.secondary,
          "--wp-brand-surface": brand.surfaceTint,
          "--wp-brand-text": brand.text,
          "--wp-brand-muted": brand.muted,
          "--wp-brand-border": brand.border,
          "--wp-brand-bg": brand.background,
          "--wp-brand-font": brand.fontBody,
        } as CSSProperties
      }
    >
      <article className="wp-preview bg-[var(--wp-brand-bg)] text-[var(--wp-brand-text)]">
        <header className="border-b border-[var(--wp-brand-border)] bg-[var(--wp-brand-bg)]">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <a href="#" className="flex min-w-0 items-center" aria-label={brand.name}>
              {brand.logoUrl ? (
                <span className="flex h-12 max-w-[180px] items-center overflow-hidden sm:max-w-[220px]">
                  <img
                    src={brand.logoUrl}
                    alt={brand.logoAlt}
                    className="max-h-12 w-auto max-w-full object-contain"
                  />
                </span>
              ) : (
                <span className="text-lg font-semibold tracking-normal text-[var(--wp-brand-secondary)]">
                  {brand.name}
                </span>
              )}
            </a>
            <span className="hidden rounded-full border border-[var(--wp-brand-border)] px-3 py-1 text-xs font-medium text-[var(--wp-brand-muted)] sm:inline-flex">
              WordPress-style preview
            </span>
          </div>
        </header>

        <section className="bg-[var(--wp-brand-surface)] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:items-center">
            <div className="min-w-0">
              {post.topic ? (
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--wp-brand-primary)]">
                  {post.topic}
                </p>
              ) : null}
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-[var(--wp-brand-text)] sm:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              {dek ? (
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--wp-brand-muted)] sm:text-xl">
                  {dek}
                </p>
              ) : null}
              <p className="mt-6 flex flex-wrap gap-x-3 gap-y-2 text-sm text-[var(--wp-brand-muted)]">
                {updated ? <span>Updated {updated}</span> : null}
                {updated && readingTime ? <span aria-hidden="true">/</span> : null}
                {readingTime ? <span>{readingTime}</span> : null}
              </p>
            </div>

            {hero.url ? (
              <figure className="m-0 min-w-0">
                <div className="aspect-[16/9] overflow-hidden rounded-lg bg-white shadow-2xl shadow-zinc-900/10">
                  <img
                    src={hero.url}
                    alt={hero.alt}
                    className="h-full w-full object-cover"
                  />
                </div>
              </figure>
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div
            className="wp-preview__content"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </div>
      </article>
    </div>
  );
}
