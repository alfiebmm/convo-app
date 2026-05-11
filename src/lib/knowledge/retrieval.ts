/**
 * Semantic retrieval over tenant knowledge_items (K-07 / CON-89).
 *
 * Embeds an incoming query and returns the top-N nearest chunks for a tenant
 * via pgvector cosine distance (`<=>` operator). HNSW index added in
 * 0003_k07_pgvector.sql keeps latency in the low-millisecond range even at
 * tens of thousands of chunks.
 *
 * Used by the chat API to inject relevant site content into the system prompt
 * so the bot can cite specific blog articles and pages instead of relying on
 * tenant settings or LLM general knowledge.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface RetrievedChunk {
  id: string;
  type: "page" | "file";
  sourceUrl: string | null;
  title: string;
  content: string;
  parentId: string | null;
  /** Cosine distance from query — lower is better. 0 = identical, 2 = opposite. */
  distance: number;
  metadata: Record<string, unknown>;
}

export interface RetrieveOptions {
  /** Max chunks to return. Default 6. */
  limit?: number;
  /**
   * Discard chunks with cosine distance >= this threshold. Default 0.7
   * (roughly: filter out anything weakly related). Set higher to be more
   * permissive, lower to be stricter.
   */
  maxDistance?: number;
  /** Restrict to a single type, or both when omitted. */
  type?: "page" | "file";
}

/**
 * Embed a query string with the same model used for indexing
 * (text-embedding-3-small / 1536 dims).
 */
async function embedQuery(query: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  return res.data[0].embedding;
}

/**
 * Format a JS number[] as a pgvector literal: "[0.01,0.02,...]".
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Retrieve the top-N most relevant chunks for a query within a tenant.
 *
 * The query is embedded once and compared via cosine distance to every
 * embedded chunk for the tenant. Results are ordered nearest-first and
 * filtered by `maxDistance` to drop weakly-related noise.
 */
export async function retrieveRelevantChunks(
  tenantId: string,
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const limit = opts.limit ?? 6;
  const maxDistance = opts.maxDistance ?? 0.7;
  const typeFilter = opts.type ?? null;

  // Embed the query once.
  const embedding = await embedQuery(query);
  const literal = toVectorLiteral(embedding);

  // Raw SQL because Drizzle has no first-class pgvector operator. We bind
  // the embedding via the query value rather than string interpolation to
  // keep injection-safe.
  // Note: typeFilter is intentionally a literal cast (not parameterised)
  // because Postgres can't bind a NULL into the enum cleanly. We validate
  // it strictly at the JS layer so it can only be 'page' | 'file' | null.
  if (typeFilter && typeFilter !== "page" && typeFilter !== "file") {
    throw new Error(`invalid typeFilter: ${typeFilter}`);
  }

  const typeClause = typeFilter
    ? sql`AND type = ${typeFilter}::knowledge_item_type`
    : sql``;

  const rows = await db.execute(sql`
    SELECT id,
           type::text AS type,
           source_url AS "sourceUrl",
           title,
           content,
           parent_id AS "parentId",
           metadata,
           (embedding <=> ${literal}::vector) AS distance
      FROM knowledge_items
     WHERE tenant_id = ${tenantId}
       AND embedding IS NOT NULL
       ${typeClause}
     ORDER BY embedding <=> ${literal}::vector
     LIMIT ${limit * 3}
  `);

  // Drizzle's execute returns { rows } on pg driver; normalise.
  const raw = (rows as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (rows as unknown as Record<string, unknown>[]);

  const out: RetrievedChunk[] = [];
  for (const r of raw) {
    const distance = Number(r.distance);
    if (!Number.isFinite(distance)) continue;
    if (distance >= maxDistance) continue;
    out.push({
      id: String(r.id),
      type: r.type as "page" | "file",
      sourceUrl: (r.sourceUrl as string | null) ?? null,
      title: String(r.title ?? ""),
      content: String(r.content ?? ""),
      parentId: (r.parentId as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      distance,
    });
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Format retrieved chunks as a system-prompt snippet. The format leans on
 * clear delimiters and explicit URL exposure so the LLM can cite them
 * directly in answers.
 */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const lines: string[] = [];
  lines.push("RELEVANT CONTENT FROM THE SITE:");
  lines.push(
    "(Use this to ground your answer. When you reference a specific article or page, link to its URL exactly. Prefer the most relevant items first.)"
  );
  lines.push("");

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const label = c.type === "page" ? "PAGE" : "FILE";
    // Truncate content to keep the system prompt manageable.
    const content = c.content.length > 1200 ? c.content.slice(0, 1200) + "\u2026" : c.content;
    lines.push(`[${i + 1}] ${label}: ${c.title}`);
    if (c.sourceUrl) lines.push(`URL: ${c.sourceUrl}`);
    lines.push(`CONTENT: ${content}`);
    lines.push("");
  }
  return lines.join("\n");
}
