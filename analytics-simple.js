/**
 * Simple Analytics Client for Fashion Aggregator
 * Privacy-friendly, activity-based session tracking
 * Tracks: users, sessions, searches, filters
 */

class SimpleAnalytics {
    constructor(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;

        // User & session state
        this.userId = null;
        this.sessionId = null;
        this.deviceFingerprint = null;
        this.isRegistered = false;

        // Event batching
        this.eventQueue = [];
        this.batchSize = 5;
        this.flushInterval = 10000; // 10 seconds
        this.flushTimer = null;

        // Heartbeat
        this.heartbeatInterval = 30000; // 30 seconds
        this.heartbeatTimer = null;

        // Initialization
        this.initialize();
    }

    /**
     * Initialize analytics system
     */
    async initialize() {
        try {
            if (window.CONFIG?.DEBUG_MODE) {
                console.log('[Analytics] Starting initialization...');
            }

            // Generate device fingerprint
            this.deviceFingerprint = this.generateFingerprint();
            if (window.CONFIG?.DEBUG_MODE) {
                console.log('[Analytics] Fingerprint generated:', this.deviceFingerprint);
            }

            // Get or create user
            await this.initializeUser();
            if (window.CONFIG?.DEBUG_MODE) {
                console.log('[Analytics] User initialized:', this.userId);
            }

            // Start session
            await this.startSession();
            if (window.CONFIG?.DEBUG_MODE) {
                console.log('[Analytics] Session started:', this.sessionId);
            }

            // Setup event handlers
            this.setupEventHandlers();

            // Start heartbeat
            this.startHeartbeat();

            // Start auto-flush
            this.startAutoFlush();

            if (window.CONFIG?.DEBUG_MODE) {
                console.log('[Analytics] Initialized successfully!', {
                    userId: this.userId,
                    sessionId: this.sessionId,
                    fingerprint: this.deviceFingerprint
                });
            }
        } catch (error) {
            console.error('[Analytics] Initialization failed:', error);
            console.error('[Analytics] Error details:', {
                message: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Generate simple device fingerprint
     * Privacy-friendly: user agent + screen + timezone only
     */
    generateFingerprint() {
        const userAgent = navigator.userAgent || 'unknown';
        const screenRes = `${screen.width}x${screen.height}`;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        const data = `${userAgent}-${screenRes}-${timezone}`;

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return `fp_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Initialize or get existing user
     */
    async initializeUser() {
        // Check if user is authenticated
        const authUser = window.authManager?.getUserId();
        this.isRegistered = !!authUser;

        if (this.isRegistered) {
            // Use authenticated user ID
            this.userId = authUser;
            await this.upsertUser(authUser, true, authUser);
        } else {
            // Check localStorage for existing anonymous user
            let anonymousId = this.getStoredUserId();

            if (!anonymousId) {
                // Generate new anonymous user ID
                anonymousId = this.generateUserId();
                this.storeUserId(anonymousId);
            }

            this.userId = anonymousId;
            await this.upsertUser(anonymousId, false, null);
        }
    }

    /**
     * Get stored user ID from localStorage
     */
    getStoredUserId() {
        try {
            return localStorage.getItem('analytics_user_id');
        } catch (e) {
            return null;
        }
    }

    /**
     * Store user ID in localStorage
     */
    storeUserId(userId) {
        try {
            localStorage.setItem('analytics_user_id', userId);
        } catch (e) {
            console.warn('[Analytics] Failed to store user ID');
        }
    }

    /**
     * Generate anonymous user ID
     */
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Upsert user in database
     */
    async upsertUser(userId, isRegistered, authUserId) {
        const userData = {
            user_id: userId,
            is_registered: isRegistered,
            auth_user_id: authUserId,
            device_fingerprint: this.deviceFingerprint,
            user_agent: navigator.userAgent,
            screen_resolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        };

        await this.makeSupabaseRequest('analytics_users', 'POST', userData, {
            'Prefer': 'resolution=merge-duplicates'
        });
    }

    /**
     * Start new session
     */
    async startSession() {
        this.sessionId = this.generateSessionId();

        const sessionData = {
            session_id: this.sessionId,
            user_id: this.userId,
            page_url: window.location.href,
            referrer: document.referrer || null
        };

        try {
            await this.makeSupabaseRequest('analytics_sessions', 'POST', sessionData);
        } catch (error) {
            console.error('[Analytics] Failed to create session, retrying without session_id...');
            // Let Supabase generate the UUID
            delete sessionData.session_id;
            const response = await this.makeSupabaseRequest('analytics_sessions', 'POST', sessionData, {
                'Prefer': 'return=representation'
            });
            // The response should contain the generated session_id
            if (response && response[0] && response[0].session_id) {
                this.sessionId = response[0].session_id;
            }
        }
    }

    /**
     * Generate session ID (UUID v4)
     */
    generateSessionId() {
        // Generate a proper UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Track search event
     */
    trackSearch(query, resultsCount = 0, searchType = 'ai_search') {
        if (!this.sessionId || !query) return;

        const event = {
            table: 'analytics_searches',
            data: {
                session_id: this.sessionId,
                user_id: this.userId,
                search_query: query,
                results_count: resultsCount,
                search_type: searchType
            }
        };

        this.queueEvent(event);
    }

    /**
     * Track filter usage
     */
    trackFilter(filterType, filterValues, filterKey = null, action = 'apply') {
        if (!this.sessionId || !filterType) return;

        const event = {
            table: 'analytics_filters',
            data: {
                session_id: this.sessionId,
                user_id: this.userId,
                filter_type: filterType,
                filter_key: filterKey,
                filter_values: filterValues,
                action: action
            }
        };

        this.queueEvent(event);
    }

    /**
     * Queue event for batching
     */
    queueEvent(event) {
        this.eventQueue.push(event);

        if (this.eventQueue.length >= this.batchSize) {
            this.flushQueue();
        }
    }

    /**
     * Flush event queue to database
     */
    async flushQueue() {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        // Group events by table
        const eventsByTable = events.reduce((acc, event) => {
            if (!acc[event.table]) acc[event.table] = [];
            acc[event.table].push(event.data);
            return acc;
        }, {});

        // Send to each table
        for (const [table, data] of Object.entries(eventsByTable)) {
            try {
                await this.makeSupabaseRequest(table, 'POST', data);
            } catch (error) {
                console.error(`[Analytics] Failed to flush ${table}:`, error);
                // Re-queue failed events
                data.forEach(item => this.queueEvent({ table, data: item }));
            }
        }
    }

    /**
     * Send heartbeat to keep session alive
     */
    async sendHeartbeat() {
        if (!this.sessionId) return;

        try {
            // Update last_activity_at
            await this.makeSupabaseRequest(
                `analytics_sessions?session_id=eq.${this.sessionId}`,
                'PATCH',
                { last_activity_at: new Date().toISOString() }
            );
        } catch (error) {
            if (window.CONFIG?.DEBUG_MODE) {
                console.warn('[Analytics] Heartbeat failed:', error);
            }
        }
    }

    /**
     * End session
     */
    async endSession() {
        if (!this.sessionId) return;

        try {
            // Flush any pending events
            await this.flushQueue();

            // Mark session as ended
            await this.makeSupabaseRequest(
                `analytics_sessions?session_id=eq.${this.sessionId}`,
                'PATCH',
                {
                    ended_at: new Date().toISOString(),
                    is_active: false
                }
            );
        } catch (error) {
            console.error('[Analytics] Failed to end session:', error);
        }
    }

    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);
    }

    /**
     * Start auto-flush timer
     */
    startAutoFlush() {
        this.flushTimer = setInterval(() => {
            this.flushQueue();
        }, this.flushInterval);
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // End session on page unload
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flushQueue(); // Flush events when page becomes hidden
            }
        });
    }

    /**
     * Make Supabase REST API request
     */
    async makeSupabaseRequest(endpoint, method, data, extraHeaders = {}) {
        const url = `${this.supabaseUrl}/rest/v1/${endpoint}`;

        const headers = {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            ...extraHeaders
        };

        const options = {
            method,
            headers
        };

        if (data && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        if (window.CONFIG?.DEBUG_MODE) {
            console.log('[Analytics] Request:', method, endpoint, data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Analytics] Request failed:', {
                method,
                endpoint,
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                data: data
            });
            throw new Error(`Supabase request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        if (window.CONFIG?.DEBUG_MODE) {
            console.log('[Analytics] Request successful:', method, endpoint);
        }

        // Return response if content exists
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            if (text) {
                return JSON.parse(text);
            }
        }

        return null;
    }

    /**
     * Destroy analytics (cleanup)
     */
    destroy() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.endSession();
    }
}

/**
 * Initialize analytics when CONFIG is available
 */
function initializeSimpleAnalytics(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
        console.error('[Analytics] Missing Supabase credentials');
        return null;
    }

    return new SimpleAnalytics(supabaseUrl, supabaseKey);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.SimpleAnalytics = SimpleAnalytics;
    window.initializeSimpleAnalytics = initializeSimpleAnalytics;
}
