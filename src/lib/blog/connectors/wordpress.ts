import { Buffer } from "node:buffer";

import type { BlogPostDetail } from "@/lib/blog/queries";
import type {
  PublishArticleResult,
  VerifyCredentialsResult,
} from "@/lib/blog/connectors/types";

export type WordPressConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

type WordPressPostResponse = {
  id?: unknown;
  link?: unknown;
};

const RETRYABLE_STATUS = 500;

function normalizeSiteUrl(siteUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return { ok: false as const, error: "Invalid WordPress site URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false as const, error: "Invalid WordPress site URL" };
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");

  return {
    ok: true as const,
    siteUrl: parsed.toString().replace(/\/+$/, ""),
  };
}

function endpoint(siteUrl: string, path: string) {
  return `${siteUrl}${path}`;
}

function authHeader(config: WordPressConfig) {
  const token = Buffer.from(
    `${config.username}:${config.applicationPassword}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function errorForStatus(status: number) {
  if (status === 401) return "WordPress credentials were rejected";
  if (status === 403) return "WordPress refused access";
  if (status === 404) return "WordPress REST API was not found";
  if (status >= 500) return "WordPress is temporarily unavailable";
  return `WordPress request failed with status ${status}`;
}

async function fetchWithRetry(url: string, init: RequestInit) {
  let response = await fetch(url, init);
  if (response.status >= RETRYABLE_STATUS) {
    response = await fetch(url, init);
  }
  return response;
}

function jsonHeaders(config: WordPressConfig) {
  return {
    Authorization: authHeader(config),
    "Content-Type": "application/json",
  };
}

function readPublishedPostId(metadata: Record<string, unknown>) {
  const published = metadata.published;
  if (!published || typeof published !== "object") return null;

  const wpPostId = (published as Record<string, unknown>).wp_post_id;
  if (typeof wpPostId === "number" && Number.isInteger(wpPostId)) {
    return wpPostId;
  }
  if (typeof wpPostId === "string" && /^\d+$/.test(wpPostId)) {
    return Number(wpPostId);
  }
  return null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberArrayField(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  const numbers = value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item),
  );
  return numbers.length === value.length ? numbers : undefined;
}

function metadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function wordpressPayload(post: BlogPostDetail) {
  const metadata = post.metadata ?? {};
  const payload: Record<string, unknown> = {
    title: post.title,
    content: post.content,
    slug: post.slug,
    status: "publish",
  };

  const excerpt =
    stringField(metadata.excerpt) ??
    stringField(metadata.meta_description) ??
    stringField(metadata.dek);
  if (excerpt) payload.excerpt = excerpt;

  const meta = metadataRecord(metadata.meta);
  if (meta) payload.meta = meta;

  const categories = numberArrayField(metadata.categories);
  if (categories) payload.categories = categories;

  const tags = numberArrayField(metadata.tags);
  if (tags) payload.tags = tags;

  return payload;
}

async function parsePostResponse(
  response: Response,
): Promise<PublishArticleResult> {
  let body: WordPressPostResponse;
  try {
    body = (await response.json()) as WordPressPostResponse;
  } catch {
    return { ok: false, error: "WordPress returned an invalid response" };
  }

  if (typeof body.id !== "number" || typeof body.link !== "string") {
    return { ok: false, error: "WordPress returned an incomplete response" };
  }

  return { ok: true, wpPostId: body.id, wpPostUrl: body.link };
}

export async function verifyCredentials(
  config: WordPressConfig,
): Promise<VerifyCredentialsResult> {
  const normalized = normalizeSiteUrl(config.siteUrl);
  if (!normalized.ok) return normalized;

  const response = await fetchWithRetry(
    endpoint(normalized.siteUrl, "/wp-json/wp/v2/users/me"),
    {
      method: "GET",
      headers: jsonHeaders(config),
    },
  );

  if (!response.ok) {
    return { ok: false, error: errorForStatus(response.status) };
  }

  return { ok: true, siteUrl: normalized.siteUrl };
}

export async function publishArticle(
  config: WordPressConfig,
  post: BlogPostDetail,
): Promise<PublishArticleResult> {
  const normalized = normalizeSiteUrl(config.siteUrl);
  if (!normalized.ok) return normalized;

  const existingPostId = readPublishedPostId(post.metadata);
  const path = existingPostId
    ? `/wp-json/wp/v2/posts/${existingPostId}`
    : "/wp-json/wp/v2/posts";

  const response = await fetchWithRetry(endpoint(normalized.siteUrl, path), {
    method: existingPostId ? "PUT" : "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify(wordpressPayload(post)),
  });

  if (!response.ok) {
    return { ok: false, error: errorForStatus(response.status) };
  }

  return parsePostResponse(response);
}
