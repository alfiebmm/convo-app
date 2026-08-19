import { assertTenantId } from "@/lib/cases/tenant-guard";

export const BLOG_POST_PAGE_SIZE = 25;
export const MAX_BLOG_POST_PAGE = 10_000;

export const blogPostStatuses = [
  "draft",
  "in_review",
  "approved",
  "published",
  "rejected",
  "generation_failed",
  "update_pending",
] as const;

export type BlogPostStatus = (typeof blogPostStatuses)[number];
export const hiddenBlogPostStatuses = ["generation_failed"] as const;
export const defaultBlogPostListStatuses = blogPostStatuses.filter(
  (status) =>
    !hiddenBlogPostStatuses.includes(
      status as (typeof hiddenBlogPostStatuses)[number],
    ),
);

export interface BlogPostListFilters {
  status?: BlogPostStatus;
  topic?: string;
  persona?: string;
  page?: number;
  includeFailed?: boolean;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  topic: string | null;
  persona: string | null;
  wordCount: number | null;
  status: BlogPostStatus;
  createdAt: Date;
}

export interface BlogPostDetail {
  id: string;
  tenantId: string;
  threadId: string | null;
  title: string;
  slug: string;
  content: string;
  metadata: Record<string, unknown>;
  status: BlogPostStatus;
  persona: string | null;
  topic: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  lastModified: Date;
}

export interface BlogPostListResult {
  rows: BlogPostListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface BlogPostSupabaseRow {
  id: string;
  title: string | null;
  status: BlogPostStatus;
  metadata: Record<string, unknown> | null;
  content: string | null;
  persona: string | null;
  topic: string | null;
  created_at: string;
}

interface BlogPostDetailSupabaseRow extends BlogPostSupabaseRow {
  tenant_id: string;
  thread_id: string | null;
  slug: string;
  content: string | null;
  persona: string | null;
  topic: string | null;
  published_at: string | null;
  last_modified: string;
}

type BlogPostQueryBuilder = {
  eq: (column: string, value: string) => BlogPostQueryBuilder;
  in: (column: string, values: readonly BlogPostStatus[]) => BlogPostQueryBuilder;
  contains: (
    column: string,
    value: Record<string, string>,
  ) => BlogPostQueryBuilder;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => BlogPostQueryBuilder;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: BlogPostSupabaseRow[] | null;
    error: { message: string } | null;
    count: number | null;
  }>;
  maybeSingle: () => PromiseLike<{
    data: BlogPostDetailSupabaseRow | null;
    error: { message: string } | null;
  }>;
};

type BlogPostFromBuilder = {
  select: (
    columns: string,
    options?: { count?: "exact" },
  ) => BlogPostQueryBuilder;
};

export type BlogPostsSupabaseClient = {
  from(table: "blog_posts"): BlogPostFromBuilder;
};

export function parseBlogPostPage(value: string | number | undefined) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 1;
    return Math.min(MAX_BLOG_POST_PAGE, Math.max(1, Math.floor(value)));
  }
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  return Math.min(MAX_BLOG_POST_PAGE, Number(value));
}

export function parseBlogPostStatus(
  value: string | undefined,
): BlogPostStatus | undefined {
  return blogPostStatuses.includes(value as BlogPostStatus)
    ? (value as BlogPostStatus)
    : undefined;
}

function cleanText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseWordCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function computeBlogPostWordCountFallback(
  content: string | null | undefined
): number | null {
  if (!content) return null;
  const bodyMatch = content.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : content;
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const count = plain ? plain.split(" ").filter(Boolean).length : 0;
  return count > 0 ? count : null;
}

function metadataStatsWordCount(metadata: Record<string, unknown>) {
  const stats =
    metadata.stats && typeof metadata.stats === "object" && !Array.isArray(metadata.stats)
      ? (metadata.stats as Record<string, unknown>)
      : {};
  return parseWordCount(stats.wordCount ?? stats.word_count);
}

function mapBlogPostRow(row: BlogPostSupabaseRow): BlogPostListItem {
  const metadata = row.metadata ?? {};
  const topic =
    typeof row.topic === "string" && row.topic.trim()
      ? row.topic
      : typeof metadata.topic === "string"
        ? metadata.topic
        : null;
  const persona =
    typeof row.persona === "string" && row.persona.trim()
      ? row.persona
      : typeof metadata.persona === "string"
        ? metadata.persona
        : null;
  const metadataWordCount =
    metadataStatsWordCount(metadata) ??
    parseWordCount(metadata.word_count ?? metadata.wordCount);

  return {
    id: row.id,
    title: row.title ?? "Untitled article",
    topic,
    persona,
    wordCount: metadataWordCount ?? computeBlogPostWordCountFallback(row.content),
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

function mapBlogPostDetailRow(row: BlogPostDetailSupabaseRow): BlogPostDetail {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    threadId: row.thread_id,
    title: row.title ?? "Untitled article",
    slug: row.slug,
    content: row.content ?? "",
    metadata: row.metadata ?? {},
    status: row.status,
    persona: row.persona,
    topic: row.topic,
    createdAt: new Date(row.created_at),
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    lastModified: new Date(row.last_modified),
  };
}

export async function listBlogPostsForTenant({
  supabase,
  tenantId,
  filters = {},
}: {
  supabase: BlogPostsSupabaseClient;
  tenantId: string;
  filters?: BlogPostListFilters;
}): Promise<BlogPostListResult> {
  assertTenantId(tenantId);

  const page = parseBlogPostPage(filters.page);
  const from = (page - 1) * BLOG_POST_PAGE_SIZE;
  const to = from + BLOG_POST_PAGE_SIZE - 1;

  let query = supabase
    .from("blog_posts")
    .select("id,title,status,metadata,content,persona,topic,created_at", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (!filters.includeFailed) {
    query = query.in("status", defaultBlogPostListStatuses);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const topic = cleanText(filters.topic);
  if (topic) {
    query = query.eq("topic", topic);
  }

  const persona = cleanText(filters.persona);
  if (persona) {
    query = query.eq("persona", persona);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to list blog posts: ${error.message}`);
  }

  return {
    rows: (data ?? []).map(mapBlogPostRow),
    totalCount: count ?? 0,
    page,
    pageSize: BLOG_POST_PAGE_SIZE,
  };
}

export async function countFailedBlogPostsForTenant({
  supabase,
  tenantId,
}: {
  supabase: BlogPostsSupabaseClient;
  tenantId: string;
}): Promise<number> {
  assertTenantId(tenantId);

  const { error, count } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("status", "generation_failed")
    .range(0, 0);

  if (error) {
    throw new Error(`Failed to count failed blog posts: ${error.message}`);
  }

  return count ?? 0;
}

export async function getBlogPostByIdForTenant({
  supabase,
  tenantId,
  postId,
}: {
  supabase: BlogPostsSupabaseClient;
  tenantId: string;
  postId: string;
}): Promise<BlogPostDetail | null> {
  assertTenantId(tenantId);

  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      [
        "id",
        "tenant_id",
        "thread_id",
        "title",
        "slug",
        "content",
        "metadata",
        "status",
        "persona",
        "topic",
        "created_at",
        "published_at",
        "last_modified",
      ].join(","),
    )
    .eq("tenant_id", tenantId)
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get blog post: ${error.message}`);
  }

  return data ? mapBlogPostDetailRow(data) : null;
}
