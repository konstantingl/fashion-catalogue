-- User Analytics Database Schema for Fashion Aggregator

-- User Sessions Table
CREATE TABLE user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    viewport_width INTEGER,
    viewport_height INTEGER,
    referrer TEXT,
    is_mobile BOOLEAN DEFAULT FALSE,
    session_duration_seconds INTEGER,
    total_interactions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Interactions Table
CREATE TABLE user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'click', 'scroll', 'hover', etc.
    element_type VARCHAR(100), -- 'product_card', 'filter_button', 'load_more', etc.
    element_id VARCHAR(255), -- specific element identifier
    element_text TEXT, -- button text, product title, etc.
    page_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- flexible field for additional data
    x_coordinate INTEGER, -- click position
    y_coordinate INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search Events Table
CREATE TABLE search_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    search_tokens TEXT[], -- tokenized search terms
    results_count INTEGER,
    search_duration_ms INTEGER, -- time to complete search
    was_cleared BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- search suggestions, typos, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Filter Events Table
CREATE TABLE filter_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
    filter_type VARCHAR(100) NOT NULL, -- 'brand', 'category', 'price', 'attribute'
    filter_action VARCHAR(50) NOT NULL, -- 'add', 'remove', 'clear', 'reset'
    filter_key VARCHAR(255), -- specific filter name
    filter_values JSONB, -- selected values
    results_count INTEGER, -- number of products after filtering
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Interactions Table
CREATE TABLE product_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
    product_url TEXT,
    product_brand VARCHAR(255),
    product_category VARCHAR(255),
    product_title TEXT,
    product_price DECIMAL(10,2),
    interaction_type VARCHAR(100), -- 'click', 'view', 'image_navigation'
    image_index INTEGER, -- for image slider interactions
    position_in_list INTEGER, -- where in the product list
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_start_time ON user_sessions(start_time);

CREATE INDEX idx_user_interactions_session_id ON user_interactions(session_id);
CREATE INDEX idx_user_interactions_timestamp ON user_interactions(timestamp);
CREATE INDEX idx_user_interactions_event_type ON user_interactions(event_type);

CREATE INDEX idx_search_events_session_id ON search_events(session_id);
CREATE INDEX idx_search_events_timestamp ON search_events(timestamp);
CREATE INDEX idx_search_events_query ON search_events USING gin(to_tsvector('english', search_query));

CREATE INDEX idx_filter_events_session_id ON filter_events(session_id);
CREATE INDEX idx_filter_events_timestamp ON filter_events(timestamp);
CREATE INDEX idx_filter_events_type ON filter_events(filter_type);

CREATE INDEX idx_product_interactions_session_id ON product_interactions(session_id);
CREATE INDEX idx_product_interactions_timestamp ON product_interactions(timestamp);
CREATE INDEX idx_product_interactions_brand ON product_interactions(product_brand);

-- Create a function to update session stats
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
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

-- Create trigger to automatically update session stats
CREATE TRIGGER trigger_update_session_stats
    AFTER INSERT ON user_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_stats();

-- Row Level Security (optional - enable if needed)
-- ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE filter_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE product_interactions ENABLE ROW LEVEL SECURITY;