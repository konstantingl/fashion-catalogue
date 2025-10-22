-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,  -- use item_page_url as ID

  -- Original data
  item_page_url TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  price_eur NUMERIC,
  title TEXT,
  description TEXT,
  images_url JSONB,

  -- Enriched data
  enriched_category TEXT,
  attributes JSONB,
  missing_attributes TEXT[],
  confidence_score NUMERIC DEFAULT 0,
  llm_description TEXT,
  llm_description_metadata JSONB,
  valid_images_count INTEGER,
  enrichment_timestamp TIMESTAMP,

  -- Vector embeddings (1536 dimensions for text-embedding-3-large)
  factual_embedding vector(1536),
  style_embedding vector(1536),

  -- Search vector for full-text search
  search_vector tsvector,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_enriched_category ON products(enriched_category);
CREATE INDEX IF NOT EXISTS idx_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_confidence_score ON products(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_attributes ON products USING GIN(attributes);
CREATE INDEX IF NOT EXISTS idx_search_vector ON products USING GIN(search_vector);

-- Vector similarity indexes (using HNSW for faster searches)
CREATE INDEX IF NOT EXISTS idx_factual_embedding ON products
USING hnsw (factual_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_style_embedding ON products
USING hnsw (style_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.llm_description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'D');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search_vector on insert/update
DROP TRIGGER IF EXISTS trigger_update_search_vector ON products;
CREATE TRIGGER trigger_update_search_vector
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- Function for vector similarity search (factual)
CREATE OR REPLACE FUNCTION vector_search_factual(
  query_embedding vector(1536),
  match_limit int DEFAULT 200,
  category_filter text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  item_page_url text,
  category text,
  brand text,
  price_eur numeric,
  title text,
  description text,
  images_url jsonb,
  enriched_category text,
  attributes jsonb,
  confidence_score numeric,
  llm_description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.item_page_url,
    p.category,
    p.brand,
    p.price_eur,
    p.title,
    p.description,
    p.images_url,
    p.enriched_category,
    p.attributes,
    p.confidence_score,
    p.llm_description,
    1 - (p.factual_embedding <=> query_embedding) as similarity
  FROM products p
  WHERE
    (category_filter IS NULL OR p.enriched_category = ANY(category_filter))
    AND p.factual_embedding IS NOT NULL
  ORDER BY p.factual_embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Function for vector similarity search (style)
CREATE OR REPLACE FUNCTION vector_search_style(
  query_embedding vector(1536),
  match_limit int DEFAULT 200,
  category_filter text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  item_page_url text,
  category text,
  brand text,
  price_eur numeric,
  title text,
  description text,
  images_url jsonb,
  enriched_category text,
  attributes jsonb,
  confidence_score numeric,
  llm_description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.item_page_url,
    p.category,
    p.brand,
    p.price_eur,
    p.title,
    p.description,
    p.images_url,
    p.enriched_category,
    p.attributes,
    p.confidence_score,
    p.llm_description,
    1 - (p.style_embedding <=> query_embedding) as similarity
  FROM products p
  WHERE
    (category_filter IS NULL OR p.enriched_category = ANY(category_filter))
    AND p.style_embedding IS NOT NULL
  ORDER BY p.style_embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Helper function to check if pgvector is available
CREATE OR REPLACE FUNCTION check_pgvector()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  );
END;
$$ LANGUAGE plpgsql;

-- Create view for product stats
CREATE OR REPLACE VIEW product_stats AS
SELECT
  COUNT(*) as total_products,
  COUNT(factual_embedding) as products_with_factual_embedding,
  COUNT(style_embedding) as products_with_style_embedding,
  COUNT(CASE WHEN factual_embedding IS NOT NULL AND style_embedding IS NOT NULL THEN 1 END) as products_fully_indexed,
  COUNT(DISTINCT enriched_category) as total_categories,
  COUNT(DISTINCT brand) as total_brands,
  AVG(confidence_score) as avg_confidence_score,
  MIN(price_eur) as min_price,
  MAX(price_eur) as max_price,
  AVG(price_eur) as avg_price
FROM products;

-- Grant permissions (adjust as needed)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public products are viewable by everyone" ON products FOR SELECT USING (true);

COMMENT ON TABLE products IS 'Fashion marketplace products with vector embeddings for semantic search';
COMMENT ON COLUMN products.factual_embedding IS 'Embedding based on factual attributes (title, description, category, attributes) - 1536 dimensions';
COMMENT ON COLUMN products.style_embedding IS 'Embedding based on style/vibe description (llm_description) - 1536 dimensions';
COMMENT ON COLUMN products.search_vector IS 'Full-text search vector (automatically maintained)';
