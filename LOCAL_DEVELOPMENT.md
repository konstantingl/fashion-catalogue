# Local Development Guide

## Quick Start

### 1. Install Search Engine Dependencies

```bash
cd search_engine_v2
npm install
cd ..
```

### 2. Launch Everything

**Option A: Using the launch script (easiest)**
```bash
./launch-local.sh
```

This will:
- Install dependencies if needed
- Start the search API on port 3000
- Open the app in your browser

**Option B: Manual launch**
```bash
# Terminal 1: Start Search API
cd search_engine_v2
npm run dev

# Terminal 2: Open the app
open index.html
# Or manually open index.html in your browser
```

### 3. Stop the Server

```bash
./stop-local.sh
```

Or manually: `kill [PID]` (PID shown when launching)

---

## Architecture

```
┌─────────────────────┐
│   Browser           │
│   (index.html)      │
│   Port: file://     │
└──────────┬──────────┘
           │ HTTP POST /api/search
           ↓
┌─────────────────────┐
│ Search Engine API   │
│ (Express Server)    │
│ Port: 3000          │
└──────────┬──────────┘
           │
           ├─→ Supabase (PostgreSQL + pgvector)
           ├─→ OpenAI (Embeddings)
           └─→ Gemini (Query Parsing)
```

---

## Testing the Integration

### 1. Check API is Running

```bash
curl http://localhost:3000/health
```

Expected output:
```json
{"status":"ok","timestamp":"2025-01-22T..."}
```

### 2. Test Search API Directly

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "long black trench with belt", "limit": 5}'
```

Expected output:
```json
{
  "results": [...],
  "query_understanding": {
    "query_type": "TYPE_1",
    "language": "en",
    ...
  },
  "search_time_ms": 847
}
```

### 3. Test in Browser

1. Open http://localhost:3000 in browser (should show CORS error - that's ok)
2. Open `index.html` (file://) in browser
3. Use the search bar to search for:
   - "long black trench with belt"
   - "cozy winter sweater"
   - "midi dress"
4. Check browser console (F12) for logs

---

## Troubleshooting

### "CORS error"

**Symptom**: Console shows "CORS policy blocked"

**Solution**: Make sure you're opening `index.html` as a file (file://) not through a web server, OR the search API is running on localhost:3000

### "Failed to fetch"

**Symptom**: Search doesn't return results, console shows "Failed to fetch"

**Cause**: Search API not running

**Solution**:
```bash
# Check if API is running
curl http://localhost:3000/health

# If not, start it
cd search_engine_v2
npm run dev
```

### "Invalid API key"

**Symptom**: Console shows "Invalid API key" or "Authentication error"

**Solution**: Check `.env` file has correct keys:
```bash
cd search_engine_v2
cat .env | grep -E "(SUPABASE|OPENAI|GEMINI)_"
```

### "No results returned"

**Possible causes**:
1. **No embeddings generated yet**
   ```bash
   cd search_engine_v2
   npm run generate-embeddings
   ```

2. **Database empty**
   ```bash
   cd search_engine_v2
   npm run migrate
   ```

3. **Supabase connection issue**
   - Check Supabase URL is correct
   - Check service_role key is correct (not anon key)

### "Port 3000 already in use"

**Solution**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill $(lsof -ti:3000)

# Or change port in search_engine_v2/server.js
PORT=3001 npm run dev
```

---

## Development Workflow

### Making Changes to Search Logic

1. Edit files in `search_engine_v2/pipeline/`
2. Save changes
3. Restart API: `./stop-local.sh && ./launch-local.sh`
4. Test in browser

### Making Changes to Frontend

1. Edit `script.js`, `index.html`, or `styles.css`
2. Save changes
3. Refresh browser (Cmd+R / Ctrl+R)
4. No need to restart API

### Viewing API Logs

```bash
# Live logs
tail -f search-api.log

# Or run API in foreground to see logs
cd search_engine_v2
npm run dev
```

---

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Frontend | file:// | file:///path/to/index.html |
| Search API | 3000 | http://localhost:3000 |
| Supabase | N/A | https://your-project.supabase.co |

To change API port, edit `search_engine_v2/server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Change 3000 to 3001
```

And update `script.js` line 714:
```javascript
? 'http://localhost:3001/api/search'  // Change port here too
```

---

## Performance Tips

### Faster Searches
- Enable query caching (already enabled in `.env`)
- Reduce `VECTOR_TOP_K` in `.env` (default: 200)
- Reduce `FUSION_TOP_K` in `.env` (default: 500)

### Reduce API Costs
- Cache common queries (enabled by default)
- Limit search frequency
- Use smaller embedding dimensions (already using 1536)

---

## What to Check If Search Isn't Working

✅ **Checklist:**
1. [ ] Dependencies installed (`cd search_engine_v2 && npm install`)
2. [ ] `.env` file configured with all API keys
3. [ ] Supabase schema created (run `data/schema.sql`)
4. [ ] Products migrated to Supabase (`npm run migrate`)
5. [ ] Embeddings generated (`npm run generate-embeddings`)
6. [ ] Search API running (`curl http://localhost:3000/health`)
7. [ ] Frontend opened in browser (index.html)
8. [ ] Browser console shows no CORS errors

---

## Next Steps

Once everything works locally:
1. Test all query types (TYPE_1 and TYPE_2)
2. Monitor search latency (should be < 2 seconds)
3. Check search quality with test suite (`npm test`)
4. Deploy to production (see SETUP_GUIDE.md)

Happy searching! 🔍✨
