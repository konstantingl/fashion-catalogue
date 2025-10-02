// Configuration file for Fashion Aggregator Analytics
// Replace these with your actual Supabase project credentials

const CONFIG = {
    SUPABASE_URL: 'https://coyfzbrasybilbxyrpyk.supabase.co', // e.g., 'https://your-project.supabase.co'
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveWZ6YnJhc3liaWxieHlycHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjY3ODUsImV4cCI6MjA3NDMwMjc4NX0.HoS2ezSVx_6Qty-jaotmkFaGe-JqjlPlpQlog9XTJX0', // Your public anon key

    // Authentication settings
    AUTH_ENABLED: true,
    AUTH_REDIRECT_URL: window.location.origin,
    PASSWORD_MIN_LENGTH: 6,

    // Analytics settings
    ANALYTICS_ENABLED: true,
    BATCH_SIZE: 10,
    FLUSH_INTERVAL: 5000, // 5 seconds
    HEARTBEAT_INTERVAL: 30000, // 30 seconds

    // Privacy settings
    TRACK_USER_AGENT: true,
    TRACK_SCREEN_RESOLUTION: true,
    TRACK_CLICK_COORDINATES: true,

    // Development mode (set to false in production)
    DEBUG_MODE: false
};

// Check if running in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    CONFIG.DEBUG_MODE = true;
    console.log('Analytics running in debug mode');
}

// Export config
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}