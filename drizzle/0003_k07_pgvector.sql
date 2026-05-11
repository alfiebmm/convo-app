-- K-07 / CON-89: convert embedding column from text(JSON-array) to vector(1536)
-- and add an HNSW index for fast cosine-similarity retrieval.
--
-- Embeddings were stored as text containing the JSON-array form
-- ("[0.01,0.02,...]"). Postgres' implicit text -> vector cast accepts that
-- format directly so the USING clause is a no-op data-wise; it just retypes
-- the column. After this migration the embedding column is a real
-- pgvector(1536) value and we can use the <=> operator + HNSW index for
-- millisecond-scale cosine similarity at chat time.
ALTER TABLE knowledge_items
  ALTER COLUMN embedding TYPE vector(1536)
  USING (CASE WHEN embedding IS NULL THEN NULL ELSE embedding::vector(1536) END);

-- HNSW index on cosine distance. Conservative parameters \u2014 fine for tens of
-- thousands of rows. Tune later if we exceed ~500k chunks across tenants.
CREATE INDEX IF NOT EXISTS knowledge_items_embedding_hnsw_idx
  ON knowledge_items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
