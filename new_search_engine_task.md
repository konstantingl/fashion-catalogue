Technical Specification: AI-Powered Search Engine for Fashion Marketplace
Project Overview
Build a state-of-the-art search engine for a fashion marketplace with 10,000+ clothing items. The engine must deliver exceptional precision for attribute-specific queries (Type 1) and style/vibe-based queries (Type 2), supporting both English and German.
Priority: Quality > Cost. Search latency target: < 1.5 seconds.

Architecture Overview
User Query (EN/DE)
    ↓
[STAGE 1] LLM Query Understanding (Gemini 2.5 Flash)
    ↓
[STAGE 2] Hybrid Retrieval (Keyword + Vector + Attribute)
    ↓
[STAGE 3] Intelligent Fusion (Query-Type Aware)
    ↓
[STAGE 4] Cross-Encoder Reranking (Top 100)
    ↓
Final Results (Top 50)
Total Components:

Gemini 2.5 Flash Lite (query parsing)
Typesense (keyword search)
Pinecone (vector search)
Supabase PostgreSQL (attribute filtering)
Cohere Rerank API (cross-encoder reranking)


Data Preparation Phase
Task 1: Set Up Supabase Schema
Create a products table in Supabase with the following structure:
sqlCREATE TABLE products (
  id TEXT PRIMARY KEY,  -- use item_page_url as ID
  
  -- Original data
  item_page_url TEXT,
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
  confidence_score NUMERIC,
  llm_description TEXT,
  
  -- Metadata
  enrichment_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for filtering
CREATE INDEX idx_enriched_category ON products(enriched_category);
CREATE INDEX idx_attributes ON products USING GIN(attributes);
CREATE INDEX idx_title_search ON products USING GIN(to_tsvector('simple', title));
CREATE INDEX idx_description_search ON products USING GIN(to_tsvector('simple', description));
Implementation Notes:

Migrate from JSON to Supabase on initial setup
Keep JSON as backup/source of truth
Enable Row Level Security if needed for multi-tenancy


Task 2: Generate Vector Embeddings
Service: OpenAI Embeddings API (text-embedding-3-large)
Generate two embeddings per product:
Embedding 1: Factual (for Type 1 queries)
Combines structured attributes with product details.
Text to Embed:
pythondef create_factual_text(product):
    # Extract attributes as readable text
    attrs = []
    for key, value_obj in product['attributes'].items():
        if value_obj['value']:
            attrs.append(f"{key}: {value_obj['value']}")
    
    attributes_str = ", ".join(attrs)
    
    text = f"""
    {product['original_data']['title']}
    {product['original_data']['description']}
    Category: {product['enriched_category']}
    Attributes: {attributes_str}
    Brand: {product['original_data']['brand']}
    """.strip()
    
    return text
```

**Example Input**:
```
LANGER TRENCH MIT GÜRTEL
100% Baumwolle. Water Repellent: Wasserabweisendes technisches Gewebe. 
Langes Design. Gerades Design. Rollkragen. Langarm.
Category: trench_coats_parkas
Attributes: closure: BUTTON, hood: NO, belt: YES, color: BEIGE
Brand: MANGO
Embedding 2: Style/Vibe (for Type 2 queries)
Uses the LLM-generated description which captures visual and stylistic elements.
Text to Embed:
pythondef create_style_text(product):
    return product['llm_description']
```

**Example Input**:
```
This is a long, straight-cut beige trench coat made of cotton. 
It features a roll collar, a single button closure at the neck, 
and a matching fabric belt. The coat has two side pockets and 
a water-repellent finish.
Batch Processing:

Process all 10k products in batches of 100
Store embeddings as arrays
Total: 20k embeddings (2 per product)

Storage Options:

Option A: Store in Supabase as vector columns (if using pgvector extension)
Option B: Store directly in Pinecone with metadata


Task 3: Index Products in Typesense
Service: Typesense Cloud (managed)
Schema:
json{
  "name": "products",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "title", "type": "string"},
    {"name": "description", "type": "string"},
    {"name": "llm_description", "type": "string"},
    {"name": "enriched_category", "type": "string", "facet": true},
    {"name": "brand", "type": "string", "facet": true},
    {"name": "price_eur", "type": "float", "optional": true, "facet": true},
    
    // Flattened attributes for filtering
    {"name": "attr_color", "type": "string", "optional": true, "facet": true},
    {"name": "attr_length", "type": "string", "optional": true, "facet": true},
    {"name": "attr_fit", "type": "string", "optional": true, "facet": true},
    {"name": "attr_closure", "type": "string", "optional": true, "facet": true},
    {"name": "attr_neckline", "type": "string", "optional": true, "facet": true},
    {"name": "attr_sleeve_length", "type": "string", "optional": true, "facet": true},
    // ... add all possible attributes from taxonomy
    
    // Confidence scores for ranking
    {"name": "confidence_score", "type": "float"}
  ],
  "default_sorting_field": "confidence_score"
}
Why Typesense:

Lightweight, fast BM25 search
Built-in multilingual support (German/English)
Typo tolerance
Easy to deploy, no complex setup
Good for your Vercel + lightweight stack

Alternative: Algolia (more expensive but excellent multilingual)

Task 4: Index Embeddings in Pinecone
Service: Pinecone (managed vector database)
Setup:

Create 2 indexes (or 1 index with namespace separation):

products-factual (1536 dimensions for OpenAI embeddings)
products-style (1536 dimensions)



Index Configuration:
python# Pinecone setup
index_config = {
    "dimension": 1536,  # OpenAI text-embedding-3-large
    "metric": "cosine",
    "pod_type": "p1.x1"  # Adjust based on query volume
}
Metadata to Store with Vectors:
json{
  "id": "item_page_url",
  "enriched_category": "trench_coats_parkas",
  "title": "LANGER TRENCH MIT GÜRTEL",
  "brand": "MANGO",
  "confidence_score": 0.75,
  "attributes": {
    "color": "BEIGE",
    "length": "LONG",
    "belt": "YES"
  }
}
```

**Why Pinecone**:
- Fully managed, scales automatically
- Fast similarity search
- Good metadata filtering
- Works well with serverless (Vercel)

**Alternative**: Qdrant Cloud (similar features, slightly cheaper)

---

## Runtime Search Pipeline

### Stage 1: LLM Query Understanding

**Service**: Gemini 2.5 Flash Lite

**Input**: User query (raw text, EN or DE)

**Output**: Structured JSON with query understanding

#### Prompt Template:
```
You are a query parser for a premium fashion e-commerce search engine.

AVAILABLE CATEGORIES:
{categories_list}

ATTRIBUTE TAXONOMY:
{taxonomy_json}

TASK: Parse the user's query into a structured format for retrieval.

QUERY TYPES:
- TYPE_1: Attribute-specific (e.g., "black midi dress", "long trench with belt")
  User explicitly mentions colors, lengths, fits, closures, or other measurable attributes.
  
- TYPE_2: Style/vibe-based (e.g., "cozy winter sweater", "elegant office outfit")
  User describes feelings, occasions, aesthetics, or abstract style concepts.

USER QUERY: "{user_query}"

OUTPUT (valid JSON only):
{
  "query_type": "TYPE_1" | "TYPE_2",
  "language": "en" | "de",
  "categories": ["most_relevant_category"],
  "hard_attributes": {
    // Only attributes EXPLICITLY mentioned or directly implied
    // Use exact enum values from taxonomy
    // Examples: "length": "MIDI", "color": "BLACK", "fit": "OVERSIZED"
  },
  "soft_preferences": {
    "style_vibe": "natural language style description",
    "semantic_keywords": ["key", "descriptive", "words"],
    "occasion": "optional: office/casual/evening/etc"
  },
  "complexity_score": 0.0-1.0
}

RULES:
1. Categories: Return 1-3 most relevant. Empty array [] if truly ambiguous (rare).
2. Hard attributes: Conservative. Only if explicitly stated. Use taxonomy enum values.
3. Soft preferences: 
   - style_vibe: Describe the aesthetic/feeling (for TYPE_2)
   - semantic_keywords: Non-attribute descriptive words
4. Language detection: Based on query language, not product language
5. Complexity score:
   - 0.0-0.3: Simple, clear (e.g., "black dress")
   - 0.4-0.6: Medium (e.g., "cozy oversized sweater for winter")
   - 0.7-1.0: Complex, multi-requirement (e.g., "elegant but casual dress for garden party")

EXAMPLES:

INPUT: "long black trench with belt"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "en",
  "categories": ["trench_coats_parkas", "coats"],
  "hard_attributes": {
    "length": "LONG",
    "color": "BLACK",
    "belt": "YES"
  },
  "soft_preferences": {
    "style_vibe": "classic trench coat style",
    "semantic_keywords": ["trench"],
    "occasion": ""
  },
  "complexity_score": 0.3
}

INPUT: "gemütlicher oversized pullover für den winter"
OUTPUT:
{
  "query_type": "TYPE_2",
  "language": "de",
  "categories": ["sweaters_pullovers"],
  "hard_attributes": {
    "fit": "OVERSIZED"
  },
  "soft_preferences": {
    "style_vibe": "cozy comfortable warm winter layering piece",
    "semantic_keywords": ["gemütlich", "winter", "pullover"],
    "occasion": "casual"
  },
  "complexity_score": 0.5
}

INPUT: "midi dress"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "en",
  "categories": ["dresses"],
  "hard_attributes": {
    "length": "MIDI"
  },
  "soft_preferences": {
    "style_vibe": "",
    "semantic_keywords": ["dress"],
    "occasion": ""
  },
  "complexity_score": 0.2
}

INPUT: "crochet"
OUTPUT:
{
  "query_type": "TYPE_2",
  "language": "en",
  "categories": [],
  "hard_attributes": {},
  "soft_preferences": {
    "style_vibe": "crochet knit texture handmade bohemian",
    "semantic_keywords": ["crochet", "knit", "texture"],
    "occasion": ""
  },
  "complexity_score": 0.6
}

INPUT: "schwarzer Rollkragenpullover"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "de",
  "categories": ["sweaters_pullovers"],
  "hard_attributes": {
    "color": "BLACK",
    "neckline": "TURTLENECK"
  },
  "soft_preferences": {
    "style_vibe": "",
    "semantic_keywords": ["rollkragen", "pullover"],
    "occasion": ""
  },
  "complexity_score": 0.2
}

Now parse this query: "{user_query}"

Return ONLY valid JSON, no other text.
Implementation Notes:

Call Gemini API with JSON mode enabled
Set temperature=0 for consistency
Validate output JSON structure
Fallback: If parsing fails, treat as TYPE_2 with raw query as style_vibe
Cache common queries (optional optimization)


Stage 2: Hybrid Retrieval
Execute three parallel searches based on parsed query:
2A. Keyword Search (Typesense)
Logic:
typescriptasync function keywordSearch(parsedQuery) {
  const searchTerms = [
    ...parsedQuery.soft_preferences.semantic_keywords,
    ...Object.values(parsedQuery.hard_attributes)
  ].join(' ');
  
  const filters = [];
  
  // Category filter (if specified)
  if (parsedQuery.categories.length > 0) {
    filters.push(`enriched_category:[${parsedQuery.categories.join(',')}]`);
  }
  
  // Hard attribute filters
  for (const [attr, value] of Object.entries(parsedQuery.hard_attributes)) {
    filters.push(`attr_${attr}:=${value}`);
  }
  
  const searchParams = {
    q: searchTerms,
    query_by: 'title,description,llm_description',
    filter_by: filters.join(' && '),
    per_page: 200,
    // Boost by confidence
    sort_by: '_text_match:desc,confidence_score:desc'
  };
  
  return typesense.collections('products').documents().search(searchParams);
}
Why 200 results: Cast a wide net for fusion stage.

2B. Vector Semantic Search (Pinecone)
Logic:
typescriptasync function vectorSearch(parsedQuery) {
  // Determine which index to use based on query type
  const indexName = parsedQuery.query_type === 'TYPE_1' 
    ? 'products-factual' 
    : 'products-style';
  
  // Construct query text for embedding
  let queryText;
  if (parsedQuery.query_type === 'TYPE_1') {
    // Type 1: Combine attributes and keywords
    const attrStrings = Object.entries(parsedQuery.hard_attributes)
      .map(([k, v]) => `${k}: ${v}`);
    queryText = [
      ...attrStrings,
      ...parsedQuery.soft_preferences.semantic_keywords
    ].join(', ');
  } else {
    // Type 2: Focus on style and vibe
    queryText = [
      parsedQuery.soft_preferences.style_vibe,
      ...parsedQuery.soft_preferences.semantic_keywords
    ].join(' ');
  }
  
  // Generate embedding via OpenAI
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: queryText
  });
  
  // Search in Pinecone
  const vectorResults = await pinecone.query({
    vector: queryEmbedding.data[0].embedding,
    topK: 200,
    includeMetadata: true,
    // Optional: filter by category if specified
    filter: parsedQuery.categories.length > 0 
      ? { enriched_category: { $in: parsedQuery.categories } }
      : undefined
  });
  
  return vectorResults;
}

2C. Attribute-Based Filtering (Supabase)
Logic:
typescriptasync function attributeFilter(parsedQuery) {
  let query = supabase.from('products').select('*');
  
  // Category filter
  if (parsedQuery.categories.length > 0) {
    query = query.in('enriched_category', parsedQuery.categories);
  }
  
  // Hard attribute filters
  for (const [attr, value] of Object.entries(parsedQuery.hard_attributes)) {
    query = query.eq(`attributes->${attr}->>value`, value);
  }
  
  // Prefer high confidence items
  query = query.order('confidence_score', { ascending: false });
  query = query.limit(300);
  
  return await query;
}
Important: This gives you items that match ALL hard attributes. These should be prioritized in fusion.

Stage 3: Intelligent Fusion
Goal: Combine results from 3 sources with query-type-aware weighting.
Algorithm: Weighted Reciprocal Rank Fusion
typescriptfunction intelligentFusion(
  keywordResults,    // From Typesense
  vectorResults,     // From Pinecone
  attributeResults,  // From Supabase
  parsedQuery
) {
  // Determine weights based on query type
  const weights = parsedQuery.query_type === 'TYPE_1'
    ? { keyword: 0.30, vector: 0.20, attribute: 0.50 }
    : { keyword: 0.20, vector: 0.60, attribute: 0.20 };
  
  // Adjust weights if complexity is high
  if (parsedQuery.complexity_score > 0.7) {
    // For complex queries, rely more on semantic understanding
    weights.vector += 0.15;
    weights.keyword -= 0.10;
    weights.attribute -= 0.05;
  }
  
  const itemScores = new Map();
  
  // Process each source
  function addScores(results, sourceName, weight) {
    results.forEach((item, index) => {
      const itemId = item.id;
      const rank = index + 1;
      const rrfScore = 1 / (rank + 60); // RRF with k=60
      
      const currentScore = itemScores.get(itemId) || {
        id: itemId,
        score: 0,
        sources: [],
        item: item
      };
      
      currentScore.score += weight * rrfScore;
      currentScore.sources.push(sourceName);
      itemScores.set(itemId, currentScore);
    });
  }
  
  addScores(keywordResults, 'keyword', weights.keyword);
  addScores(vectorResults, 'vector', weights.vector);
  addScores(attributeResults, 'attribute', weights.attribute);
  
  // Boost items that appear in multiple sources
  itemScores.forEach(item => {
    if (item.sources.length >= 2) {
      item.score *= 1.15; // 15% boost for consensus
    }
    if (item.sources.length === 3) {
      item.score *= 1.10; // Additional 10% for all sources
    }
  });
  
  // Sort by score and return top 500
  const sortedItems = Array.from(itemScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 500);
  
  return sortedItems;
}
Key Innovation: Query-type-aware weights ensure:

Type 1 queries prioritize exact attribute matches
Type 2 queries prioritize semantic similarity
Complex queries rely more on understanding


Stage 4: Cross-Encoder Reranking
Service: Cohere Rerank API
Goal: Final precision ranking of top candidates.
Logic:
typescriptasync function rerankResults(fusedResults, parsedQuery, originalQuery) {
  // Take top 100 from fusion (or more if complexity is high)
  const topK = parsedQuery.complexity_score > 0.7 ? 150 : 100;
  const candidates = fusedResults.slice(0, topK);
  
  // Prepare documents for reranking
  const documents = candidates.map(item => {
    // Construct rich document text
    const product = item.item;
    
    // Include attributes as text
    const attrs = Object.entries(product.attributes || {})
      .filter(([_, v]) => v.value)
      .map(([k, v]) => `${k}: ${v.value}`)
      .join(', ');
    
    return {
      id: product.id,
      text: `${product.title}. ${product.llm_description}. Attributes: ${attrs}. Brand: ${product.brand}.`
    };
  });
  
  // Call Cohere Rerank
  const reranked = await cohere.rerank({
    model: 'rerank-multilingual-v3.0',  // Supports EN/DE
    query: originalQuery,
    documents: documents.map(d => d.text),
    top_n: 100,
    return_documents: false
  });
  
  // Combine Cohere score with attribute match score
  const finalScores = reranked.results.map(result => {
    const product = candidates[result.index].item;
    const cohereScore = result.relevance_score; // 0-1
    
    // Calculate attribute match score
    const attrScore = calculateAttributeMatchScore(
      product.attributes,
      parsedQuery.hard_attributes
    );
    
    // Confidence penalty for missing/low-confidence attributes
    const confidencePenalty = 1 - (product.confidence_score * 0.1);
    
    // Weighted combination based on query type
    let finalScore;
    if (parsedQuery.query_type === 'TYPE_1') {
      // Type 1: Attributes matter more
      finalScore = (0.50 * cohereScore) + (0.45 * attrScore) + (0.05 * confidencePenalty);
    } else {
      // Type 2: Semantic understanding matters more
      finalScore = (0.75 * cohereScore) + (0.20 * attrScore) + (0.05 * confidencePenalty);
    }
    
    return {
      product: product,
      score: finalScore,
      cohere_score: cohereScore,
      attribute_score: attrScore
    };
  });
  
  // Sort by final score
  return finalScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

function calculateAttributeMatchScore(productAttrs, queryAttrs) {
  if (Object.keys(queryAttrs).length === 0) return 1.0;
  
  let matches = 0;
  let total = 0;
  
  for (const [attr, expectedValue] of Object.entries(queryAttrs)) {
    total++;
    const productAttr = productAttrs[attr];
    
    if (!productAttr || !productAttr.value) {
      // Missing attribute: small penalty
      matches += 0.3;
    } else if (productAttr.value === expectedValue) {
      // Perfect match: weighted by confidence
      matches += productAttr.confidence;
    } else {
      // Wrong value: no points
      matches += 0;
    }
  }
  
  return matches / total;
}
Why Cohere Rerank:

State-of-art reranking model
Multilingual (EN/DE) support
Purpose-built for this exact task
Fast API, works with serverless
More consistent than LLM prompting

Cost: ~$1 per 1000 searches (assuming 100 docs per search)
Alternative: Run cross-encoder/ms-marco-MiniLM-L-12-v2 via Hugging Face Inference API

API Implementation (Vercel Edge Function)
Endpoint: POST /api/search
Request:
json{
  "query": "long black trench with belt",
  "limit": 50
}
Response:
json{
  "results": [
    {
      "id": "https://...",
      "title": "LANGER TRENCH MIT GÜRTEL",
      "brand": "MANGO",
      "price_eur": 149.99,
      "images_url": ["https://..."],
      "llm_description": "This is a long...",
      "attributes": {...},
      "relevance_score": 0.95,
      "match_explanation": {
        "attribute_matches": ["length: LONG", "color: BLACK", "belt: YES"],
        "style_match": "classic trench style"
      }
    },
    ...
  ],
  "query_understanding": {
    "query_type": "TYPE_1",
    "interpreted_as": "Looking for a long black trench coat with belt"
  },
  "total_searched": 10000,
  "search_time_ms": 1247
}
Implementation Flow:
typescriptexport default async function handler(req: Request) {
  const startTime = Date.now();
  const { query, limit = 50 } = await req.json();
  
  // Stage 1: Parse query with Gemini
  const parsedQuery = await parseQueryWithLLM(query);
  
  // Stage 2: Parallel retrieval
  const [keywordResults, vectorResults, attributeResults] = await Promise.all([
    keywordSearch(parsedQuery),
    vectorSearch(parsedQuery),
    attributeFilter(parsedQuery)
  ]);
  
  // Stage 3: Fusion
  const fusedResults = intelligentFusion(
    keywordResults,
    vectorResults,
    attributeResults,
    parsedQuery
  );
  
  // Stage 4: Rerank
  const finalResults = await rerankResults(fusedResults, parsedQuery, query);
  
  const searchTime = Date.now() - startTime;
  
  return Response.json({
    results: finalResults.slice(0, limit).map(r => r.product),
    query_understanding: {
      query_type: parsedQuery.query_type,
      interpreted_as: generateInterpretation(parsedQuery)
    },
    total_searched: 10000,
    search_time_ms: searchTime
  });
}

Testing & Quality Assurance
Test Query Suite
Create a test suite with expected results:
Type 1 Queries:
javascript[
  {
    query: "long black trench with belt",
    expected_categories: ["trench_coats_parkas", "coats"],
    must_have_attributes: { length: "LONG", color: "BLACK", belt: "YES" }
  },
  {
    query: "schwarzer Rollkragenpullover",
    expected_categories: ["sweaters_pullovers"],
    must_have_attributes: { color: "BLACK", neckline: "TURTLENECK" }
  },
  {
    query: "midi dress",
    expected_categories: ["dresses"],
    must_have_attributes: { length: "MIDI" }
  },
  {
    query: "oversized blazer",
    expected_categories: ["blazers", "jackets"],
    must_have_attributes: { fit: "OVERSIZED" }
  }
]
Type 2 Queries:
javascript[
  {
    query: "cozy winter sweater",
    expected_style_keywords: ["cozy", "warm", "comfortable"],
    expected_categories: ["sweaters_pullovers"]
  },
  {
    query: "elegant office dress",
    expected_style_keywords: ["elegant", "professional", "office"],
    expected_categories: ["dresses"]
  },
  {
    query: "crochet",
    expected_style_keywords: ["crochet", "knit", "texture"],
    expected_categories: []  // Cross-category
  }
]
Evaluation Metrics
For each test query, measure:

Precision@10: How many of top 10 results are relevant?
Attribute Match Rate: For Type 1, do results have correct attributes?
Style Relevance: For Type 2, manual review of top 10
Latency: < 1.5s target
Query Understanding Accuracy: Does LLM parse correctly?

Target Metrics:

Precision@10: > 90% for Type 1, > 80% for Type 2
Attribute Match Rate: > 95% for Type 1
Latency: < 1.5s (p95)


Cost Estimation (per 1000 searches)

Gemini 2.5 Flash: ~$0.10 (query parsing)
OpenAI Embeddings: ~$0.02 (query embedding)
Pinecone: ~$0.10 (vector search)
Typesense: ~$0.05 (keyword search)
Cohere Rerank: ~$1.00 (100 docs per search)
Supabase: ~$0.03 (attribute filtering)

Total: ~$1.30 per 1000 searches = $0.0013 per search
For 10k searches/month: ~$13/month + base infrastructure costs

Implementation Priority
Phase 1: Core Pipeline (Week 1-2)

Set up Supabase schema
Generate embeddings (OpenAI)
Index in Typesense
Index in Pinecone
Implement LLM query parsing (Gemini)
Basic retrieval (just vector search)
Simple ranking

Phase 2: Hybrid Retrieval (Week 3)

Add keyword search (Typesense)
Add attribute filtering (Supabase)
Implement fusion logic
Test with Type 1 queries

Phase 3: Precision Ranking (Week 4)

Integrate Cohere Rerank
Implement query-type-aware weighting
Add attribute match scoring
Test with Type 2 queries

Phase 4: Optimization (Week 5)

Add caching (common queries)
Optimize latency
Add logging/analytics
A/B testing framework


Monitoring & Analytics
Track these metrics:

Query Distribution:

Type 1 vs Type 2 ratio
Language distribution (EN vs DE)
Complexity score distribution


Performance:

Latency by stage
API costs
Cache hit rate


Quality:

Zero-result queries (should be < 5%)
Click-through rate on top 3 results
User engagement time


Errors:

LLM parsing failures
API timeouts
Invalid results




Edge Cases & Handling

Empty results after fusion:

Relax category filter
Broaden attribute matching (fuzzy)
Fall back to pure semantic search


Ambiguous queries ("red"):

Prompt user: "Looking for red dresses, tops, or coats?"
Or return diverse results across categories


Brand-specific queries ("H&M sweater"):

Detect brand in query parsing
Add as hard filter


Price queries ("under 50 euros"):

Extract price range in query parsing
Filter in Typesense/Supabase


Multi-language results:

Display in user's query language context
Don't penalize German items for English queries




Success Criteria
The search engine is successful if:
✅ Type 1 queries: 95%+ of top 10 results match all specified attributes
✅ Type 2 queries: 85%+ of top 10 results match the style/vibe intent
✅ Cross-category queries (crochet): Return relevant items from multiple categories
✅ Multilingual: Works equally well for EN and DE queries
✅ Latency: < 1.5s for 95% of queries
✅ Zero results: < 5% of queries
✅ User satisfaction: High click-through rate on top 3 results

Notes for Engineer

Code organization: Separate concerns (parsing, retrieval, fusion, reranking)
Error handling: Graceful degradation (if one source fails, continue with others)
Logging: Log all stages for debugging
Type safety: Use TypeScript interfaces for all data structures
Testing: Unit tests for fusion logic, integration tests for full pipeline
Documentation: Document all configuration parameters and thresholds

This is a production-grade search system. Focus on making each component robust and testable. The quality of results depends on careful implementation of the fusion and reranking logic.