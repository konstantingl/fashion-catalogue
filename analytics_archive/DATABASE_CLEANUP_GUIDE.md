# Analytics Database Cleanup Guide

## Overview
This guide documents the analytics tables that need to be dropped from the Supabase database and provides the SQL commands to do so.

**Database**: `https://ytrfzgxzdbkscwxfiwnv.supabase.co`

## Tables to Drop

The following analytics tables were part of the old frontend-based analytics system and should be dropped:

### Core Analytics Tables
1. **user_sessions** - Session metadata tracking
2. **user_interactions** - General UI event tracking
3. **search_events** - Search query tracking
4. **filter_events** - Filter application tracking
5. **product_interactions** - Product engagement tracking

### Anonymous User Tracking Tables
6. **anonymous_users** - User identification and device fingerprinting
7. **user_journeys** - Session journey tracking
8. **user_behavior_patterns** - Behavioral analysis
9. **user_shopping_preferences** - User preference tracking

### Related Database Objects
- **Views**: `user_session_summary`, `user_engagement_metrics`
- **Triggers**: `trigger_update_session_stats`, `trigger_update_anonymous_user_stats`, `trigger_update_user_journey`, `trigger_analyze_user_behavior`
- **Functions**: Associated trigger functions

## SQL Cleanup Commands

Execute the following SQL commands in your Supabase SQL Editor to clean up the old analytics system:

```sql
-- Drop views first
DROP VIEW IF EXISTS user_engagement_metrics CASCADE;
DROP VIEW IF EXISTS user_session_summary CASCADE;

-- Drop triggers (they will be automatically dropped with tables, but explicit cleanup is cleaner)
DROP TRIGGER IF EXISTS trigger_update_session_stats ON user_interactions;
DROP TRIGGER IF EXISTS trigger_update_anonymous_user_stats ON user_interactions;
DROP TRIGGER IF EXISTS trigger_update_user_journey ON user_sessions;
DROP TRIGGER IF EXISTS trigger_analyze_user_behavior ON user_interactions;

-- Drop tables (CASCADE will handle foreign key constraints)
DROP TABLE IF EXISTS user_behavior_patterns CASCADE;
DROP TABLE IF EXISTS user_shopping_preferences CASCADE;
DROP TABLE IF EXISTS user_journeys CASCADE;
DROP TABLE IF EXISTS product_interactions CASCADE;
DROP TABLE IF EXISTS filter_events CASCADE;
DROP TABLE IF EXISTS search_events CASCADE;
DROP TABLE IF EXISTS user_interactions CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS anonymous_users CASCADE;

-- Drop trigger functions if they exist
DROP FUNCTION IF EXISTS update_session_stats() CASCADE;
DROP FUNCTION IF EXISTS update_anonymous_user_stats() CASCADE;
DROP FUNCTION IF EXISTS update_user_journey() CASCADE;
DROP FUNCTION IF EXISTS analyze_user_behavior() CASCADE;
```

## Verification

After running the cleanup commands, verify that all tables have been removed:

```sql
-- Check for remaining analytics tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_sessions',
    'user_interactions',
    'search_events',
    'filter_events',
    'product_interactions',
    'anonymous_users',
    'user_journeys',
    'user_behavior_patterns',
    'user_shopping_preferences'
  );
```

This query should return 0 rows if cleanup was successful.

## What to Keep

**DO NOT DROP** the following tables as they are essential for the application:

- **products** - Main product catalog
- **auth.users** - Authentication (if using Supabase Auth)
- **user_favorites** - User favorites functionality
- Any other non-analytics tables

## Archived Schema Files

The original schema definitions have been preserved in:
- `supabase_schema.sql` - Core analytics tables
- `supabase_schema_with_users.sql` - Anonymous user tracking tables

These files are kept for reference only and should not be re-applied.

## Next Steps: New Analytics Architecture

When implementing the new backend-only analytics system:

1. **Design Event Model**: Define what events to track
2. **Create Backend API Endpoints**: e.g., `POST /api/analytics/track`
3. **Implement Event Queue**: Consider using a message queue for async processing
4. **Design New Schema**: Create simplified analytics tables focused on business metrics
5. **Add Data Retention Policies**: Implement automatic cleanup of old analytics data
6. **Set Up Analytics Dashboard**: Create visualization/reporting layer

## Cleanup Date
Cleanup performed: 2025-10-23

## Notes
- All frontend analytics code has been removed from the application
- The application will continue to function normally without analytics tracking
- No user data or product data will be affected by this cleanup
