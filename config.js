// Configuration file for Fashion Aggregator
// Replace these with your actual credentials

const CONFIG = {
    // Search API settings
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'  // Local development
        : 'https://fashion-search-api.vercel.app',  // Production

    SUPABASE_URL: 'https://ytrfzgxzdbkscwxfiwnv.supabase.co', // Backend Supabase project with products table
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0cmZ6Z3h6ZGJrc2N3eGZpd252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NzA1NzIsImV4cCI6MjA3NjU0NjU3Mn0.hal3yP37hbz--yGiOuX-CR0E_mzpHAKnbJwkBNJMVJ8', // Backend project anon key

    // Google Gemini API settings
    GEMINI_API_KEY: 'AIzaSyA5M00GZ0jCe2ubWrzG98wUselvsakYwrI', // Get from https://aistudio.google.com/apikey

    // Authentication settings
    AUTH_ENABLED: true,
    AUTH_REDIRECT_URL: window.location.origin,
    PASSWORD_MIN_LENGTH: 6,

    // Analytics settings
    ANALYTICS_ENABLED: true,
    ANALYTICS_BATCH_SIZE: 5,
    ANALYTICS_FLUSH_INTERVAL: 10000, // 10 seconds
    ANALYTICS_HEARTBEAT_INTERVAL: 30000, // 30 seconds

    // Development mode (set to false in production)
    DEBUG_MODE: true
};

// Check if running in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    CONFIG.DEBUG_MODE = true;
}

// Export config
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}