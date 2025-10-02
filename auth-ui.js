class AuthUI {
    constructor() {
        this.modal = null;
        this.currentMode = 'login'; // 'login', 'signup', 'forgot-password'
        this.isLoading = false;
        this.authManager = null;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();

        // Wait for auth manager to be available
        this.waitForAuthManager();
    }

    waitForAuthManager() {
        const checkAuth = () => {
            if (window.authManager) {
                this.authManager = window.authManager;
                this.setupAuthStateListener();
            } else {
                setTimeout(checkAuth, 100);
            }
        };
        checkAuth();
    }

    setupAuthStateListener() {
        if (this.authManager) {
            this.authManager.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    this.hideModal();
                    this.showNotification('Successfully logged in!', 'success');
                } else if (event === 'SIGNED_OUT') {
                    this.showNotification('Successfully logged out!', 'success');
                }
                this.updateUIState();
            });

            // Initial UI state update
            this.updateUIState();
        }
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'auth-modal-overlay';
        this.modal.innerHTML = `
            <div class="auth-modal">
                <div class="auth-modal-header">
                    <h2 class="auth-modal-title">Welcome to BrandNest</h2>
                    <button class="auth-modal-close" aria-label="Close modal">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>

                <div class="auth-modal-body">
                    <!-- Login Form -->
                    <form class="auth-form" id="login-form">
                        <div class="auth-form-content">
                            <h3>Sign In</h3>
                            <p class="auth-subtitle">Access your saved favorites and personalized experience</p>

                            <div class="auth-input-group">
                                <label for="login-email">Email</label>
                                <input type="email" id="login-email" name="email" required
                                       placeholder="Enter your email">
                            </div>

                            <div class="auth-input-group">
                                <label for="login-password">Password</label>
                                <input type="password" id="login-password" name="password" required
                                       placeholder="Enter your password">
                            </div>

                            <button type="submit" class="auth-submit-btn" disabled>
                                <span class="auth-btn-text">Sign In</span>
                                <span class="auth-btn-loading">Signing in...</span>
                            </button>

                            <div class="auth-error" id="login-error"></div>

                            <div class="auth-links">
                                <button type="button" class="auth-link" data-mode="forgot-password">
                                    Forgot password?
                                </button>
                                <button type="button" class="auth-link" data-mode="signup">
                                    Don't have an account? Sign up
                                </button>
                            </div>
                        </div>
                    </form>

                    <!-- Signup Form -->
                    <form class="auth-form" id="signup-form" style="display: none;">
                        <div class="auth-form-content">
                            <h3>Create Account</h3>
                            <p class="auth-subtitle">Join BrandNest to save your favorite items</p>

                            <div class="auth-input-group">
                                <label for="signup-name">Name</label>
                                <input type="text" id="signup-name" name="name"
                                       placeholder="Enter your full name">
                            </div>

                            <div class="auth-input-group">
                                <label for="signup-email">Email</label>
                                <input type="email" id="signup-email" name="email" required
                                       placeholder="Enter your email">
                            </div>

                            <div class="auth-input-group">
                                <label for="signup-password">Password</label>
                                <input type="password" id="signup-password" name="password" required
                                       placeholder="Create a password (min. 6 characters)">
                                <div class="password-requirements">
                                    At least 6 characters required
                                </div>
                            </div>

                            <button type="submit" class="auth-submit-btn" disabled>
                                <span class="auth-btn-text">Create Account</span>
                                <span class="auth-btn-loading">Creating account...</span>
                            </button>

                            <div class="auth-error" id="signup-error"></div>

                            <div class="auth-links">
                                <button type="button" class="auth-link" data-mode="login">
                                    Already have an account? Sign in
                                </button>
                            </div>
                        </div>
                    </form>

                    <!-- Forgot Password Form -->
                    <form class="auth-form" id="forgot-password-form" style="display: none;">
                        <div class="auth-form-content">
                            <h3>Reset Password</h3>
                            <p class="auth-subtitle">Enter your email to receive a password reset link</p>

                            <div class="auth-input-group">
                                <label for="forgot-email">Email</label>
                                <input type="email" id="forgot-email" name="email" required
                                       placeholder="Enter your email">
                            </div>

                            <button type="submit" class="auth-submit-btn" disabled>
                                <span class="auth-btn-text">Send Reset Link</span>
                                <span class="auth-btn-loading">Sending...</span>
                            </button>

                            <div class="auth-error" id="forgot-error"></div>
                            <div class="auth-success" id="forgot-success"></div>

                            <div class="auth-links">
                                <button type="button" class="auth-link" data-mode="login">
                                    Back to sign in
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
    }

    setupEventListeners() {
        // Close modal
        this.modal.querySelector('.auth-modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        // Close modal when clicking overlay
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });

        // Mode switching
        this.modal.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchMode(btn.dataset.mode);
            });
        });

        // Form submissions
        this.setupFormSubmissions();

        // Input validation
        this.setupInputValidation();

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.hideModal();
            }
        });
    }

    setupFormSubmissions() {
        // Login form
        this.modal.querySelector('#login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin(e.target);
        });

        // Signup form
        this.modal.querySelector('#signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSignup(e.target);
        });

        // Forgot password form
        this.modal.querySelector('#forgot-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleForgotPassword(e.target);
        });
    }

    setupInputValidation() {
        // Real-time validation for all forms
        this.modal.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                this.validateForm(input.closest('form'));
            });
        });
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required]');
        const submitBtn = form.querySelector('.auth-submit-btn');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
            } else if (input.type === 'email' && !this.isValidEmail(input.value)) {
                isValid = false;
            } else if (input.type === 'password' && input.value.length < 6) {
                isValid = false;
            }
        });

        submitBtn.disabled = !isValid || this.isLoading;
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async handleLogin(form) {
        if (this.isLoading || !this.authManager) return;

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');

        this.setLoading(true);
        this.clearError('login-error');

        try {
            await this.authManager.signIn(email, password);
            // Modal will be closed by auth state change listener
        } catch (error) {
            this.showError('login-error', error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleSignup(form) {
        if (this.isLoading || !this.authManager) return;

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const name = formData.get('name');

        this.setLoading(true);
        this.clearError('signup-error');

        try {
            await this.authManager.signUp(email, password, { name });
            this.showNotification('Account created! Please check your email to confirm your account.', 'success');
            this.switchMode('login');
        } catch (error) {
            this.showError('signup-error', error.message);
        } finally {
            this.setLoading(false);
        }
    }

    async handleForgotPassword(form) {
        if (this.isLoading || !this.authManager) return;

        const formData = new FormData(form);
        const email = formData.get('email');

        this.setLoading(true);
        this.clearError('forgot-error');
        this.clearSuccess('forgot-success');

        try {
            await this.authManager.resetPassword(email);
            this.showSuccess('forgot-success', 'Password reset link sent to your email!');
        } catch (error) {
            this.showError('forgot-error', error.message);
        } finally {
            this.setLoading(false);
        }
    }

    showModal(mode = 'login') {
        this.switchMode(mode);
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(() => {
            const firstInput = this.modal.querySelector('.auth-form:not([style*="display: none"]) input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    hideModal() {
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
        this.clearAllErrors();
        this.clearAllForms();
    }

    switchMode(mode) {
        this.currentMode = mode;

        // Hide all forms
        this.modal.querySelectorAll('.auth-form').forEach(form => {
            form.style.display = 'none';
        });

        // Show current form
        const currentForm = this.modal.querySelector(`#${mode}-form`);
        if (currentForm) {
            currentForm.style.display = 'block';
        }

        // Update title
        const titles = {
            'login': 'Welcome Back',
            'signup': 'Join BrandNest',
            'forgot-password': 'Reset Password'
        };

        this.modal.querySelector('.auth-modal-title').textContent = titles[mode] || 'BrandNest';

        this.clearAllErrors();
    }

    setLoading(loading) {
        this.isLoading = loading;

        this.modal.querySelectorAll('.auth-submit-btn').forEach(btn => {
            btn.disabled = loading;
            btn.classList.toggle('loading', loading);
        });
    }

    showError(elementId, message) {
        const errorEl = this.modal.querySelector(`#${elementId}`);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    clearError(elementId) {
        const errorEl = this.modal.querySelector(`#${elementId}`);
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    showSuccess(elementId, message) {
        const successEl = this.modal.querySelector(`#${elementId}`);
        if (successEl) {
            successEl.textContent = message;
            successEl.style.display = 'block';
        }
    }

    clearSuccess(elementId) {
        const successEl = this.modal.querySelector(`#${elementId}`);
        if (successEl) {
            successEl.textContent = '';
            successEl.style.display = 'none';
        }
    }

    clearAllErrors() {
        this.modal.querySelectorAll('.auth-error').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });

        this.modal.querySelectorAll('.auth-success').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

    clearAllForms() {
        this.modal.querySelectorAll('form').forEach(form => {
            form.reset();
            this.validateForm(form);
        });
    }

    updateUIState() {
        // Update header UI based on auth state
        this.updateHeaderUI();
    }

    showFavoritesModal() {
        if (window.favoritesManager) {
            window.favoritesManager.showFavoritesPage();
        } else {
            console.warn('Favorites manager not available');
        }
    }

    updateFavoritesCount() {
        // Update favorites count in header
        const favoritesCountEl = document.querySelector('.favorites-count');
        if (favoritesCountEl && window.favoritesManager) {
            favoritesCountEl.textContent = window.favoritesManager.getFavoriteCount();
        }
    }

    updateHeaderUI() {
        const existingUserMenu = document.querySelector('.user-menu');
        const existingAuthButton = document.querySelector('.auth-button');

        // Remove existing UI
        if (existingUserMenu) existingUserMenu.remove();
        if (existingAuthButton) existingAuthButton.remove();

        const headerContainer = document.querySelector('header .container');
        if (!headerContainer) return;

        if (this.authManager && this.authManager.isAuthenticated()) {
            // Show user menu
            const user = this.authManager.getCurrentUser();
            const favoritesCount = window.favoritesManager ? window.favoritesManager.getFavoriteCount() : 0;

            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <div class="user-info">
                    <button class="favorites-btn" title="View Favorites">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                                  fill="currentColor" stroke="currentColor" stroke-width="1"/>
                        </svg>
                        <span class="favorites-count">${favoritesCount}</span>
                    </button>
                    <span class="user-name">${user.user_metadata?.name || user.email}</span>
                    <button class="logout-btn">Sign Out</button>
                </div>
            `;

            // Add event listeners
            userMenu.querySelector('.logout-btn').addEventListener('click', async () => {
                try {
                    await this.authManager.signOut();
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });

            userMenu.querySelector('.favorites-btn').addEventListener('click', (e) => {
                e.preventDefault();
                this.showFavoritesModal();
            });

            headerContainer.appendChild(userMenu);
        } else {
            // Show login button
            const authButton = document.createElement('button');
            authButton.className = 'auth-button';
            authButton.textContent = 'Sign In';
            authButton.addEventListener('click', () => {
                this.showModal('login');
            });

            headerContainer.appendChild(authButton);
        }
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.auth-notification');
        existingNotifications.forEach(notif => notif.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `auth-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Show notification with slight delay for smooth animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto hide after 3 seconds
        const hideTimer = setTimeout(() => {
            notification.classList.remove('show');
            // Remove from DOM after transition completes
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300); // Match CSS transition duration
        }, 3000);

        // Allow manual dismissal by clicking
        notification.addEventListener('click', () => {
            clearTimeout(hideTimer);
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
}

// Initialize Auth UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authUI = new AuthUI();
});