-- Enable pgvector extension (Supabase has this; no-op if not available)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge item status enum
DO $$ BEGIN
  CREATE TYPE knowledge_item_status AS ENUM ('pending', 'processing', 'indexed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Knowledge item type enum
DO $$ BEGIN
  CREATE TYPE knowledge_item_type AS ENUM ('page', 'file');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Knowledge items table (shared by site scraper and file upload features)
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type knowledge_item_type NOT NULL,
  
  -- For 'page' type: source URL; for 'file': null (parent_id links to knowledge_files)
  source_url TEXT,
  
  -- For 'file' chunks: links to parent file record (CON-87 will create knowledge_files table)
  parent_id UUID,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- SHA-256 for change detection
  
  -- Metadata: for 'page': { meta_description, h1, internal_links: [], chunk_index? }
  --           for 'file': { chunk_index, original_filename }
  metadata JSONB DEFAULT '{}' NOT NULL,
  
  -- Embedding: pgvector if available, else float8[]
  embedding vector(1536), -- Falls back gracefully if extension not available
  
  status knowledge_item_status DEFAULT 'pending' NOT NULL,
  last_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS knowledge_items_tenant_type_idx ON knowledge_items(tenant_id, type);
CREATE INDEX IF NOT EXISTS knowledge_items_tenant_url_idx ON knowledge_items(tenant_id, source_url);
CREATE INDEX IF NOT EXISTS knowledge_items_tenant_parent_idx ON knowledge_items(tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS knowledge_items_status_idx ON knowledge_items(tenant_id, status);

-- If pgvector is available, add HNSW index for fast similarity search
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS knowledge_items_embedding_idx 
    ON knowledge_items USING hnsw (embedding vector_cosine_ops);
EXCEPTION
  WHEN undefined_object THEN 
    -- pgvector not available, skip index
    NULL;
END $$;
