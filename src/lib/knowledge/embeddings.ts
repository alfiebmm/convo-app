/**
 * Embeddings and chunking utilities (CON-85)
 * 
 * Chunks text at ~500 tokens with 50-token overlap.
 * Generates embeddings using OpenAI text-embedding-3-small (1536 dims).
 */
import OpenAI from "openai";

const CHUNK_SIZE = 500; // tokens (approximate)
const CHUNK_OVERLAP = 50; // tokens (approximate)
const AVG_CHARS_PER_TOKEN = 4; // rough approximation

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

export interface TextChunk {
  text: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
}

/**
 * Split text into chunks with overlap.
 * Uses simple word-based approximation for token counting.
 */
export function chunkText(text: string): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: TextChunk[] = [];
  const chunkCharSize = CHUNK_SIZE * AVG_CHARS_PER_TOKEN;
  const overlapCharSize = CHUNK_OVERLAP * AVG_CHARS_PER_TOKEN;
  
  let start = 0;
  let chunkIndex = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkCharSize, text.length);
    
    // Find word boundary for clean breaks
    let chunkEnd = end;
    if (end < text.length) {
      const nextSpace = text.indexOf(" ", end);
      if (nextSpace !== -1 && nextSpace - end < 50) {
        chunkEnd = nextSpace;
      }
    }
    
    const chunkText = text.slice(start, chunkEnd).trim();
    
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        chunkIndex,
        charStart: start,
        charEnd: chunkEnd,
      });
      chunkIndex++;
    }
    
    // Move start with overlap
    start = chunkEnd - overlapCharSize;
    
    // Ensure we make progress
    if (start <= chunks[chunks.length - 1]?.charStart && end >= text.length) {
      break;
    }
  }
  
  return chunks;
}

/**
 * Generate embedding for a single text chunk using OpenAI.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("[Embeddings] Failed to generate embedding:", error);
    throw error;
  }
}

/**
 * Batch generate embeddings for multiple text chunks.
 * Returns embeddings in the same order as input.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  const openai = getOpenAI();
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
      encoding_format: "float",
    });
    
    // Ensure order matches input
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  } catch (error) {
    console.error("[Embeddings] Failed to generate batch embeddings:", error);
    throw error;
  }
}

/**
 * Convert embedding array to pgvector-compatible format.
 * Returns a string representation: "[0.1, 0.2, ...]"
 */
export function formatEmbeddingForDB(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
