# Fashion Aggregator Analytics Setup Guide

This guide will help you set up comprehensive user analytics tracking for your fashion aggregator application using Supabase.

## 📋 Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Your fashion aggregator application files

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be ready

### 2. Set Up Database Schema

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the contents of `supabase_schema.sql` into a new query
4. Click "Run" to create all the tables and indexes

### 3. Configure Analytics

1. Open `config.js` in your project
2. Replace the placeholder values with your Supabase credentials:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project-id.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',
    ANALYTICS_ENABLED: true,
    DEBUG_MODE: true // Set to false in production
};
```

**Where to find your credentials:**
- Go to your Supabase project dashboard
- Click "Settings" → "API"
- Copy the "Project URL" and "anon public key"

### 4. Test the Implementation

1. Open your fashion aggregator in a web browser
2. Open browser developer tools (F12)
3. Check the console for the message: "Analytics initialized successfully"
4. Perform some actions (search, filter, click products)
5. Go to your Supabase dashboard → "Table Editor" to verify data is being recorded

## 📊 What Gets Tracked

### User Sessions
- Session start/end times
- Device information (screen size, mobile/desktop)
- Session duration
- Total interactions per session

### Search Behavior
- Every search query
- Search results count
- Search duration
- Search clear events

### Filter Usage
- Brand filter selections
- Category filter selections
- Price range filters
- Dynamic attribute filters
- Filter combinations

### Product Interactions
- Product card clicks
- Image slider navigation
- Position in product list
- Product details (brand, category, price)

### Click Tracking
- Load more button clicks
- All button interactions
- Filter save/reset actions
- Navigation interactions

## 🔍 Viewing Analytics Data

### Quick Queries

**Session Overview:**
```sql
SELECT
    COUNT(*) as total_sessions,
    AVG(session_duration_seconds) as avg_session_duration,
    AVG(total_interactions) as avg_interactions_per_session
FROM user_sessions
WHERE start_time >= NOW() - INTERVAL '24 hours';
```

**Popular Search Terms:**
```sql
SELECT
    search_query,
    COUNT(*) as frequency,
    AVG(results_count) as avg_results
FROM search_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY search_query
ORDER BY frequency DESC
LIMIT 20;
```

**Most Clicked Products:**
```sql
SELECT
    product_brand,
    product_category,
    COUNT(*) as click_count
FROM product_interactions
WHERE interaction_type = 'click'
    AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY product_brand, product_category
ORDER BY click_count DESC
LIMIT 20;
```

**Filter Usage Analytics:**
```sql
SELECT
    filter_type,
    filter_action,
    COUNT(*) as usage_count
FROM filter_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY filter_type, filter_action
ORDER BY usage_count DESC;
```

## 🛠️ Troubleshooting

### Analytics Not Initializing
- Check browser console for error messages
- Verify Supabase URL and API key are correct
- Ensure `ANALYTICS_ENABLED` is set to `true`

### No Data in Database
- Check browser network tab for failed requests
- Verify your Supabase anon key has the right permissions
- Look for JavaScript errors in console

### Performance Issues
- Adjust `BATCH_SIZE` and `FLUSH_INTERVAL` in config.js
- Consider enabling Row Level Security for production

## 🔒 Privacy Considerations

- No personally identifiable information is collected
- All tracking is anonymous using session IDs
- User IP addresses are not stored
- Compliant with privacy-focused analytics

## 📈 Advanced Usage

### Custom Events
You can track custom events in your code:

```javascript
// Track a custom user action
if (window.analytics) {
    window.analytics.trackCustomEvent('newsletter_signup', {
        source: 'footer',
        campaign: 'holiday_2024'
    });
}
```

### Error Tracking
Automatic error tracking is built-in, but you can also manually track errors:

```javascript
try {
    // Your code here
} catch (error) {
    if (window.analytics) {
        window.analytics.trackError(error, 'product_loading');
    }
}
```

## 📞 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify all configuration values are correct
3. Test with a fresh Supabase project
4. Review the `supabase_schema.sql` file was executed successfully

## 🔧 File Structure

```
fashion_aggregator/
├── index.html              # Updated with analytics scripts
├── script.js               # Main app with analytics integration
├── analytics.js            # Analytics service module
├── config.js               # Configuration file
├── supabase_schema.sql     # Database schema
└── ANALYTICS_SETUP.md      # This setup guide
```

Your comprehensive user analytics system is now ready! 🎉