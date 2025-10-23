# Analytics Implementation Guide

**Date**: October 23, 2025
**Version**: 2.0 - Clean & Privacy-Friendly

---

## Overview

This is a simplified, privacy-friendly analytics system that tracks:
- ✅ Anonymous & registered users (simple device fingerprinting)
- ✅ Session start/end times (activity-based with 30min timeout)
- ✅ Search requests
- ✅ Filter usage (brand, category, price, attributes)

**Architecture**: Frontend → Direct Supabase writes → Database

---

## 🗄️ Step 1: Database Setup

### Apply Schema to Supabase

1. Open your Supabase project: https://ytrfzgxzdbkscwxfiwnv.supabase.co
2. Navigate to **SQL Editor**
3. Copy the contents of `analytics_schema.sql`
4. Execute the SQL to create:
   - 4 tables (`analytics_users`, `analytics_sessions`, `analytics_searches`, `analytics_filters`)
   - Triggers (session timeout, activity tracking)
   - Views (session summary, user engagement, popular searches, filter stats)
   - Functions (cleanup, session management)

### Verify Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'analytics_%';
```

Should return 4 tables:
- `analytics_users`
- `analytics_sessions`
- `analytics_searches`
- `analytics_filters`

---

## 📁 Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `analytics_schema.sql` | Database schema with tables, triggers, views | ~450 lines |
| `analytics-simple.js` | Frontend analytics client | ~370 lines |
| `config.js` | Analytics configuration added | Modified |
| `index.html` | Analytics script tag added | Modified |
| `script.js` | Tracking calls added | Modified |

---

## 🔧 Configuration

**In `config.js`**:

```javascript
ANALYTICS_ENABLED: true,
ANALYTICS_BATCH_SIZE: 5,           // Batch 5 events before sending
ANALYTICS_FLUSH_INTERVAL: 10000,    // Flush every 10 seconds
ANALYTICS_HEARTBEAT_INTERVAL: 30000 // Heartbeat every 30 seconds
```

To disable analytics, set `ANALYTICS_ENABLED: false`.

---

## 🎯 What Gets Tracked

### 1. Anonymous & Registered Users

**Anonymous Users**:
- Identified by simple device fingerprint: `${userAgent}-${screenWidth}x${screenHeight}-${timezone}`
- Stored in localStorage as `analytics_user_id`
- Format: `user_<timestamp>_<random>`

**Registered Users**:
- Identified by `auth.users.id` (from Supabase Auth)
- Linked to `analytics_users.auth_user_id`
- Marked as `is_registered: true`

**Privacy**:
- ✅ Simple fingerprinting only (user agent + screen + timezone)
- ❌ No canvas fingerprinting
- ❌ No font enumeration
- ❌ No hardware tracking
- ❌ No click coordinates

### 2. Sessions

**Session Lifecycle**:
1. **Start**: New session created on page load
2. **Activity**: Updated with every search/filter event
3. **Heartbeat**: Sent every 30 seconds to keep session alive
4. **End**: Marked as ended when:
   - User closes/leaves page
   - 30 minutes of inactivity (auto-ended by database trigger)

**Session Data**:
- `session_id` - Unique identifier
- `user_id` - Link to user
- `started_at`, `ended_at`, `last_activity_at`
- `duration_seconds` - Auto-calculated
- `page_url`, `referrer`

### 3. Search Requests

**Tracked on**:
- AI search completion (line 837 in `script.js`)

**Data Collected**:
- `search_query` - The search text
- `results_count` - Number of results returned
- `search_type` - 'ai_search' (can be extended)
- `session_id`, `user_id`
- `created_at` timestamp

### 4. Filter Usage

**Tracked on**:
- Brand filter applied (line 405)
- Category filter applied (line 426)
- Price filter applied (line 443)
- Attribute filter applied (line 606)

**Data Collected**:
- `filter_type` - 'brand', 'category', 'price', 'attribute'
- `filter_key` - Attribute name (for attribute filters only)
- `filter_values` - JSONB array/object of selected values
- `action` - 'apply', 'remove', 'clear'
- `session_id`, `user_id`
- `created_at` timestamp

---

## 🚀 How It Works

### Initialization Flow

```
Page Load
    ↓
analytics-simple.js loaded
    ↓
window.analytics = initializeSimpleAnalytics()
    ↓
Generate device fingerprint
    ↓
Check if user exists (localStorage)
    ↓
Create/Update user in analytics_users
    ↓
Start new session in analytics_sessions
    ↓
Start heartbeat (every 30s)
    ↓
Start auto-flush timer (every 10s)
    ↓
Listen for beforeunload event
```

### Event Tracking Flow

```
User performs action (search/filter)
    ↓
script.js calls window.analytics.trackSearch()
             or window.analytics.trackFilter()
    ↓
Event added to queue
    ↓
When queue reaches batch size (5) OR flush interval (10s)
    ↓
Events grouped by table
    ↓
Batch POST to Supabase REST API
    ↓
Database triggers update session activity
```

### Session End Flow

```
User closes tab/window
    ↓
beforeunload event fires
    ↓
Flush remaining events
    ↓
Update session: ended_at = NOW(), is_active = false
    ↓
Session duration calculated automatically
```

---

## 📊 Querying Analytics Data

### View Active Sessions

```sql
SELECT
    s.session_id,
    u.is_registered,
    s.started_at,
    s.last_activity_at,
    EXTRACT(EPOCH FROM (NOW() - s.last_activity_at))::INTEGER as seconds_since_activity
FROM analytics_sessions s
JOIN analytics_users u ON s.user_id = u.user_id
WHERE s.is_active = TRUE
ORDER BY s.last_activity_at DESC;
```

### Popular Searches (Last 30 Days)

```sql
SELECT * FROM analytics_popular_searches LIMIT 20;
```

### Filter Usage Statistics

```sql
SELECT * FROM analytics_filter_stats LIMIT 20;
```

### User Engagement Metrics

```sql
SELECT
    is_registered,
    COUNT(*) as total_users,
    AVG(total_sessions)::INTEGER as avg_sessions_per_user,
    AVG(total_searches)::INTEGER as avg_searches_per_user,
    AVG(avg_session_duration_seconds)::INTEGER as avg_session_duration
FROM analytics_user_engagement
GROUP BY is_registered;
```

### Session Summary

```sql
SELECT * FROM analytics_session_summary
ORDER BY started_at DESC
LIMIT 100;
```

---

## 🔒 Privacy & GDPR Compliance

### Privacy-Friendly Design

1. **Minimal Fingerprinting**: Only user agent + screen + timezone
2. **No Invasive Tracking**: No canvas, fonts, or hardware tracking
3. **No PII**: No personal information collected
4. **Anonymous by Default**: Users tracked anonymously unless authenticated
5. **Data Retention**: 90-day auto-cleanup

### GDPR Compliance Steps (Optional)

If you need GDPR compliance:

1. **Add Cookie Consent Banner**
   - Only initialize analytics after user consent
   - Store consent in localStorage

2. **Add Data Deletion**
   - Create endpoint to delete user's analytics data
   - Allow users to request data export

3. **Privacy Policy**
   - Document what data is collected
   - Explain how it's used
   - Provide opt-out mechanism

4. **Example Consent Implementation**:

```javascript
// Only initialize if user consented
if (localStorage.getItem('analytics_consent') === 'true') {
    window.analytics = initializeSimpleAnalytics(...);
}
```

---

## 🧹 Maintenance

### Scheduled Jobs

Set up these cron jobs on your database:

**Every 5 Minutes** - End inactive sessions:
```sql
SELECT end_inactive_sessions();
```

**Daily at 2 AM** - Clean up old data:
```sql
SELECT cleanup_old_analytics();
```

### Using pg_cron (Supabase)

```sql
-- Install pg_cron extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: End inactive sessions every 5 minutes
SELECT cron.schedule(
    'end-inactive-sessions',
    '*/5 * * * *',
    'SELECT end_inactive_sessions();'
);

-- Schedule: Cleanup old data daily at 2 AM
SELECT cron.schedule(
    'cleanup-old-analytics',
    '0 2 * * *',
    'SELECT cleanup_old_analytics();'
);
```

### Monitor Table Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'analytics_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🐛 Troubleshooting

### Analytics Not Working

1. **Check browser console**:
   ```javascript
   console.log(window.analytics); // Should be SimpleAnalytics instance
   ```

2. **Check database connection**:
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`
   - Check Supabase dashboard for API requests

3. **Check tables exist**:
   ```sql
   SELECT * FROM analytics_users LIMIT 1;
   ```

4. **Enable debug mode**:
   ```javascript
   CONFIG.DEBUG_MODE = true;
   ```
   Check console for `[Analytics]` messages

### Events Not Being Tracked

1. **Check analytics is initialized**:
   ```javascript
   if (window.analytics) {
       console.log('Analytics active');
   }
   ```

2. **Check event queue**:
   ```javascript
   console.log(window.analytics.eventQueue);
   ```

3. **Manually flush queue**:
   ```javascript
   window.analytics.flushQueue();
   ```

### Sessions Not Ending

1. **Check trigger is installed**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_session_on_search';
   ```

2. **Manually end inactive sessions**:
   ```sql
   SELECT end_inactive_sessions();
   ```

---

## 📈 Dashboard Ideas

Create analytics dashboards using the provided views:

### Key Metrics to Display

1. **Real-Time Stats**:
   - Active sessions right now
   - Searches in last hour
   - Most used filters today

2. **User Engagement**:
   - Daily/weekly/monthly active users
   - Average session duration
   - Searches per session

3. **Search Analytics**:
   - Most popular searches
   - Search volume trends
   - Searches with zero results

4. **Filter Analytics**:
   - Most used brands/categories
   - Filter combination patterns
   - Price range preferences

### Example Dashboard Query

```sql
-- Today's snapshot
SELECT
    (SELECT COUNT(DISTINCT user_id) FROM analytics_sessions WHERE started_at > CURRENT_DATE) as users_today,
    (SELECT COUNT(*) FROM analytics_searches WHERE created_at > CURRENT_DATE) as searches_today,
    (SELECT COUNT(*) FROM analytics_filters WHERE created_at > CURRENT_DATE) as filters_today,
    (SELECT COUNT(*) FROM analytics_sessions WHERE is_active = TRUE) as active_sessions_now;
```

---

## ✅ Testing Checklist

After implementation, verify:

- [ ] Tables created successfully in Supabase
- [ ] Analytics client initializes on page load
- [ ] User created in `analytics_users` table
- [ ] Session created in `analytics_sessions` table
- [ ] Search tracking works (check `analytics_searches`)
- [ ] Filter tracking works (check `analytics_filters`)
- [ ] Heartbeat updates `last_activity_at`
- [ ] Session ends on page close
- [ ] Inactive sessions auto-end after 30min
- [ ] Views return data correctly
- [ ] No console errors
- [ ] Works for anonymous users
- [ ] Works for authenticated users

---

## 🔄 Migration from Old System

If you had the old analytics system:

1. **Drop old tables** (use `analytics_archive/DATABASE_CLEANUP_GUIDE.md`)
2. **Apply new schema** (`analytics_schema.sql`)
3. **Old data is archived** in `analytics_archive/` folder
4. **Start fresh** - new analytics begins from deployment date

---

## 📞 Support & Resources

- **Database Schema**: `analytics_schema.sql`
- **Cleanup Guide**: `analytics_archive/DATABASE_CLEANUP_GUIDE.md`
- **Cleanup Summary**: `analytics_archive/CLEANUP_SUMMARY.md`
- **Supabase Docs**: https://supabase.com/docs
- **pg_cron Extension**: https://github.com/citusdata/pg_cron

---

## 🎉 Summary

Your analytics system is now:
- ✅ Privacy-friendly (simple fingerprinting only)
- ✅ Activity-based sessions (30min timeout)
- ✅ Tracking searches & filters
- ✅ Anonymous & registered user support
- ✅ Auto-cleanup (90-day retention)
- ✅ Easy to query (views provided)
- ✅ Lightweight (~370 lines of JS)
- ✅ Direct to database (no backend needed)

**Next Steps**:
1. Apply SQL schema to Supabase
2. Test in browser (check console for `[Analytics]` messages)
3. Verify data in Supabase dashboard
4. Set up cron jobs for maintenance
5. Build analytics dashboard (optional)
