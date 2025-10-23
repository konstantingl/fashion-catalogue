# Analytics Troubleshooting Guide

## Issue: Events Not Appearing in Tables

### Step 1: Check Browser Console

Open your browser console (F12) and look for:

1. **Initialization Messages**:
   ```
   [Analytics] Starting initialization...
   [Analytics] Fingerprint generated: fp_xxxxx
   [Analytics] User initialized: user_xxxxx
   [Analytics] Session started: user_xxxxx_xxxxx
   [Analytics] Initialized successfully!
   ```

2. **Request Messages** (when DEBUG_MODE is true):
   ```
   [Analytics] Request: POST analytics_users {...}
   [Analytics] Request successful: POST analytics_users
   [Analytics] Request: POST analytics_sessions {...}
   [Analytics] Request successful: POST analytics_sessions
   ```

3. **Error Messages**:
   ```
   [Analytics] Request failed: {...}
   ```

### Step 2: Check Tables Exist in Supabase

Run this SQL in Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'analytics_%';
```

**Expected**: Should return 4 tables:
- analytics_users
- analytics_sessions
- analytics_searches
- analytics_filters

**If tables don't exist**: Apply `analytics_schema.sql` in Supabase SQL Editor

### Step 3: Check RLS (Row Level Security)

Tables might have RLS enabled, blocking inserts. Run this:

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'analytics_%';
```

**If rowsecurity is TRUE**, you need to either:

**Option A: Disable RLS** (simplest for analytics):
```sql
ALTER TABLE analytics_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_searches DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_filters DISABLE ROW LEVEL SECURITY;
```

**Option B: Add RLS Policies** (more secure):
```sql
-- Allow anonymous inserts
CREATE POLICY "Allow anonymous inserts" ON analytics_users
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts" ON analytics_sessions
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts" ON analytics_searches
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous inserts" ON analytics_filters
    FOR INSERT TO anon
    WITH CHECK (true);
```

### Step 4: Check API Key Permissions

Verify your Supabase anon key has permissions:

1. Go to Supabase Dashboard → Settings → API
2. Copy the **anon/public** key
3. Make sure it matches what's in your `config.js`:
   ```javascript
   SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   ```

### Step 5: Test Manual Insert

Try inserting directly from browser console:

```javascript
// Test user insert
await fetch('https://ytrfzgxzdbkscwxfiwnv.supabase.co/rest/v1/analytics_users', {
    method: 'POST',
    headers: {
        'apikey': window.CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${window.CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
        user_id: 'test_user_123',
        is_registered: false,
        device_fingerprint: 'fp_test',
        user_agent: navigator.userAgent,
        screen_resolution: '1920x1080',
        timezone: 'UTC'
    })
}).then(r => r.ok ? console.log('✅ Success') : r.text().then(t => console.error('❌ Failed:', t)));
```

### Step 6: Check Network Tab

1. Open browser DevTools → Network tab
2. Filter by "analytics"
3. Look for POST requests to `/rest/v1/analytics_*`
4. Click on a request and check:
   - **Status**: Should be 201 (Created) or 200 (OK)
   - **Response**: Check for error messages
   - **Headers**: Verify Authorization header is present

### Common Issues & Fixes

#### Issue: 401 Unauthorized
**Cause**: Invalid or missing API key
**Fix**: Verify `SUPABASE_ANON_KEY` in `config.js` matches Supabase dashboard

#### Issue: 404 Not Found
**Cause**: Tables don't exist or wrong URL
**Fix**:
- Verify `SUPABASE_URL` in `config.js` is correct
- Apply `analytics_schema.sql` to create tables

#### Issue: 403 Forbidden / RLS Policy
**Cause**: Row Level Security blocking inserts
**Fix**: Disable RLS or add policies (see Step 3)

#### Issue: 409 Conflict / Unique Violation
**Cause**: Trying to insert duplicate user_id or session_id
**Fix**: This is expected behavior, should not prevent other inserts

#### Issue: 500 Internal Server Error
**Cause**: Database constraint violation or trigger error
**Fix**: Check Supabase logs for details:
- Go to Supabase Dashboard → Database → Logs
- Look for error messages

### Step 7: Use Test Page

Open `test-analytics.html` in your browser:

```
http://localhost/test-analytics.html
```

Or if using live server, navigate to the file.

1. Click "Test Search Tracking"
2. Click "Test Filter Tracking"
3. Click "Check Event Queue" - should show 2 events
4. Click "Flush Events Now"
5. Check browser console for errors
6. Check Supabase tables for data

### Step 8: Verify Events Are Being Queued

In browser console:

```javascript
// Check analytics is loaded
window.analytics

// Check event queue
window.analytics.eventQueue

// Track a test search
window.analytics.trackSearch('test query', 10, 'ai_search');

// Check queue again
window.analytics.eventQueue  // Should have 1 event

// Manually flush
await window.analytics.flushQueue();
```

### Step 9: Check Supabase Tables

After flushing events, verify data in Supabase:

```sql
-- Check users
SELECT * FROM analytics_users ORDER BY created_at DESC LIMIT 5;

-- Check sessions
SELECT * FROM analytics_sessions ORDER BY started_at DESC LIMIT 5;

-- Check searches
SELECT * FROM analytics_searches ORDER BY created_at DESC LIMIT 5;

-- Check filters
SELECT * FROM analytics_filters ORDER BY created_at DESC LIMIT 5;
```

### Quick Diagnostic Checklist

- [ ] Tables exist in Supabase (`analytics_*`)
- [ ] RLS is disabled OR policies allow anon inserts
- [ ] API key in config.js matches Supabase dashboard
- [ ] `[Analytics] Initialized successfully!` in console
- [ ] No error messages in browser console
- [ ] Network tab shows POST requests to `/rest/v1/analytics_*`
- [ ] Status codes are 200 or 201
- [ ] Event queue is being populated
- [ ] Events flush after 5 items or 10 seconds

### Still Not Working?

1. **Check Supabase Status**: https://status.supabase.com
2. **Check Supabase Logs**: Dashboard → Database → Logs
3. **Try in Incognito**: Rule out browser extensions/cache
4. **Check CORS**: Should not be an issue with Supabase REST API
5. **Verify schema applied**: Re-run `analytics_schema.sql`

### Enable Full Debug Mode

In `config.js`, ensure:
```javascript
DEBUG_MODE: true
```

Then check console for detailed logs of every request.

### Get Help

If still not working, share:
1. Browser console output (with DEBUG_MODE: true)
2. Network tab screenshot showing failed requests
3. Supabase error logs (Dashboard → Database → Logs)
4. SQL query results showing table status and RLS
