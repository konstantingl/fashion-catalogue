-- =====================================================
-- Clean Analytics Schema for Fashion Aggregator
-- Date: 2025-10-23
-- Description: Simplified, privacy-friendly analytics
-- =====================================================

-- =====================================================
-- 1. ANALYTICS USERS TABLE
-- Tracks both anonymous and registered users
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_users (
    user_id UUID PRIMARY KEY,
    is_registered BOOLEAN DEFAULT FALSE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Simple device fingerprinting (privacy-friendly)
    device_fingerprint TEXT NOT NULL,
    user_agent TEXT,
    screen_resolution TEXT, -- Format: "1920x1080"
    timezone TEXT, -- e.g., "America/New_York"

    -- Timestamps
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_analytics_users_fingerprint ON analytics_users(device_fingerprint);
CREATE INDEX idx_analytics_users_auth ON analytics_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_analytics_users_last_seen ON analytics_users(last_seen DESC);

-- =====================================================
-- 2. ANALYTICS SESSIONS TABLE
-- Tracks user sessions with activity-based timeout
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES analytics_users(user_id) ON DELETE CASCADE,

    -- Session timing
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
            ELSE EXTRACT(EPOCH FROM (last_activity_at - started_at))::INTEGER
        END
    ) STORED,

    -- Session metadata
    is_active BOOLEAN DEFAULT TRUE,
    page_url TEXT,
    referrer TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_sessions_user ON analytics_sessions(user_id);
CREATE INDEX idx_analytics_sessions_started ON analytics_sessions(started_at DESC);
CREATE INDEX idx_analytics_sessions_active ON analytics_sessions(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 3. ANALYTICS SEARCHES TABLE
-- Tracks search queries by users
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_searches (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES analytics_users(user_id) ON DELETE CASCADE,

    -- Search data
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type TEXT DEFAULT 'ai_search', -- 'ai_search', 'keyword', etc.

    -- Timing
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_searches_session ON analytics_searches(session_id);
CREATE INDEX idx_analytics_searches_user ON analytics_searches(user_id);
CREATE INDEX idx_analytics_searches_created ON analytics_searches(created_at DESC);
-- Full-text search on queries (useful for analytics)
CREATE INDEX idx_analytics_searches_query ON analytics_searches USING gin(to_tsvector('english', search_query));

-- =====================================================
-- 4. ANALYTICS FILTERS TABLE
-- Tracks filter usage by users
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_filters (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES analytics_users(user_id) ON DELETE CASCADE,

    -- Filter data
    filter_type TEXT NOT NULL, -- 'brand', 'category', 'price', 'attribute'
    filter_key TEXT, -- For attributes: 'length', 'color', etc.
    filter_values JSONB NOT NULL, -- Flexible storage for filter values
    action TEXT DEFAULT 'apply', -- 'apply', 'remove', 'clear'

    -- Timing
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analytics_filters_session ON analytics_filters(session_id);
CREATE INDEX idx_analytics_filters_user ON analytics_filters(user_id);
CREATE INDEX idx_analytics_filters_type ON analytics_filters(filter_type);
CREATE INDEX idx_analytics_filters_created ON analytics_filters(created_at DESC);
CREATE INDEX idx_analytics_filters_values ON analytics_filters USING gin(filter_values);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function: Update last_seen timestamp for users
CREATE OR REPLACE FUNCTION update_analytics_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE analytics_users
    SET
        last_seen = NOW(),
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update last_seen when new session starts
CREATE TRIGGER trigger_update_user_last_seen
    AFTER INSERT ON analytics_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_user_last_seen();

-- Function: Auto-end inactive sessions (30min timeout)
CREATE OR REPLACE FUNCTION end_inactive_sessions()
RETURNS void AS $$
BEGIN
    UPDATE analytics_sessions
    SET
        ended_at = last_activity_at,
        is_active = FALSE
    WHERE
        is_active = TRUE
        AND last_activity_at < NOW() - INTERVAL '30 minutes'
        AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: Schedule this function to run periodically (e.g., every 5 minutes)
-- via pg_cron or external cron job

-- Function: Update session activity timestamp
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE analytics_sessions
    SET last_activity_at = NOW()
    WHERE session_id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update activity when search happens
CREATE TRIGGER trigger_update_session_on_search
    AFTER INSERT ON analytics_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- Trigger: Update activity when filter is used
CREATE TRIGGER trigger_update_session_on_filter
    AFTER INSERT ON analytics_filters
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- =====================================================
-- USEFUL ANALYTICS VIEWS
-- =====================================================

-- View: Session summary with counts
CREATE OR REPLACE VIEW analytics_session_summary AS
SELECT
    s.session_id,
    s.user_id,
    u.is_registered,
    s.started_at,
    s.ended_at,
    s.duration_seconds,
    COUNT(DISTINCT se.id) as search_count,
    COUNT(DISTINCT f.id) as filter_count
FROM analytics_sessions s
JOIN analytics_users u ON s.user_id = u.user_id
LEFT JOIN analytics_searches se ON s.session_id = se.session_id
LEFT JOIN analytics_filters f ON s.session_id = f.session_id
GROUP BY s.session_id, s.user_id, u.is_registered, s.started_at, s.ended_at, s.duration_seconds;

-- View: User engagement metrics
CREATE OR REPLACE VIEW analytics_user_engagement AS
SELECT
    u.user_id,
    u.is_registered,
    u.first_seen,
    u.last_seen,
    COUNT(DISTINCT s.session_id) as total_sessions,
    COUNT(DISTINCT se.id) as total_searches,
    COUNT(DISTINCT f.id) as total_filters,
    AVG(s.duration_seconds)::INTEGER as avg_session_duration_seconds,
    MAX(s.started_at) as last_session_at
FROM analytics_users u
LEFT JOIN analytics_sessions s ON u.user_id = s.user_id
LEFT JOIN analytics_searches se ON u.user_id = se.user_id
LEFT JOIN analytics_filters f ON u.user_id = f.user_id
GROUP BY u.user_id, u.is_registered, u.first_seen, u.last_seen;

-- View: Popular searches
CREATE OR REPLACE VIEW analytics_popular_searches AS
SELECT
    search_query,
    COUNT(*) as search_count,
    AVG(results_count)::INTEGER as avg_results,
    MAX(created_at) as last_searched
FROM analytics_searches
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY search_query
ORDER BY search_count DESC
LIMIT 100;

-- View: Filter usage statistics
CREATE OR REPLACE VIEW analytics_filter_stats AS
SELECT
    filter_type,
    filter_key,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_used
FROM analytics_filters
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY filter_type, filter_key
ORDER BY usage_count DESC;

-- =====================================================
-- DATA RETENTION
-- =====================================================

-- Function: Clean up old analytics data (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    -- Delete old searches (cascades will handle related data)
    DELETE FROM analytics_searches
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete old filters
    DELETE FROM analytics_filters
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete old sessions
    DELETE FROM analytics_sessions
    WHERE started_at < NOW() - INTERVAL '90 days';

    -- Clean up orphaned users (no recent sessions)
    DELETE FROM analytics_users
    WHERE user_id NOT IN (
        SELECT DISTINCT user_id FROM analytics_sessions
        WHERE started_at > NOW() - INTERVAL '90 days'
    )
    AND last_seen < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Note: Schedule this function to run daily via pg_cron or external cron job

-- =====================================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant)
-- =====================================================

-- Enable RLS on tables (optional)
-- ALTER TABLE analytics_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_searches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE analytics_filters ENABLE ROW LEVEL SECURITY;

-- Create policies as needed for your security requirements

-- =====================================================
-- GRANTS (Adjust based on your Supabase setup)
-- =====================================================

-- Grant necessary permissions to authenticated and anon roles
GRANT SELECT, INSERT, UPDATE ON analytics_users TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON analytics_sessions TO authenticated, anon;
GRANT SELECT, INSERT ON analytics_searches TO authenticated, anon;
GRANT SELECT, INSERT ON analytics_filters TO authenticated, anon;

-- Grant sequence permissions
GRANT USAGE ON SEQUENCE analytics_searches_id_seq TO authenticated, anon;
GRANT USAGE ON SEQUENCE analytics_filters_id_seq TO authenticated, anon;

-- Grant view access
GRANT SELECT ON analytics_session_summary TO authenticated, anon;
GRANT SELECT ON analytics_user_engagement TO authenticated, anon;
GRANT SELECT ON analytics_popular_searches TO authenticated, anon;
GRANT SELECT ON analytics_filter_stats TO authenticated, anon;

-- =====================================================
-- NOTES
-- =====================================================

/*
IMPLEMENTATION NOTES:

1. Session Timeout:
   - Sessions auto-end after 30 minutes of inactivity
   - Schedule end_inactive_sessions() to run every 5 minutes

2. Data Retention:
   - Default retention: 90 days
   - Schedule cleanup_old_analytics() to run daily

3. Privacy:
   - Only simple fingerprinting (user agent + screen + timezone)
   - No invasive tracking methods
   - Can be made GDPR compliant with user consent

4. Performance:
   - Indexes optimize common queries
   - Consider partitioning for large datasets
   - Views are materialized for better performance if needed

5. Maintenance:
   - Monitor table sizes regularly
   - Adjust retention period as needed
   - Review indexes periodically

6. Cron Jobs (if using pg_cron extension):
   - Every 5 minutes: end_inactive_sessions()
   - Daily at 2 AM: cleanup_old_analytics()
*/
