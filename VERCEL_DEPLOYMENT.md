# Vercel Deployment Guide - BrandNest Fashion Aggregator

This guide explains how to deploy the BrandNest Fashion Aggregator as two separate Vercel projects from a single monorepo.

## Architecture Overview

```
fashion_aggregator/
├── search_engine_v2/          → Vercel Project 1: API Service
│   ├── api/
│   ├── package.json
│   └── vercel.json
├── index.html                 → Vercel Project 2: Frontend App
├── script.js
├── styles.css
└── vercel.json
```

**Two Vercel Projects:**
1. **Search API Service** - Node.js backend with AI-powered search
2. **Frontend App** - Static site with Supabase integration

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub repository with all code pushed
- ✅ Vercel account (free tier works)
- ✅ Supabase project with products table and embeddings
- ✅ OpenAI API key (for embeddings)
- ✅ Google Gemini API key (for query parsing)

---

## Part 1: Deploy Search API Service (search_engine_v2)

### Step 1: Create Vercel Project for API

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"Add New Project"**
3. Import your GitHub repository: `konstantingl/fashion-catalogue`
4. Configure project:
   - **Project Name:** `brandnest-search-api` (or your choice)
   - **Framework Preset:** Other
   - **Root Directory:** `search_engine_v2` ← **Important!**
   - **Build Command:** (leave empty or `npm install`)
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

### Step 2: Configure Environment Variables

In Vercel project settings, add these environment variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...

# Gemini Configuration
GEMINI_API_KEY=AIzaSy...

# Node Environment
NODE_ENV=production
```

**Where to find these:**
- **Supabase URL & Key:** Supabase Dashboard → Project Settings → API
  - Use the `service_role` key (not `anon` key)
- **OpenAI API Key:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Gemini API Key:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (~2-3 minutes)
3. You'll get a URL like: `https://brandnest-search-api.vercel.app`

### Step 4: Test API Deployment

Test your deployed API:

```bash
curl -X POST https://brandnest-search-api.vercel.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "black midi dress", "limit": 10}'
```

Expected response:
```json
{
  "results": [...],
  "query_type": "TYPE_1",
  "total_results": 10
}
```

**Debug endpoint:**
```bash
curl -X POST https://brandnest-search-api.vercel.app/api/search/debug \
  -H "Content-Type: application/json" \
  -d '{"query": "long black trench with belt", "limit": 10}'
```

---

## Part 2: Deploy Frontend App (Main App)

### Step 1: Update Frontend to Use Production API

Before deploying the frontend, you need to update `script.js` to use the deployed API URL.

**Option A: Environment-based configuration (Recommended)**

Add this at the top of `script.js`:

```javascript
// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'  // Local development
    : 'https://brandnest-search-api.vercel.app';  // Production

// Then in performSemanticSearch():
const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: searchQuery, limit: 100 })
});
```

**Option B: Vercel Environment Variables**

You can also use Vercel's environment variable replacement in build time (requires a build step).

### Step 2: Create Vercel Project for Frontend

1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**
2. Import the **same** GitHub repository: `konstantingl/fashion-catalogue`
3. Configure project:
   - **Project Name:** `brandnest` (or your choice)
   - **Framework Preset:** Other (or "Static Site")
   - **Root Directory:** `.` (root) ← **Important!**
   - **Build Command:** (leave empty - it's static HTML)
   - **Output Directory:** (leave empty)
   - **Install Command:** (leave empty)

### Step 3: Configure Environment Variables

In Vercel project settings, add:

```bash
# Supabase Configuration (for frontend auth/favorites)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Search API URL (if using Option B above)
VITE_API_URL=https://brandnest-search-api.vercel.app
```

**Note:** Use `VITE_` prefix for environment variables that should be exposed to the browser.

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (~1-2 minutes)
3. You'll get a URL like: `https://brandnest.vercel.app`

### Step 5: Configure CORS (if needed)

If you get CORS errors, add CORS headers to your API.

In `search_engine_v2/vercel.json`, add:

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "https://brandnest.vercel.app" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" }
      ]
    }
  ]
}
```

Or allow all origins during development:
```json
{ "key": "Access-Control-Allow-Origin", "value": "*" }
```

---

## Part 3: Verify Everything Works

### Test Checklist:

1. **Search Functionality**
   - Visit `https://brandnest.vercel.app`
   - Try search query: "long black trench with belt"
   - Verify results appear with split UI (primary/secondary)

2. **Favorites System**
   - Click heart icon on a product
   - Verify it saves (Supabase integration)

3. **Filters**
   - Test category filters
   - Test brand filters
   - Test search + filters combination

4. **Responsive Design**
   - Test on mobile device
   - Test on tablet
   - Test on desktop

5. **Debug UI (Optional)**
   - Visit `https://brandnest-search-api.vercel.app`
   - You should see a simple page or 404 (API has no root route)
   - The debug UI at `/debug-ui` won't work on Vercel (it's for local development only)

---

## Environment Variables Summary

### Search API Service (search_engine_v2)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Service role key (full access) | Supabase Dashboard → Settings → API → `service_role` |
| `OPENAI_API_KEY` | OpenAI API key for embeddings | platform.openai.com/api-keys |
| `GEMINI_API_KEY` | Google Gemini API key for LLM | aistudio.google.com/app/apikey |
| `NODE_ENV` | Set to `production` | Manual |

### Frontend App (root)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `VITE_SUPABASE_URL` | Supabase project URL | Same as above |
| `VITE_SUPABASE_ANON_KEY` | Anonymous key (public safe) | Supabase Dashboard → Settings → API → `anon` |
| `VITE_API_URL` | Search API URL | Your deployed API URL |

---

## Updating After Changes

### Updating Search API:

1. Push changes to GitHub:
   ```bash
   git add search_engine_v2/
   git commit -m "Update search API"
   git push origin main
   ```

2. Vercel will **auto-deploy** on push (if you enabled GitHub integration)

3. Or manually redeploy from Vercel dashboard → Deployments → Redeploy

### Updating Frontend:

1. Push changes to GitHub:
   ```bash
   git add script.js styles.css index.html
   git commit -m "Update frontend"
   git push origin main
   ```

2. Vercel will **auto-deploy** on push

---

## Custom Domains (Optional)

### Add Custom Domain to API:

1. Go to Vercel → `brandnest-search-api` project → Settings → Domains
2. Add domain: `api.brandnest.com`
3. Update DNS records as instructed
4. Update frontend `API_BASE_URL` to use custom domain

### Add Custom Domain to Frontend:

1. Go to Vercel → `brandnest` project → Settings → Domains
2. Add domain: `brandnest.com`
3. Update DNS records as instructed
4. Update CORS settings in API to allow custom domain

---

## Troubleshooting

### Issue: "Module not found" error in API

**Solution:** Ensure `search_engine_v2/package.json` has all dependencies:
```bash
cd search_engine_v2
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Issue: Search returns 500 error

**Solution:** Check Vercel logs:
1. Go to Vercel → Project → Deployments → Latest → View Function Logs
2. Look for error messages
3. Common issues:
   - Missing environment variables
   - Invalid Supabase credentials
   - OpenAI/Gemini API key issues

### Issue: CORS error in browser console

**Solution:** Add CORS headers to `search_engine_v2/vercel.json` (see Part 2, Step 5)

### Issue: Favorites not saving

**Solution:**
- Check `VITE_SUPABASE_ANON_KEY` is set correctly
- Verify Supabase RLS policies allow anonymous inserts
- Check browser console for Supabase errors

### Issue: Search is slow (>10s timeout)

**Solution:**
- Vercel serverless functions have timeout limits:
  - Hobby: 10 seconds
  - Pro: 60 seconds
- Your search takes ~2s, so should be fine
- If you hit limits, consider:
  - Caching results in Redis
  - Pre-computing embeddings
  - Upgrading Vercel plan

### Issue: Environment variables not updating

**Solution:**
1. Update in Vercel Dashboard → Settings → Environment Variables
2. Redeploy (changing env vars doesn't auto-redeploy)
3. Go to Deployments → Click "..." → Redeploy

---

## Performance Optimization

### Enable Edge Caching:

Add to `search_engine_v2/vercel.json`:

```json
{
  "headers": [
    {
      "source": "/api/search",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate" }
      ]
    }
  ]
}
```

This caches search results for 60 seconds at the edge.

### Enable Compression:

Vercel automatically compresses responses, but you can verify:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Encoding", "value": "gzip" }
      ]
    }
  ]
}
```

---

## Monitoring

### View Logs:

**Search API:**
1. Vercel Dashboard → `brandnest-search-api` → Deployments
2. Click latest deployment → Runtime Logs
3. Filter by log level (Info, Error, etc.)

**Frontend:**
1. Vercel Dashboard → `brandnest` → Deployments
2. Check for build errors or static file issues

### Analytics:

Vercel provides built-in analytics:
- Go to Project → Analytics
- View page views, visitors, top pages
- View API function invocations and latency

---

## Security Checklist

- ✅ Use `SUPABASE_SERVICE_KEY` only in backend (search_engine_v2)
- ✅ Use `VITE_SUPABASE_ANON_KEY` only in frontend (safe to expose)
- ✅ Never commit `.env` files to Git
- ✅ Rotate API keys regularly
- ✅ Enable Supabase RLS policies for user data
- ✅ Set up rate limiting (Vercel Pro feature)
- ✅ Configure CORS to allow only your domain

---

## Cost Estimate

### Vercel Pricing:

**Hobby Plan (Free):**
- 100 GB bandwidth/month
- Unlimited serverless function invocations
- 100 GB-hours of function execution time
- **Should be sufficient for development and low-traffic production**

**Pro Plan ($20/month):**
- 1 TB bandwidth/month
- Unlimited everything else
- Better analytics
- Required for: custom domains on multiple projects, password protection, team features

### Third-Party Services:

- **Supabase:** Free tier → 500 MB database, 2 GB bandwidth
- **OpenAI:** ~$0.13 per 1M tokens (embeddings)
- **Google Gemini:** Free tier → 15 requests/minute

**Expected monthly cost for 1,000 searches:**
- Vercel: $0 (free tier)
- Supabase: $0 (free tier)
- OpenAI: ~$0.50 (for embeddings)
- Gemini: $0 (free tier)

**Total: ~$0.50/month for 1,000 searches**

---

## Next Steps

1. ✅ Deploy Search API (Part 1)
2. ✅ Test API endpoints
3. ✅ Update frontend with production API URL
4. ✅ Deploy Frontend (Part 2)
5. ✅ Test full application
6. ✅ Set up custom domains (optional)
7. ✅ Monitor logs and performance

---

## Support Resources

- **Vercel Documentation:** [vercel.com/docs](https://vercel.com/docs)
- **Supabase Documentation:** [supabase.com/docs](https://supabase.com/docs)
- **OpenAI API Docs:** [platform.openai.com/docs](https://platform.openai.com/docs)
- **Gemini API Docs:** [ai.google.dev/docs](https://ai.google.dev/docs)

---

**Deployment Guide Version:** 1.0
**Last Updated:** October 22, 2025
**Author:** Claude Code
**Project:** BrandNest Fashion Aggregator
