class UserAnalytics {
    constructor(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.sessionId = this.generateSessionId();
        this.sessionStartTime = new Date();
        this.eventQueue = [];
        this.batchSize = 10;
        this.flushInterval = 5000; // 5 seconds
        this.isOnline = navigator.onLine;
        this.heartbeatInterval = 30000; // 30 seconds
        this.visibilityChangeTime = new Date();

        // Anonymous user tracking
        this.anonymousUserId = null;
        this.userIdentifier = null;
        this.isReturningUser = false;
        this.userJourneyId = null;
        this.sessionCount = 1;

        this.init();
    }

    async init() {
        await this.initializeAnonymousUser();
        await this.initializeSession();
        this.setupEventListeners();
        this.startHeartbeat();
        this.startAutoFlush();
    }

    async initializeAnonymousUser() {
        console.log('Initializing anonymous user...');

        try {
            // Initialize user identification system
            if (window.initializeUserIdentification) {
                console.log('User identification system found, initializing...');
                this.userIdentifier = await window.initializeUserIdentification();
                this.anonymousUserId = this.userIdentifier.getAnonymousUserId();
                this.isReturningUser = this.userIdentifier.isReturningUser();

                console.log('Anonymous user ID:', this.anonymousUserId);
                console.log('Is returning user:', this.isReturningUser);

                // Create or update anonymous user record
                await this.createOrUpdateAnonymousUser();
            } else {
                console.warn('User identification system not loaded, using fallback');
                this.anonymousUserId = this.generateFallbackUserId();
                console.log('Fallback user ID:', this.anonymousUserId);
            }
        } catch (error) {
            console.error('Failed to initialize anonymous user:', error);
            this.anonymousUserId = this.generateFallbackUserId();
            console.log('Emergency fallback user ID:', this.anonymousUserId);
        }
    }

    generateFallbackUserId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `fallback_user_${timestamp}_${random}`;
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            screenWidth: screen.width,
            screenHeight: screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            referrer: document.referrer || null
        };
    }

    async createOrUpdateAnonymousUser() {
        if (!this.anonymousUserId) {
            console.warn('No anonymous user ID available');
            return;
        }

        const userData = this.userIdentifier ? this.userIdentifier.getUserData() : {};
        const deviceInfo = this.getDeviceInfo();

        // Get URL parameters for campaign tracking
        const urlParams = new URLSearchParams(window.location.search);

        const anonymousUserData = {
            anonymous_user_id: this.anonymousUserId,
            device_fingerprint: this.userIdentifier ? this.userIdentifier.getDeviceFingerprint() : null,
            user_agent: deviceInfo.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            screen_resolution: `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}`,
            is_mobile: deviceInfo.isMobile,
            referrer_domain: this.getReferrerDomain(),
            utm_source: urlParams.get('utm_source'),
            utm_medium: urlParams.get('utm_medium'),
            utm_campaign: urlParams.get('utm_campaign'),
            last_seen: new Date().toISOString()
        };

        console.log('Creating/updating anonymous user:', this.anonymousUserId);

        try {
            // First try to create new user (most common case)
            try {
                const createResponse = await this.makeSupabaseRequest('anonymous_users', 'POST', anonymousUserData);
                console.log('New anonymous user created:', this.anonymousUserId);
                return;
            } catch (createError) {
                // If creation failed due to duplicate, try update
                if (createError.message.includes('duplicate') || createError.message.includes('conflict')) {
                    console.log('User exists, updating...');
                    const updateResponse = await this.makeSupabaseRequest(
                        `anonymous_users?anonymous_user_id=eq.${this.anonymousUserId}`,
                        'PATCH',
                        {
                            last_seen: new Date().toISOString(),
                            total_sessions: this.sessionCount,
                            user_agent: anonymousUserData.user_agent,
                            updated_at: new Date().toISOString()
                        }
                    );
                    console.log('Anonymous user updated:', this.anonymousUserId);
                } else {
                    throw createError;
                }
            }

        } catch (error) {
            console.error('Failed to create/update anonymous user:', error);
            console.error('Error details:', error.message);

            // Check if the table exists
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.error('Database table "anonymous_users" does not exist. Please run the database schema update.');
                console.error('Execute the SQL in "supabase_schema_with_users.sql" in your Supabase dashboard.');
            }
        }
    }

    getReferrerDomain() {
        try {
            if (document.referrer) {
                return new URL(document.referrer).hostname;
            }
        } catch (error) {
            // Invalid URL
        }
        return null;
    }

    async initializeSession() {
        const deviceInfo = this.getDeviceInfo();
        const daysSinceFirstVisit = this.userIdentifier ? this.userIdentifier.getDaysSinceFirstVisit() : 0;

        const sessionData = {
            session_id: this.sessionId,
            anonymous_user_id: this.anonymousUserId,
            start_time: this.sessionStartTime.toISOString(),
            user_agent: deviceInfo.userAgent,
            screen_width: deviceInfo.screenWidth,
            screen_height: deviceInfo.screenHeight,
            viewport_width: deviceInfo.viewportWidth,
            viewport_height: deviceInfo.viewportHeight,
            referrer: deviceInfo.referrer,
            is_mobile: deviceInfo.isMobile,
            is_returning_user: this.isReturningUser,
            sessions_count: this.sessionCount,
            days_since_first_visit: daysSinceFirstVisit
        };

        try {
            await this.makeSupabaseRequest('user_sessions', 'POST', sessionData);
            console.log('Analytics session initialized:', this.sessionId);

            // Initialize user journey tracking
            await this.initializeUserJourney();
        } catch (error) {
            console.error('Failed to initialize analytics session:', error);
        }
    }

    async makeSupabaseRequest(table, method = 'POST', data = null) {
        const url = `${this.supabaseUrl}/rest/v1/${table}`;
        const options = {
            method,
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Supabase request failed:', {
                    url,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    errorBody: errorText
                });
                throw new Error(`Supabase request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Network error in Supabase request:', error);
            throw error;
        }
    }

    async initializeUserJourney() {
        if (!this.anonymousUserId) {
            console.warn('Cannot initialize user journey without anonymous user ID');
            return;
        }

        const journeyData = {
            anonymous_user_id: this.anonymousUserId,
            journey_start: this.sessionStartTime.toISOString()
        };

        try {
            const response = await this.makeSupabaseRequest('user_journeys', 'POST', journeyData);
            if (response && response.length > 0) {
                this.userJourneyId = response[0].id;
                console.log('User journey initialized:', this.userJourneyId);
            }
        } catch (error) {
            console.error('Failed to initialize user journey:', error);
            // Check if the table exists
            if (error.message.includes('relation') && error.message.includes('does not exist')) {
                console.error('Database table "user_journeys" does not exist. Please run the database schema update.');
            }
        }
    }

    trackEvent(eventType, elementType, additionalData = {}) {
        const event = {
            session_id: this.sessionId,
            anonymous_user_id: this.anonymousUserId,
            event_type: eventType,
            element_type: elementType,
            element_id: additionalData.elementId || null,
            element_text: additionalData.elementText || null,
            page_url: window.location.href,
            timestamp: new Date().toISOString(),
            metadata: additionalData.metadata || {},
            x_coordinate: additionalData.x || null,
            y_coordinate: additionalData.y || null
        };

        this.eventQueue.push({
            table: 'user_interactions',
            data: event
        });

        this.tryFlushQueue();
    }

    trackClick(element, additionalData = {}) {
        const elementType = this.getElementType(element);
        const elementText = this.getElementText(element);
        const elementId = element.id || this.generateElementId(element);

        this.trackEvent('click', elementType, {
            elementId,
            elementText,
            x: additionalData.x,
            y: additionalData.y,
            metadata: {
                ...additionalData,
                tagName: element.tagName.toLowerCase(),
                className: element.className,
                dataset: element.dataset
            }
        });
    }

    trackSearch(query, resultsCount = null, duration = null, wasCleared = false) {
        const searchData = {
            session_id: this.sessionId,
            anonymous_user_id: this.anonymousUserId,
            search_query: query,
            search_tokens: this.tokenizeSearch(query),
            results_count: resultsCount,
            search_duration_ms: duration,
            was_cleared: wasCleared,
            timestamp: new Date().toISOString(),
            metadata: {
                queryLength: query.length,
                hasSpecialChars: /[^a-zA-Z0-9\s]/.test(query),
                wordCount: query.trim().split(/\s+/).length
            }
        };

        this.eventQueue.push({
            table: 'search_events',
            data: searchData
        });

        // Track behavior pattern
        this.trackUserBehaviorPattern('search', {
            query: query,
            resultsCount: resultsCount,
            wasCleared: wasCleared
        });

        this.tryFlushQueue();
    }

    trackFilter(filterType, action, filterKey = null, filterValues = null, resultsCount = null) {
        const filterData = {
            session_id: this.sessionId,
            anonymous_user_id: this.anonymousUserId,
            filter_type: filterType,
            filter_action: action,
            filter_key: filterKey,
            filter_values: filterValues,
            results_count: resultsCount,
            timestamp: new Date().toISOString(),
            metadata: {
                filtersActive: this.getActiveFiltersCount(),
                filterCombination: this.getCurrentFilterState()
            }
        };

        this.eventQueue.push({
            table: 'filter_events',
            data: filterData
        });

        // Track behavior pattern for filter usage
        this.trackUserBehaviorPattern('filter', {
            filterType: filterType,
            action: action,
            filterValues: filterValues,
            resultsCount: resultsCount
        });

        this.tryFlushQueue();
    }

    trackProductInteraction(product, interactionType, additionalData = {}) {
        const productData = {
            session_id: this.sessionId,
            anonymous_user_id: this.anonymousUserId,
            product_url: product.original_data?.item_page_url || product.item_page_url || null,
            product_brand: product.original_data?.brand || product.brand || null,
            product_category: product.original_data?.category || product.category || null,
            product_title: product.original_data?.title || product.title || null,
            product_price: product.original_data?.price_eur || product.price_eur || null,
            interaction_type: interactionType,
            image_index: additionalData.imageIndex || null,
            position_in_list: additionalData.positionInList || null,
            timestamp: new Date().toISOString(),
            metadata: {
                confidenceScore: product.confidence_score,
                enrichedCategory: product.enriched_category,
                attributes: product.attributes,
                ...additionalData.metadata
            }
        };

        this.eventQueue.push({
            table: 'product_interactions',
            data: productData
        });

        // Track behavior pattern for product interactions
        this.trackUserBehaviorPattern('product_interaction', {
            interactionType: interactionType,
            brand: productData.product_brand,
            category: productData.product_category,
            price: productData.product_price,
            position: additionalData.positionInList
        });

        this.tryFlushQueue();
    }

    getElementType(element) {
        // Determine element type based on various characteristics
        if (element.classList.contains('product-card')) return 'product_card';
        if (element.classList.contains('load-more-btn') || element.id === 'load-more-btn') return 'load_more_button';
        if (element.classList.contains('filter-button')) return 'filter_button';
        if (element.classList.contains('search-clear') || element.id === 'search-clear') return 'search_clear';
        if (element.classList.contains('image-dot')) return 'image_dot';
        if (element.classList.contains('save-btn')) return 'filter_save_button';
        if (element.classList.contains('reset-btn')) return 'filter_reset_button';
        if (element.id === 'clear-all-filters') return 'clear_all_filters';
        if (element.tagName === 'INPUT' && element.type === 'checkbox') return 'filter_checkbox';
        if (element.tagName === 'INPUT' && element.type === 'text') return 'text_input';
        if (element.tagName === 'BUTTON') return 'button';
        if (element.tagName === 'A') return 'link';
        return 'unknown';
    }

    getElementText(element) {
        if (element.textContent) return element.textContent.trim().substring(0, 100);
        if (element.value) return element.value.substring(0, 100);
        if (element.placeholder) return element.placeholder.substring(0, 100);
        if (element.alt) return element.alt.substring(0, 100);
        return null;
    }

    generateElementId(element) {
        if (element.id) return element.id;

        // Generate a unique identifier based on element characteristics
        const tagName = element.tagName.toLowerCase();
        const className = element.className.replace(/\s+/g, '_');
        const index = Array.from(element.parentElement?.children || []).indexOf(element);

        return `${tagName}_${className}_${index}`.substring(0, 50);
    }

    tokenizeSearch(query) {
        return query.toLowerCase()
            .trim()
            .split(/\s+/)
            .filter(token => token.length > 0);
    }

    getCurrentFilterState() {
        // This method will be updated by the main app when filters change
        if (window.fashionCatalogue && typeof window.fashionCatalogue.getActiveFilters === 'function') {
            return window.fashionCatalogue.getActiveFilters();
        }
        return {};
    }

    getActiveFiltersCount() {
        // This method will be updated by the main app when filters change
        if (window.fashionCatalogue && typeof window.fashionCatalogue.getActiveFilters === 'function') {
            const activeFilters = window.fashionCatalogue.getActiveFilters();
            return Object.keys(activeFilters).length;
        }
        return 0;
    }

    setupEventListeners() {
        // Global click tracking
        document.addEventListener('click', (e) => {
            this.trackClick(e.target, {
                x: e.clientX,
                y: e.clientY
            });
        });

        // Visibility change tracking
        document.addEventListener('visibilitychange', () => {
            const now = new Date();
            const visibilityState = document.visibilityState;

            if (visibilityState === 'hidden') {
                this.trackEvent('visibility_change', 'page', {
                    metadata: {
                        state: 'hidden',
                        timeVisible: now - this.visibilityChangeTime
                    }
                });
            } else if (visibilityState === 'visible') {
                this.trackEvent('visibility_change', 'page', {
                    metadata: {
                        state: 'visible'
                    }
                });
                this.visibilityChangeTime = now;
            }
        });

        // Beforeunload tracking
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // Online/offline tracking
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.flushQueue(); // Flush queued events when back online
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // Window resize tracking
        window.addEventListener('resize', () => {
            this.trackEvent('resize', 'window', {
                metadata: {
                    newWidth: window.innerWidth,
                    newHeight: window.innerHeight
                }
            });
        });
    }

    startHeartbeat() {
        setInterval(() => {
            this.trackEvent('heartbeat', 'session', {
                metadata: {
                    sessionDuration: new Date() - this.sessionStartTime,
                    queueSize: this.eventQueue.length
                }
            });
        }, this.heartbeatInterval);
    }

    startAutoFlush() {
        setInterval(() => {
            this.tryFlushQueue();
        }, this.flushInterval);
    }

    tryFlushQueue() {
        if (this.eventQueue.length >= this.batchSize || this.eventQueue.length > 0) {
            this.flushQueue();
        }
    }

    async flushQueue() {
        if (this.eventQueue.length === 0 || !this.isOnline) {
            return;
        }

        const eventsToSend = this.eventQueue.splice(0, this.batchSize);

        try {
            // Group events by table
            const eventsByTable = eventsToSend.reduce((acc, event) => {
                if (!acc[event.table]) acc[event.table] = [];
                acc[event.table].push(event.data);
                return acc;
            }, {});

            // Send events to each table
            const promises = Object.entries(eventsByTable).map(([table, events]) => {
                if (events.length === 1) {
                    return this.makeSupabaseRequest(table, 'POST', events[0]);
                } else {
                    return this.makeSupabaseRequest(table, 'POST', events);
                }
            });

            await Promise.all(promises);
            console.log(`Sent ${eventsToSend.length} analytics events`);

        } catch (error) {
            console.error('Failed to send analytics events:', error);
            // Re-add events to the queue for retry
            this.eventQueue.unshift(...eventsToSend);
        }
    }

    trackUserBehaviorPattern(patternType, patternData) {
        if (!this.anonymousUserId) return;

        const behaviorData = {
            anonymous_user_id: this.anonymousUserId,
            pattern_type: patternType,
            pattern_data: patternData,
            first_observed: new Date().toISOString(),
            last_observed: new Date().toISOString()
        };

        this.eventQueue.push({
            table: 'user_behavior_patterns',
            data: behaviorData
        });
    }

    async updateUserPreferences(preferences) {
        if (!this.anonymousUserId) return;

        try {
            await this.makeSupabaseRequest(
                `user_shopping_preferences?anonymous_user_id=eq.${this.anonymousUserId}`,
                'PATCH',
                {
                    ...preferences,
                    updated_at: new Date().toISOString()
                }
            );
        } catch (error) {
            console.error('Failed to update user preferences:', error);
        }
    }

    async endSession() {
        const sessionEndTime = new Date();
        const sessionDuration = Math.floor((sessionEndTime - this.sessionStartTime) / 1000);

        try {
            // Update session with end time and duration
            await this.makeSupabaseRequest(`user_sessions?session_id=eq.${this.sessionId}`, 'PATCH', {
                end_time: sessionEndTime.toISOString(),
                session_duration_seconds: sessionDuration
            });

            // End user journey
            await this.endUserJourney(sessionEndTime, sessionDuration);

            // Flush remaining events
            await this.flushQueue();

        } catch (error) {
            console.error('Failed to end analytics session:', error);
        }
    }

    async endUserJourney(endTime, duration) {
        if (!this.userJourneyId) return;

        try {
            await this.makeSupabaseRequest(`user_journeys?id=eq.${this.userJourneyId}`, 'PATCH', {
                journey_end: endTime.toISOString(),
                total_duration_seconds: duration,
                updated_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to end user journey:', error);
        }
    }

    // Public methods for manual tracking
    trackCustomEvent(eventName, metadata = {}) {
        this.trackEvent('custom', eventName, { metadata });
    }

    trackPageView(page = window.location.pathname) {
        this.trackEvent('page_view', 'navigation', {
            metadata: {
                page,
                referrer: document.referrer,
                timestamp: new Date().toISOString()
            }
        });
    }

    trackError(error, context = '') {
        this.trackEvent('error', 'javascript_error', {
            metadata: {
                error: error.toString(),
                stack: error.stack,
                context,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Initialize analytics when DOM is ready
let analytics = null;

function initializeAnalytics(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
        console.warn('Analytics not initialized: Missing Supabase credentials');
        return null;
    }

    analytics = new UserAnalytics(supabaseUrl, supabaseKey);
    window.analytics = analytics; // Make it globally accessible

    return analytics;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserAnalytics, initializeAnalytics };
}