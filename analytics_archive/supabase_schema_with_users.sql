-- Enhanced User Analytics Database Schema with Anonymous User Tracking
-- Run this after the initial schema to add user tracking capabilities

-- Anonymous Users Table
CREATE TABLE anonymous_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_user_id VARCHAR(255) UNIQUE NOT NULL,
    device_fingerprint TEXT,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_sessions INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    user_agent TEXT,
    timezone VARCHAR(100),
    language VARCHAR(10),
    screen_resolution VARCHAR(20),
    is_mobile BOOLEAN DEFAULT FALSE,
    referrer_domain VARCHAR(255),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    user_preferences JSONB DEFAULT '{}', -- shopping preferences, favorite categories
    behavioral_traits JSONB DEFAULT '{}', -- interaction patterns, timing preferences
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add anonymous_user_id to existing tables
ALTER TABLE user_sessions
ADD COLUMN anonymous_user_id VARCHAR(255),
ADD COLUMN is_returning_user BOOLEAN DEFAULT FALSE,
ADD COLUMN sessions_count INTEGER DEFAULT 1,
ADD COLUMN days_since_first_visit INTEGER DEFAULT 0;

ALTER TABLE user_interactions
ADD COLUMN anonymous_user_id VARCHAR(255);

ALTER TABLE search_events
ADD COLUMN anonymous_user_id VARCHAR(255);

ALTER TABLE filter_events
ADD COLUMN anonymous_user_id VARCHAR(255);

ALTER TABLE product_interactions
ADD COLUMN anonymous_user_id VARCHAR(255);

-- User Journey Tracking Table
CREATE TABLE user_journeys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_user_id VARCHAR(255) NOT NULL,
    journey_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    journey_end TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER,
    total_sessions INTEGER DEFAULT 1,
    total_page_views INTEGER DEFAULT 0,
    total_searches INTEGER DEFAULT 0,
    total_filters_applied INTEGER DEFAULT 0,
    total_products_viewed INTEGER DEFAULT 0,
    total_products_clicked INTEGER DEFAULT 0,
    conversion_events JSONB DEFAULT '[]', -- track specific conversion actions
    journey_path JSONB DEFAULT '[]', -- sequence of actions/pages
    exit_page VARCHAR(255),
    bounce_session BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Behavior Patterns Table
CREATE TABLE user_behavior_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_user_id VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL, -- 'search', 'filter', 'browse', 'timing'
    pattern_data JSONB NOT NULL,
    frequency INTEGER DEFAULT 1,
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    first_observed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_observed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Shopping Preferences Table
CREATE TABLE user_shopping_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anonymous_user_id VARCHAR(255) NOT NULL,
    preferred_brands JSONB DEFAULT '[]',
    preferred_categories JSONB DEFAULT '[]',
    preferred_price_range JSONB DEFAULT '{}',
    preferred_attributes JSONB DEFAULT '{}',
    avoided_brands JSONB DEFAULT '[]',
    avoided_categories JSONB DEFAULT '[]',
    search_patterns JSONB DEFAULT '[]',
    interaction_style VARCHAR(50), -- 'browser', 'searcher', 'filter_heavy', 'decisive'
    session_length_preference VARCHAR(50), -- 'quick', 'thorough', 'extended'
    device_preference VARCHAR(20), -- 'mobile', 'desktop', 'mixed'
    time_of_day_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE user_sessions
ADD CONSTRAINT fk_sessions_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE SET NULL;

ALTER TABLE user_interactions
ADD CONSTRAINT fk_interactions_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE SET NULL;

ALTER TABLE search_events
ADD CONSTRAINT fk_search_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE SET NULL;

ALTER TABLE filter_events
ADD CONSTRAINT fk_filter_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE SET NULL;

ALTER TABLE product_interactions
ADD CONSTRAINT fk_product_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE SET NULL;

ALTER TABLE user_journeys
ADD CONSTRAINT fk_journey_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE CASCADE;

ALTER TABLE user_behavior_patterns
ADD CONSTRAINT fk_behavior_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE CASCADE;

ALTER TABLE user_shopping_preferences
ADD CONSTRAINT fk_preferences_anonymous_user
FOREIGN KEY (anonymous_user_id) REFERENCES anonymous_users(anonymous_user_id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_anonymous_users_user_id ON anonymous_users(anonymous_user_id);
CREATE INDEX idx_anonymous_users_last_seen ON anonymous_users(last_seen);
CREATE INDEX idx_anonymous_users_device_fingerprint ON anonymous_users(device_fingerprint);

CREATE INDEX idx_user_sessions_anonymous_user_id ON user_sessions(anonymous_user_id);
CREATE INDEX idx_user_interactions_anonymous_user_id ON user_interactions(anonymous_user_id);
CREATE INDEX idx_search_events_anonymous_user_id ON search_events(anonymous_user_id);
CREATE INDEX idx_filter_events_anonymous_user_id ON filter_events(anonymous_user_id);
CREATE INDEX idx_product_interactions_anonymous_user_id ON product_interactions(anonymous_user_id);

CREATE INDEX idx_user_journeys_user_id ON user_journeys(anonymous_user_id);
CREATE INDEX idx_user_journeys_start ON user_journeys(journey_start);
CREATE INDEX idx_user_behavior_patterns_user_id ON user_behavior_patterns(anonymous_user_id);
CREATE INDEX idx_user_behavior_patterns_type ON user_behavior_patterns(pattern_type);
CREATE INDEX idx_user_shopping_preferences_user_id ON user_shopping_preferences(anonymous_user_id);

-- Update trigger functions to handle anonymous users
CREATE OR REPLACE FUNCTION update_anonymous_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user's last seen and interaction count
    UPDATE anonymous_users
    SET
        last_seen = NOW(),
        total_interactions = total_interactions + 1,
        updated_at = NOW()
    WHERE anonymous_user_id = NEW.anonymous_user_id;

    -- Update session stats
    UPDATE user_sessions
    SET
        total_interactions = (
            SELECT COUNT(*)
            FROM user_interactions
            WHERE session_id = NEW.session_id
        ),
        updated_at = NOW()
    WHERE session_id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for anonymous user stats updates
CREATE TRIGGER trigger_update_anonymous_user_stats
    AFTER INSERT ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_anonymous_user_stats();

-- Function to create or update user journey
CREATE OR REPLACE FUNCTION update_user_journey()
RETURNS TRIGGER AS $$
DECLARE
    current_journey_id UUID;
    journey_duration INTEGER;
BEGIN
    -- Find or create current journey for this user
    SELECT id INTO current_journey_id
    FROM user_journeys
    WHERE anonymous_user_id = NEW.anonymous_user_id
        AND journey_end IS NULL
    ORDER BY journey_start DESC
    LIMIT 1;

    -- If no active journey, create one
    IF current_journey_id IS NULL THEN
        INSERT INTO user_journeys (anonymous_user_id, journey_start)
        VALUES (NEW.anonymous_user_id, NOW())
        RETURNING id INTO current_journey_id;
    END IF;

    -- Update journey stats based on the event type
    CASE NEW.event_type
        WHEN 'page_view' THEN
            UPDATE user_journeys
            SET total_page_views = total_page_views + 1,
                updated_at = NOW()
            WHERE id = current_journey_id;
        WHEN 'product_click' THEN
            UPDATE user_journeys
            SET total_products_clicked = total_products_clicked + 1,
                updated_at = NOW()
            WHERE id = current_journey_id;
        ELSE
            UPDATE user_journeys
            SET updated_at = NOW()
            WHERE id = current_journey_id;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for journey tracking
CREATE TRIGGER trigger_update_user_journey
    AFTER INSERT ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_journey();

-- Function to analyze and store user behavior patterns
CREATE OR REPLACE FUNCTION analyze_user_behavior()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be expanded to analyze patterns
    -- For now, it's a placeholder for future pattern analysis

    -- Update user preferences based on interactions
    IF NEW.event_type = 'filter' THEN
        -- Update filter usage patterns
        INSERT INTO user_behavior_patterns (anonymous_user_id, pattern_type, pattern_data)
        VALUES (NEW.anonymous_user_id, 'filter_usage', jsonb_build_object(
            'filter_type', NEW.metadata->>'filterType',
            'timestamp', NEW.timestamp
        ))
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for behavior analysis
CREATE TRIGGER trigger_analyze_user_behavior
    AFTER INSERT ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION analyze_user_behavior();

-- Views for common queries
CREATE VIEW user_session_summary AS
SELECT
    au.anonymous_user_id,
    au.first_seen,
    au.last_seen,
    au.total_sessions,
    au.total_interactions,
    au.is_mobile,
    DATE_PART('day', au.last_seen - au.first_seen) as days_active,
    CASE
        WHEN au.total_sessions = 1 THEN 'new'
        WHEN au.total_sessions <= 5 THEN 'occasional'
        WHEN au.total_sessions <= 20 THEN 'regular'
        ELSE 'power_user'
    END as user_type
FROM anonymous_users au;

CREATE VIEW user_engagement_metrics AS
SELECT
    anonymous_user_id,
    COUNT(DISTINCT session_id) as session_count,
    SUM(total_interactions) as total_interactions,
    AVG(session_duration_seconds) as avg_session_duration,
    COUNT(DISTINCT DATE(start_time)) as active_days,
    MAX(start_time) as last_session
FROM user_sessions
WHERE anonymous_user_id IS NOT NULL
GROUP BY anonymous_user_id;

-- Sample queries for analytics insights
-- Most engaged users:
-- SELECT * FROM user_engagement_metrics ORDER BY total_interactions DESC LIMIT 20;

-- User retention analysis:
-- SELECT user_type, COUNT(*) FROM user_session_summary GROUP BY user_type;

-- Daily active users:
-- SELECT DATE(start_time), COUNT(DISTINCT anonymous_user_id) as dau
-- FROM user_sessions
-- WHERE start_time >= NOW() - INTERVAL '30 days'
-- GROUP BY DATE(start_time) ORDER BY DATE(start_time);