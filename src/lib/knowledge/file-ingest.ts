/**
 * File ingestion pipeline: extract text, chunk, embed, and store in knowledge_items.
 * Supports PDF, DOCX, and TXT files.
 */
import OpenAI from "openai";
import mammoth from "mammoth";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSupabaseClient } from "@/lib/supabase-client";

const CHUNK_SIZE = 500; // tokens (approx ~500 tokens = ~2000 chars)
const CHUNK_OVERLAP = 50; // tokens

interface ChunkResult {
  content: string;
  chunkIndex: number;
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

/**
 * Extract text from file buffer based on MIME type.
 */
async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "application/pdf": {
      // Dynamic import for pdf-parse ESM
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "text/plain": {
      return buffer.toString("utf-8");
    }
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
}

/**
 * Chunk text into overlapping segments.
 * Simple approach: split by ~2000 char blocks with 200 char overlap.
 */
function chunkText(text: string): ChunkResult[] {
  const chars = text.trim();
  const chunkCharSize = CHUNK_SIZE * 4; // rough token-to-char ratio
  const overlapCharSize = CHUNK_OVERLAP * 4;

  const chunks: ChunkResult[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < chars.length) {
    const end = Math.min(offset + chunkCharSize, chars.length);
    const chunk = chars.slice(offset, end).trim();

    if (chunk.length > 0) {
      chunks.push({
        content: chunk,
        chunkIndex,
      });
      chunkIndex++;
    }

    offset += chunkCharSize - overlapCharSize;
  }

  return chunks;
}

/**
 * Generate embedding for a text chunk using OpenAI text-embedding-3-small.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Main ingestion flow: download file, extract text, chunk, embed, store.
 * Updates knowledgeFiles status to 'indexed' or 'failed'.
 */
export async function ingestFile(fileId: string): Promise<void> {
  try {
    // 1. Fetch file metadata
    const [file] = await db
      .select()
      .from(knowledgeFiles)
      .where(eq(knowledgeFiles.id, fileId))
      .limit(1);

    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    // Update status to processing
    await db
      .update(knowledgeFiles)
      .set({ status: "processing" })
      .where(eq(knowledgeFiles.id, fileId));

    // 2. Download file from Supabase Storage
    const supabase = getSupabaseClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("knowledge-files")
      .download(file.storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // 3. Extract text
    const text = await extractText(buffer, file.mimeType);

    if (!text || text.trim().length === 0) {
      throw new Error("No text content extracted from file");
    }

    // 4. Chunk text
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No chunks generated from text");
    }

    // 5. Embed and insert chunks
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);

      await db.insert(knowledgeItems).values({
        tenantId: file.tenantId,
        type: "file",
        parentId: file.id,
        sourceUrl: null,
        title: `${file.originalFilename} - Chunk ${chunk.chunkIndex + 1}`,
        content: chunk.content,
        contentHash: "", // Not used for file chunks, can compute SHA-256 if needed
        embedding: JSON.stringify(embedding),
        metadata: {
          chunkIndex: chunk.chunkIndex,
          originalFilename: file.originalFilename,
        },
        status: "indexed",
      });
    }

    // 6. Mark as indexed
    await db
      .update(knowledgeFiles)
      .set({
        status: "indexed",
        indexedAt: new Date(),
      })
      .where(eq(knowledgeFiles.id, fileId));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Mark as failed
    await db
      .update(knowledgeFiles)
      .set({
        status: "failed",
        errorMessage,
      })
      .where(eq(knowledgeFiles.id, fileId));

    throw err; // Re-throw for logging
  }
}
