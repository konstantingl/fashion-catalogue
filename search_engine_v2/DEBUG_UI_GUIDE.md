# Search Debug UI - Quick Start Guide

## Overview

The Search Debug UI provides real-time visualization of the AI-powered search pipeline, allowing you to see exactly what happens behind the scenes when a user searches for products.

## Quick Start

### 1. Start the Debug Server

```bash
cd search_engine_v2
npm run debug
```

You should see:
```
✓ Configuration valid
🔍 Search Debug Server running at http://localhost:3001
   API: http://localhost:3001/api/search/debug
   UI:  http://localhost:3001
```

### 2. Open the UI

Open your browser to: **http://localhost:3001**

### 3. Try a Search

The default query "long black trench with belt" is already populated. Click **Search** to see the full pipeline in action.

## Understanding the UI

### Summary Section
Shows high-level metrics:
- **Total Time:** End-to-end search latency
- **Query Type:** TYPE_1 (attribute-specific) or TYPE_2 (style-based)
- **Vector/Attribute/Keyword Results:** Count from each retrieval source
- **Unique Items:** Total unique products after fusion

### Stage 1: Query Parsing
Shows how the LLM understood your query:
- **Query Type Badge:** Color-coded (purple for TYPE_1, magenta for TYPE_2)
- **Language Badge:** Green for English, orange for German
- **Complexity Score:** 0.0-1.0 indicating query complexity
- **Categories:** Product categories identified
- **Hard Attributes:** Exact attributes extracted (color, length, fit, etc.)
- **Style Vibe:** For TYPE_2 queries, the aesthetic/feeling

### Stage 2: Hybrid Retrieval
Shows results from all 3 search methods:

**Vector Search (Semantic)**
- Uses OpenAI embeddings to find semantically similar products
- Good for: Style-based queries, synonyms, conceptual matching
- Example: "cozy sweater" matches "comfortable pullover"

**Attribute Filter (Precise)**
- Direct database queries on structured attributes
- Good for: Exact specifications like "black midi dress"
- Example: length=MIDI AND color=BLACK

**Keyword Search (Full-Text)**
- PostgreSQL full-text search on product titles/descriptions
- Good for: Brand names, specific terms
- Example: "Zara leather jacket"

Each source shows:
- **Count:** Number of results returned
- **Top 3 Products:** Preview with title, brand, category

### Stage 3: Intelligent Fusion
Combines results using Weighted Reciprocal Rank Fusion:

**Fusion Weights**
- Visual bars showing weight distribution
- TYPE_1 queries: Attribute-heavy (60%)
- TYPE_2 queries: Vector-heavy (60%)

**Consensus Statistics**
- **In All 3 Sources:** Products found by all methods (highest confidence)
- **In Any 2 Sources:** Products in 2 methods (medium confidence)
- **Only 1 Source:** Products in 1 method (lower confidence)

**Score Distribution**
- Min/Max/Average scores after fusion
- Higher scores = more relevant products

### Stage 4: Reranking
Final ranking adjustments:

**Rank Changes**
- Shows how products moved up/down after reranking
- ↑ Green arrow = moved up
- ↓ Red arrow = moved down
- → Gray arrow = no change

### Final Results
Top 10 products with detailed information:

**For Each Product:**
- **Title & Brand:** Product name and manufacturer
- **Relevance Score:** Final score after all stages
- **Match Badges:**
  - ✓ Green badges: Attributes that match
  - ✗ Red badges: Attributes that don't match
- **Score Breakdown:**
  - Fusion Score: Score from Stage 3
  - Attribute Score: How well attributes match (0.0-1.0)
  - Sources: Which retrieval methods found this product

## Example Queries to Try

### TYPE_1 (Attribute-Specific)
- "long black trench with belt"
- "midi dress"
- "oversized blazer"
- "blue jeans"
- "schwarzer Rollkragenpullover" (German)

### TYPE_2 (Style-Based)
- "cozy winter sweater"
- "elegant office dress"
- "boho summer dress"
- "statement coat for winter"

### Complex
- "elegant long black dress for evening"
- "gemütlicher oversized pullover für den winter"

## Color-Coded Indicators

- **Purple Gradient:** TYPE_1 query, attribute-focused
- **Magenta Gradient:** TYPE_2 query, style-focused
- **Green:** Match/Success
- **Red:** Mismatch/Missing
- **Gray:** Neutral/No change

## Reading Scores

### Relevance Score (Final)
- **0.5-1.0:** Excellent match
- **0.3-0.5:** Good match
- **0.1-0.3:** Moderate match
- **0.0-0.1:** Weak match

### Attribute Score
- **1.0:** All attributes match perfectly
- **0.7-0.9:** Most attributes match
- **0.3-0.7:** Some attributes match
- **0.0-0.3:** Few attributes match

### Fusion Score
- Depends on query complexity and consensus
- Higher = more sources agreed on this product

## Troubleshooting

### Debug server won't start
- Check if port 3001 is already in use
- Verify environment variables are set (see .env.example)
- Ensure dependencies are installed: `npm install`

### "No results" error
- Check that Supabase connection is working
- Verify OpenAI API key is set
- Check Gemini API key is set

### Search is slow
- First search is always slower (cold start)
- LLM query parsing takes ~800ms
- Consider adding Redis caching for production

## API Endpoint

You can also call the debug API directly:

```bash
curl -X POST http://localhost:3001/api/search/debug \
  -H "Content-Type: application/json" \
  -d '{"query": "long black trench with belt", "limit": 10}'
```

Response includes:
- `results`: Array of top products
- `debug`: Full pipeline details
- `summary`: High-level metrics

## Tips for Analysis

1. **Check Stage 2 counts first**
   - If all 3 sources return 0, query parsing failed
   - If only vector works, attribute/keyword filters too strict

2. **Look at consensus stats**
   - High "All 3" count = strong signal
   - High "Only 1" count = sources disagree

3. **Review attribute matches**
   - Green badges = search working correctly
   - Red badges = missing attributes in products OR wrong parsing

4. **Compare ranks before/after Stage 4**
   - Large movements = reranking is impactful
   - No movements = fusion already optimal

## Keyboard Shortcuts

- **Enter:** Submit search
- **Click Stage Header:** Expand/collapse stage

---

**Port:** 3001
**Default Query:** "long black trench with belt"
**Refresh Rate:** Real-time (on demand)
