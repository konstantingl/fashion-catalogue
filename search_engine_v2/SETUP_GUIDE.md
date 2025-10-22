# Search Engine V2 - Complete Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account ([supabase.com](https://supabase.com))
- OpenAI API key ([platform.openai.com](https://platform.openai.com))
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd search_engine_v2
npm install
```

Expected output:
```
added 45 packages, and audited 46 packages in 3s
```

### 2. Set Up Supabase Database

#### 2.1 Create Supabase Project
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in:
   - Name: fashion-search-v2
   - Database Password: (save this!)
   - Region: (choose closest to you)

#### 2.2 Enable pgvector Extension
1. In Supabase dashboard, go to "SQL Editor"
2. Click "+ New Query"
3. Run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2.3 Run Database Schema
1. Copy entire contents of `data/schema.sql`
2. Paste into Supabase SQL Editor
3. Click "Run"

Expected output:
```
Success. No rows returned
```

This creates:
- `products` table with vector columns
- Indexes (HNSW for vectors, GIN for JSONB)
- RPC functions for vector search
- Full-text search triggers

#### 2.4 Get Supabase Credentials
1. In Supabase dashboard, go to "Settings" → "API"
2. Copy:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`) - Click "Reveal" to see it

### 3. Get API Keys

#### 3.1 OpenAI API Key
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "+ Create new secret key"
3. Name: "Fashion Search Engine"
4. Copy the key (starts with `sk-...`)

**Important**: Add credits to your account ($5 minimum)

#### 3.2 Google Gemini API Key
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Select project or create new
4. Copy the key (starts with `AIza...`)

**Note**: Gemini has a generous free tier (1500 requests/day)

### 4. Configure Environment

Edit `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# OpenAI Configuration
OPENAI_API_KEY=sk-...your-openai-key...

# Google Gemini Configuration
GEMINI_API_KEY=AIza...your-gemini-key...

# Search Configuration (leave defaults)
SEARCH_LATENCY_TARGET_MS=2000
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=1536
GEMINI_MODEL=gemini-2.5-flash-lite

# Retrieval Settings (leave defaults)
VECTOR_TOP_K=200
ATTRIBUTE_TOP_K=300
KEYWORD_TOP_K=200
FUSION_TOP_K=500
FINAL_RESULTS_LIMIT=50

# Cache Settings (leave defaults)
ENABLE_QUERY_CACHE=true
CACHE_TTL_SECONDS=3600
```

### 5. Migrate Products to Supabase

```bash
npm run migrate
```

Expected output:
```
=== Supabase Migration Script ===

Loading products from: /path/to/products.json
Loaded 10234 products from JSON

Transforming products for Supabase schema...

Ready to migrate 10234 products to Supabase

Starting batch insertion...
Batch 1 success: 100 products
Batch 2 success: 100 products
...
Batch 103 success: 34 products

=== Migration Results ===
✅ Successfully inserted/updated: 10234 products
❌ Failed: 0 products

📊 Final product count in Supabase: 10234

✨ Migration complete!
```

**Troubleshooting**:
- If you get "Invalid API key": Check SUPABASE_SERVICE_ROLE_KEY in .env
- If you get "relation products does not exist": Run schema.sql first
- If batches fail: Check Supabase logs in dashboard

### 6. Generate Embeddings

**⚠️ Important**: This step costs money (~$1-2 for 10k products)

```bash
# Test with first 10 products
npm run generate-embeddings -- --limit 10
```

Expected output:
```
=== Embedding Generation Script ===

Validating configuration...
Fetching products needing embeddings...
Found 10 products needing embeddings

Estimated cost: ~$0.00
Estimated time: ~1 minutes

Processing in 1 batches of 10...

Processing batch 1/1 (10 products)...
  Progress: 10/10
  ✅ Batch 1 complete: 10 success, 0 failed

=== Final Results ===
✅ Successfully generated embeddings: 10 products
❌ Failed: 0 products

✨ Embedding generation complete!
```

**If test successful, run for all products**:
```bash
npm run generate-embeddings
```

This will take ~15-20 minutes for 10k products.

**Troubleshooting**:
- If you get rate limit errors: Reduce batch size with `--batch-size 50`
- If you get OpenAI errors: Check OPENAI_API_KEY and account credits
- If embedding fails: Check product has llm_description field

### 7. Verify Setup

Check in Supabase:

```sql
-- Check product count
SELECT COUNT(*) FROM products;
-- Should return: 10234

-- Check embeddings generated
SELECT
  COUNT(*) as total,
  COUNT(factual_embedding) as with_factual,
  COUNT(style_embedding) as with_style
FROM products;
-- Should return: all columns = 10234

-- Check vector dimensions
SELECT
  array_length(factual_embedding, 1) as factual_dims,
  array_length(style_embedding, 1) as style_dims
FROM products
WHERE factual_embedding IS NOT NULL
LIMIT 1;
-- Should return: both = 1536
```

### 8. Test Search API

Create test file `test_search.js`:

```javascript
import { search } from './api/search.js';

async function test() {
  console.log('Testing search...\n');

  const result = await search('long black trench with belt', { limit: 10 });

  console.log('Results:', result.results.length);
  console.log('Query type:', result.query_understanding.query_type);
  console.log('Search time:', result.search_time_ms, 'ms');

  console.log('\nTop 3 results:');
  result.results.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title} (${r.brand})`);
    console.log(`   Score: ${r.relevance_score.toFixed(4)}`);
  });
}

test();
```

Run:
```bash
node test_search.js
```

Expected output:
```
Testing search...

[Stage 1] Parsing query: "long black trench with belt"
[Stage 1] Query parsed successfully...
[Stage 2] Starting hybrid retrieval...
[Stage 2A] Vector search returned 200 results
[Stage 2B] Attribute filter returned 45 results
[Stage 2C] Keyword search returned 120 results
[Stage 3] Starting intelligent fusion...
[Stage 3] Fusion complete in 67ms
[Stage 4] Starting reranking...
[Stage 4] Reranking complete in 42ms

Results: 10
Query type: TYPE_1
Search time: 847 ms

Top 3 results:
1. LANGER TRENCH MIT GÜRTEL (MANGO)
   Score: 0.9542
2. Trenchcoat mit Bindegürtel (ZARA)
   Score: 0.9201
3. Long Belted Trench Coat (H&M)
   Score: 0.8956
```

### 9. Run Full Test Suite

```bash
npm test
```

This will run all 16 test queries and verify:
- Query type detection
- Language detection
- Attribute matching
- Latency targets
- Result relevance

### 10. Deploy to Vercel (Production)

#### 10.1 Prepare for Deployment

Add to `.gitignore`:
```
node_modules
.env
```

Create `vercel.json` in project root:
```json
{
  "functions": {
    "search_engine_v2/api/search.js": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "env": {
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
    "OPENAI_API_KEY": "@openai-api-key",
    "GEMINI_API_KEY": "@gemini-api-key"
  }
}
```

#### 10.2 Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

#### 10.3 Set Environment Variables

In Vercel dashboard:
1. Go to Project → Settings → Environment Variables
2. Add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`

3. Redeploy:
```bash
vercel --prod
```

### 11. Update Frontend

The frontend (`script.js`) is already updated to call `/api/search`.

Test in browser:
1. Open your app
2. Use the search bar
3. Try queries like:
   - "long black trench with belt"
   - "cozy winter sweater"
   - "midi dress"
4. Check browser console for logs

## Success Criteria Checklist

- [ ] Database has 10k+ products
- [ ] All products have factual_embedding and style_embedding
- [ ] Test search returns results in < 2 seconds
- [ ] TYPE_1 queries match attributes correctly
- [ ] TYPE_2 queries match style/vibe
- [ ] Search works in both English and German
- [ ] Frontend successfully calls API
- [ ] Vercel deployment successful

## Common Issues

### "No results returned"
- Check embeddings were generated
- Check Supabase RPC functions exist
- Check API keys are valid

### "Vector search failed"
- Verify pgvector extension is enabled
- Check vector indexes exist
- Verify embedding dimensions (3072)

### "High latency (> 2s)"
- Check Supabase region (should be close)
- Reduce `vectorTopK` in config
- Enable query caching

### "Cost too high"
- Use caching to reduce Gemini calls
- Batch embed during off-peak hours
- Consider reducing `vectorTopK`

## Next Steps

1. Monitor search analytics
2. Collect user feedback
3. Tune fusion weights based on data
4. Consider adding Typesense/Pinecone/Cohere for optimization
5. Implement A/B testing

## Support

For issues, check:
- Supabase logs: Dashboard → Logs
- Vercel logs: Dashboard → Deployments → [deployment] → Logs
- Browser console for frontend errors

## Cost Breakdown (Monthly for 10k searches)

- Supabase: Free tier (up to 500MB DB)
- OpenAI embeddings (queries only): ~$0.20
- Gemini 2.5 Flash Lite: Free (up to 1500/day) - Even faster & cheaper!
- Vercel: Free tier (up to 100k invocations)

**Total**: ~$0.20/month for 10k searches ✅
