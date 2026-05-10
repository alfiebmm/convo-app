/**
 * Knowledge indexer (CON-85)
 * 
 * Orchestrates site crawling, chunking, embedding, and storage.
 */
import { db } from "@/lib/db";
import { knowledgeItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { crawlSite, type CrawledPage } from "./crawler";
import { chunkText, generateEmbeddings, formatEmbeddingForDB } from "./embeddings";
import { createHash } from "crypto";

export interface IndexingResult {
  pagesIndexed: number;
  chunksCreated: number;
  errors: string[];
}

/**
 * Index a tenant's website domain.
 * This is the main entry point called after tenant onboarding.
 */
export async function indexTenantSite(
  tenantId: string,
  domain: string
): Promise<IndexingResult> {
  console.log(`[Indexer] Starting site index for tenant ${tenantId}, domain: ${domain}`);
  
  const result: IndexingResult = {
    pagesIndexed: 0,
    chunksCreated: 0,
    errors: [],
  };
  
  try {
    // Crawl the site
    const pages = await crawlSite(domain, {
      maxPages: 200,
      timeoutMs: 60000,
    });
    
    if (pages.length === 0) {
      result.errors.push("No pages found during crawl");
      return result;
    }
    
    console.log(`[Indexer] Crawled ${pages.length} pages, processing...`);
    
    // Process pages in batches to avoid overwhelming the DB/API
    const batchSize = 10;
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      
      try {
        const chunksCreated = await processBatch(tenantId, batch);
        result.chunksCreated += chunksCreated;
        result.pagesIndexed += batch.length;
      } catch (error) {
        const errorMsg = `Batch ${i}-${i + batchSize} failed: ${error}`;
        console.error(`[Indexer] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    console.log(
      `[Indexer] Completed: ${result.pagesIndexed} pages, ${result.chunksCreated} chunks`
    );
  } catch (error) {
    const errorMsg = `Indexing failed: ${error}`;
    console.error(`[Indexer] ${errorMsg}`);
    result.errors.push(errorMsg);
  }
  
  return result;
}

/**
 * Process a batch of crawled pages: chunk, embed, and store.
 */
async function processBatch(
  tenantId: string,
  pages: CrawledPage[]
): Promise<number> {
  let chunksCreated = 0;
  
  for (const page of pages) {
    try {
      // Combine title and body for better semantic search
      const fullText = `${page.title}\n\n${page.bodyText}`;
      
      // Chunk the text
      const chunks = chunkText(fullText);
      
      if (chunks.length === 0) {
        console.warn(`[Indexer] No chunks for ${page.url}, skipping`);
        continue;
      }
      
      // Generate embeddings for all chunks
      const embeddings = await generateEmbeddings(chunks.map((c) => c.text));
      
      // Prepare records for insertion
      const records = chunks.map((chunk, idx) => ({
        tenantId,
        type: "page" as const,
        sourceUrl: page.url,
        parentId: null,
        title: page.title,
        content: chunk.text,
        contentHash: hashContent(chunk.text),
        metadata: {
          meta_description: page.metaDescription,
          h1: page.h1,
          internal_links: page.internalLinks,
          chunk_index: chunks.length > 1 ? chunk.chunkIndex : undefined,
        },
        embedding: formatEmbeddingForDB(embeddings[idx]),
        status: "indexed" as const,
        lastSyncedAt: new Date(),
      }));
      
      // Check for existing chunks from this URL and delete them (re-indexing)
      await db
        .delete(knowledgeItems)
        .where(
          and(
            eq(knowledgeItems.tenantId, tenantId),
            eq(knowledgeItems.sourceUrl, page.url)
          )
        );
      
      // Insert new chunks
      await db.insert(knowledgeItems).values(records);
      
      chunksCreated += records.length;
      
      console.log(`[Indexer] Indexed ${page.url}: ${chunks.length} chunk(s)`);
    } catch (error) {
      console.error(`[Indexer] Failed to process ${page.url}:`, error);
    }
  }
  
  return chunksCreated;
}

/**
 * Hash content for change detection.
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Get indexing status for a tenant.
 */
export async function getIndexingStatus(tenantId: string) {
  // Count unique source URLs (pages)
  const result = await db
    .select({
      sourceUrl: knowledgeItems.sourceUrl,
    })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenantId),
        eq(knowledgeItems.type, "page")
      )
    );
  
  // Get unique page count
  const uniqueUrls = new Set(result.map((r) => r.sourceUrl));
  const pagesIndexed = uniqueUrls.size;
  
  // Get most recent sync timestamp
  const [lastSynced] = await db
    .select({ last_synced_at: knowledgeItems.lastSyncedAt })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.tenantId, tenantId),
        eq(knowledgeItems.type, "page")
      )
    )
    .orderBy(knowledgeItems.lastSyncedAt)
    .limit(1);
  
  return {
    pages_indexed: pagesIndexed,
    last_synced_at: lastSynced?.last_synced_at?.toISOString() || null,
    status: pagesIndexed > 0 ? "indexed" : "pending",
  };
}
