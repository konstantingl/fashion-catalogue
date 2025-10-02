class AuthManager {
    constructor(supabaseUrl, supabaseKey) {
        // Import Supabase client from CDN
        this.loadSupabaseClient();
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.supabase = null;
        this.currentUser = null;
        this.authListeners = [];
        this.isInitialized = false;
    }

    async loadSupabaseClient() {
        // Load Supabase client from CDN if not already loaded
        if (typeof window.supabase === 'undefined') {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.onload = () => {
                    console.log('Supabase client loaded');
                    resolve();
                };
                script.onerror = () => {
                    console.error('Failed to load Supabase client');
                    reject(new Error('Failed to load Supabase client'));
                };
                document.head.appendChild(script);
            });
        }
    }

    async init() {
        if (this.isInitialized) return;

        try {
            await this.loadSupabaseClient();

            // Initialize Supabase client
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);

            // Get current session
            const { data: { session } } = await this.supabase.auth.getSession();
            this.currentUser = session?.user || null;

            // Listen for auth state changes
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event, session?.user?.email);
                this.currentUser = session?.user || null;
                this.notifyAuthListeners(event, session);
            });

            this.isInitialized = true;
            console.log('AuthManager initialized successfully');

            if (this.currentUser) {
                console.log('User already logged in:', this.currentUser.email);
            }
        } catch (error) {
            console.error('Failed to initialize AuthManager:', error);
            throw error;
        }
    }

    // Authentication methods
    async signUp(email, password, userData = {}) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: userData.name || '',
                        ...userData
                    }
                }
            });

            if (error) throw error;

            console.log('User signed up successfully:', data.user?.email);
            return { user: data.user, session: data.session };
        } catch (error) {
            console.error('Sign up error:', error);
            throw this.formatAuthError(error);
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            console.log('User signed in successfully:', data.user?.email);
            return { user: data.user, session: data.session };
        } catch (error) {
            console.error('Sign in error:', error);
            throw this.formatAuthError(error);
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();

            if (error) throw error;

            console.log('User signed out successfully');
            this.currentUser = null;
            return true;
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) throw error;

            console.log('Password reset email sent to:', email);
            return true;
        } catch (error) {
            console.error('Password reset error:', error);
            throw this.formatAuthError(error);
        }
    }

    async updatePassword(newPassword) {
        try {
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            console.log('Password updated successfully');
            return true;
        } catch (error) {
            console.error('Password update error:', error);
            throw this.formatAuthError(error);
        }
    }

    async updateProfile(updates) {
        try {
            const { error } = await this.supabase.auth.updateUser({
                data: updates
            });

            if (error) throw error;

            console.log('Profile updated successfully');
            return true;
        } catch (error) {
            console.error('Profile update error:', error);
            throw this.formatAuthError(error);
        }
    }

    // User state methods
    isAuthenticated() {
        return !!this.currentUser;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserId() {
        return this.currentUser?.id || null;
    }

    getUserEmail() {
        return this.currentUser?.email || null;
    }

    getUserMetadata() {
        return this.currentUser?.user_metadata || {};
    }

    // Auth state listeners
    onAuthStateChange(callback) {
        this.authListeners.push(callback);

        // Return unsubscribe function
        return () => {
            this.authListeners = this.authListeners.filter(listener => listener !== callback);
        };
    }

    notifyAuthListeners(event, session) {
        this.authListeners.forEach(callback => {
            try {
                callback(event, session);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
    }

    // Helper methods
    formatAuthError(error) {
        const errorMessages = {
            'Invalid login credentials': 'Invalid email or password',
            'Email not confirmed': 'Please check your email and click the confirmation link',
            'User already registered': 'An account with this email already exists',
            'Password should be at least 6 characters': 'Password must be at least 6 characters long',
            'Invalid email': 'Please enter a valid email address',
            'Signup is disabled': 'Account registration is currently disabled'
        };

        const message = errorMessages[error.message] || error.message || 'An error occurred';

        return {
            message,
            originalError: error
        };
    }

    // Database helper for favorites
    getSupabaseClient() {
        return this.supabase;
    }

    // Check if user needs to be prompted for login
    requireAuth(action = 'perform this action') {
        if (!this.isAuthenticated()) {
            const shouldLogin = confirm(`Please log in to ${action}. Would you like to log in now?`);
            if (shouldLogin) {
                this.showAuthModal('login');
            }
            return false;
        }
        return true;
    }

    // Show authentication modal (to be implemented in auth-ui.js)
    showAuthModal(mode = 'login') {
        if (window.authUI) {
            window.authUI.showModal(mode);
        } else {
            console.warn('Auth UI not available');
        }
    }
}

// Global auth manager instance
let authManager = null;

// Initialize authentication system
async function initializeAuth() {
    if (!window.CONFIG || !window.CONFIG.AUTH_ENABLED) {
        console.log('Authentication disabled in config');
        return null;
    }

    try {
        authManager = new AuthManager(
            window.CONFIG.SUPABASE_URL,
            window.CONFIG.SUPABASE_ANON_KEY
        );

        await authManager.init();

        // Make auth manager globally available
        window.authManager = authManager;

        console.log('Authentication system initialized');
        return authManager;
    } catch (error) {
        console.error('Failed to initialize authentication:', error);
        return null;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, initializeAuth };
}