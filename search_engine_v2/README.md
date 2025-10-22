# Fashion Search Engine v2

AI-powered hybrid search engine for fashion marketplace with 10,000+ products.

## Architecture

4-stage search pipeline:

1. **LLM Query Understanding** (Gemini 2.5 Flash Lite)
   - Parse natural language queries (EN/DE)
   - Classify as TYPE_1 (attribute-specific) or TYPE_2 (style/vibe)
   - Extract categories, attributes, and preferences

2. **Hybrid Retrieval** (Parallel Execution)
   - Vector semantic search (Supabase pgvector)
   - Attribute-based filtering (PostgreSQL)
   - Keyword search (Full-text search)

3. **Intelligent Fusion**
   - Weighted Reciprocal Rank Fusion (RRF)
   - Query-type-aware weighting
   - Consensus bonuses for multi-source matches

4. **Attribute-Based Reranking**
   - Precision scoring for TYPE_1 queries
   - Semantic scoring for TYPE_2 queries
   - Confidence-weighted final ranking

## Tech Stack

- **Database**: Supabase PostgreSQL + pgvector
- **Vector Search**: Supabase pgvector (1536 dimensions)
- **LLM**: Google Gemini 2.5 Flash Lite
- **Embeddings**: OpenAI text-embedding-3-large (1536 dims)
- **Language**: Node.js + ES Modules

## Setup

### 1. Install Dependencies

```bash
cd search_engine_v2
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your API keys:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

### 3. Set Up Database

Run the SQL schema in Supabase SQL Editor:

```bash
# Copy contents of data/schema.sql to Supabase SQL Editor
# This creates:
# - products table with vector columns
# - Indexes (HNSW for vectors, GIN for JSONB/full-text)
# - RPC functions for vector search
# - Triggers for automatic search_vector updates
```

### 4. Migrate Data

```bash
npm run migrate
```

This will:
- Load products from `../data/products.json`
- Transform and insert into Supabase
- ~10k products in batches of 100

### 5. Generate Embeddings

```bash
npm run generate-embeddings
```

This will:
- Generate factual + style embeddings for each product
- Use OpenAI text-embedding-3-large (3072 dimensions)
- Process in batches with rate limiting
- Est. cost: ~$1-2 for 10k products
- Est. time: ~15-20 minutes

Options:
```bash
# Limit to first 100 products (for testing)
npm run generate-embeddings -- --limit 100

# Custom batch size
npm run generate-embeddings -- --batch-size 50
```

## Usage

### As API Endpoint

```javascript
import { search } from './api/search.js';

const result = await search('long black trench with belt', { limit: 50 });

console.log(result.results);          // Top 50 products
console.log(result.query_understanding); // How query was interpreted
console.log(result.search_time_ms);   // Total latency
```

### Vercel Deployment

Deploy to Vercel Edge Functions:

```bash
# Add to vercel.json:
{
  "functions": {
    "search_engine_v2/api/search.js": {
      "runtime": "edge"
    }
  }
}
```

Then call from frontend:
```javascript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'cozy winter sweater', limit: 50 })
});

const data = await response.json();
```

## Testing

### Run Test Suite

```bash
npm test
```

### Test Queries

See `tests/test_queries.json` for example queries:

**TYPE_1 (Attribute-specific)**:
- "long black trench with belt"
- "midi dress"
- "schwarzer Rollkragenpullover"

**TYPE_2 (Style/vibe)**:
- "cozy winter sweater"
- "elegant office dress"
- "crochet"

## Configuration

All settings in `config/config.js`:

### Retrieval Settings
```javascript
vectorTopK: 200,        // Vector search results
attributeTopK: 300,     // Attribute filter results
keywordTopK: 200,       // Keyword search results
fusionTopK: 500,        // Items after fusion
finalResultsLimit: 50   // Final results to return
```

### Fusion Weights

**TYPE_1 (Attribute queries)**:
- Keyword: 30%
- Vector: 20%
- Attribute: 50% ← Prioritize exact matches

**TYPE_2 (Style queries)**:
- Keyword: 20%
- Vector: 60% ← Prioritize semantic similarity
- Attribute: 20%

### Reranking Weights

**TYPE_1**:
- Fusion score: 50%
- Attribute match: 45%
- Confidence penalty: 5%

**TYPE_2**:
- Fusion score: 75%
- Attribute match: 20%
- Confidence penalty: 5%

## Performance

### Latency Target
< 2 seconds (p95)

### Stage Breakdown (typical)
- Stage 1 (Query parsing): ~200-500ms
- Stage 2 (Hybrid retrieval): ~300-600ms
- Stage 3 (Fusion): ~50-100ms
- Stage 4 (Reranking): ~30-50ms
- **Total**: ~600-1300ms ✅

### Cost (per 1000 searches)
- Gemini 2.5 Flash Lite: ~$0.05 (even cheaper than 2.0!)
- OpenAI Embeddings: ~$0.02
- Supabase: ~$0.03 (free tier)
- **Total**: ~$0.10 per 1000 searches

## API Response Format

```json
{
  "results": [
    {
      "id": "https://...",
      "title": "LANGER TRENCH MIT GÜRTEL",
      "brand": "MANGO",
      "price_eur": 149.99,
      "images_url": ["https://..."],
      "llm_description": "This is a long...",
      "enriched_category": "trench_coats_parkas",
      "attributes": { "length": { "value": "LONG", "confidence": 0.9 } },
      "relevance_score": 0.95,
      "match_explanation": {
        "attribute_matches": ["length: LONG", "color: BLACK"],
        "style_match": "",
        "sources": ["vector", "attribute", "keyword"],
        "fusion_score": 0.85,
        "attribute_score": 0.98
      }
    }
  ],
  "query_understanding": {
    "query_type": "TYPE_1",
    "language": "en",
    "interpreted_as": "Looking for specific attributes: in trench coats, parkas with length: LONG, color: BLACK",
    "categories": ["trench_coats_parkas"],
    "hard_attributes": { "length": "LONG", "color": "BLACK" },
    "complexity_score": 0.3
  },
  "retrieval_stats": {
    "vector_results": 200,
    "attribute_results": 45,
    "keyword_results": 120,
    "fused_unique": 275,
    "consensus_all3": 12,
    "consensus_any2": 58
  },
  "fusion_weights": {
    "keyword": 0.3,
    "vector": 0.2,
    "attribute": 0.5
  },
  "total_searched": 365,
  "search_time_ms": 847,
  "stage_timings": {
    "retrieval_ms": 435,
    "fusion_ms": 67,
    "reranking_ms": 42
  }
}
```

## Troubleshooting

### "pgvector extension not found"
Run in Supabase SQL Editor:
```sql
CREATE EXTENSION vector;
```

### "OpenAI API rate limit"
Reduce batch size in generate_embeddings.js:
```bash
npm run generate-embeddings -- --batch-size 50
```

### "No results returned"
Check:
1. Embeddings generated? (Run generate_embeddings.js)
2. Products migrated? (Run migrate_to_supabase.js)
3. API keys valid?

### "Slow searches"
1. Check database indexes exist (see schema.sql)
2. Reduce `vectorTopK`, `attributeTopK`, `keywordTopK` in config
3. Enable query caching (already enabled by default)

## Future Optimizations

- [ ] Add Typesense for better keyword search
- [ ] Add Pinecone for dedicated vector DB
- [ ] Add Cohere Rerank for cross-encoder reranking
- [ ] Implement query result caching (Redis)
- [ ] Add A/B testing framework
- [ ] Add analytics/logging

## License

MIT
