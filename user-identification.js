/**
 * Anonymous User Identification System
 * Creates persistent, privacy-respecting user identifiers without authentication
 */

class AnonymousUserIdentifier {
    constructor() {
        this.anonymousUserId = null;
        this.deviceFingerprint = null;
        this.storageKeys = {
            userId: 'fashion_app_user_id',
            fingerprint: 'fashion_app_device_fp',
            userData: 'fashion_app_user_data'
        };
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return this.anonymousUserId;

        try {
            // Try to get existing user ID from storage
            this.anonymousUserId = await this.getStoredUserId();

            if (!this.anonymousUserId) {
                // Generate device fingerprint for fallback
                this.deviceFingerprint = await this.generateDeviceFingerprint();

                // Try to find existing user by fingerprint
                this.anonymousUserId = await this.findUserByFingerprint(this.deviceFingerprint);

                if (!this.anonymousUserId) {
                    // Create new anonymous user
                    this.anonymousUserId = this.generateAnonymousUserId();
                    await this.storeUserId(this.anonymousUserId);
                }
            }

            // Ensure device fingerprint is generated
            if (!this.deviceFingerprint) {
                this.deviceFingerprint = await this.generateDeviceFingerprint();
            }

            // Store/update user data
            await this.updateUserData();

            this.isInitialized = true;
            return this.anonymousUserId;

        } catch (error) {
            console.error('Failed to initialize anonymous user ID:', error);
            // Fallback to session-based ID
            this.anonymousUserId = this.generateSessionId();
            return this.anonymousUserId;
        }
    }

    generateAnonymousUserId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const userAgent = navigator.userAgent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '');
        return `user_${timestamp}_${random}_${userAgent}`.substring(0, 50);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async getStoredUserId() {
        // Try multiple storage methods
        const storageChecks = [
            () => localStorage.getItem(this.storageKeys.userId),
            () => sessionStorage.getItem(this.storageKeys.userId),
            () => this.getCookieValue(this.storageKeys.userId),
            () => this.getFromIndexedDB(this.storageKeys.userId)
        ];

        for (const check of storageChecks) {
            try {
                const userId = await check();
                if (userId && userId.startsWith('user_')) {
                    return userId;
                }
            } catch (error) {
                // Continue to next storage method
                continue;
            }
        }

        return null;
    }

    async storeUserId(userId) {
        const userData = {
            anonymousUserId: userId,
            deviceFingerprint: this.deviceFingerprint,
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        };

        // Store in multiple locations for persistence
        const storagePromises = [
            this.storeInLocalStorage(userId, userData),
            this.storeInSessionStorage(userId, userData),
            this.storeInCookies(userId),
            this.storeInIndexedDB(userId, userData)
        ];

        // Don't fail if some storage methods don't work
        await Promise.allSettled(storagePromises);
    }

    async storeInLocalStorage(userId, userData) {
        try {
            localStorage.setItem(this.storageKeys.userId, userId);
            localStorage.setItem(this.storageKeys.userData, JSON.stringify(userData));
        } catch (error) {
            // Storage might be disabled or full
            console.warn('localStorage not available:', error.message);
        }
    }

    async storeInSessionStorage(userId, userData) {
        try {
            sessionStorage.setItem(this.storageKeys.userId, userId);
            sessionStorage.setItem(this.storageKeys.userData, JSON.stringify(userData));
        } catch (error) {
            console.warn('sessionStorage not available:', error.message);
        }
    }

    async storeInCookies(userId) {
        try {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years
            document.cookie = `${this.storageKeys.userId}=${userId}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
        } catch (error) {
            console.warn('Cookies not available:', error.message);
        }
    }

    async storeInIndexedDB(userId, userData) {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('FashionAppUserData', 1);

                request.onerror = () => resolve(false);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('userData')) {
                        db.createObjectStore('userData', { keyPath: 'key' });
                    }
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;

                    // Check if object store exists before creating transaction
                    if (!db.objectStoreNames.contains('userData')) {
                        console.warn('userData store does not exist, skipping IndexedDB storage');
                        resolve(false);
                        return;
                    }

                    const transaction = db.transaction(['userData'], 'readwrite');
                    const store = transaction.objectStore('userData');

                    store.put({
                        key: this.storageKeys.userId,
                        value: userId,
                        userData: userData,
                        timestamp: Date.now()
                    });

                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => resolve(false);
                };
            } catch (error) {
                resolve(false);
            }
        });
    }

    getCookieValue(name) {
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) {
                return parts.pop().split(';').shift();
            }
        } catch (error) {
            // Cookies might be disabled
        }
        return null;
    }

    async getFromIndexedDB(key) {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('FashionAppUserData', 1);

                request.onerror = () => resolve(null);

                request.onsuccess = (event) => {
                    const db = event.target.result;

                    // Check if object store exists
                    if (!db.objectStoreNames.contains('userData')) {
                        resolve(null);
                        return;
                    }

                    const transaction = db.transaction(['userData'], 'readonly');
                    const store = transaction.objectStore('userData');
                    const getRequest = store.get(key);

                    getRequest.onsuccess = () => {
                        const result = getRequest.result;
                        resolve(result ? result.value : null);
                    };

                    getRequest.onerror = () => resolve(null);
                };
            } catch (error) {
                resolve(null);
            }
        });
    }

    async generateDeviceFingerprint() {
        const components = await this.getDeviceComponents();
        const fingerprint = await this.hashComponents(components);

        return fingerprint;
    }

    async getDeviceComponents() {
        const components = {};

        // Basic device info
        components.userAgent = navigator.userAgent;
        components.language = navigator.language;
        components.platform = navigator.platform;
        components.cookieEnabled = navigator.cookieEnabled;
        components.doNotTrack = navigator.doNotTrack;

        // Screen and display info
        components.screenWidth = screen.width;
        components.screenHeight = screen.height;
        components.screenDepth = screen.colorDepth;
        components.pixelRatio = window.devicePixelRatio || 1;

        // Timezone
        components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        components.timezoneOffset = new Date().getTimezoneOffset();

        // Canvas fingerprinting (lightweight version)
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Fashion App Fingerprint', 2, 2);
            components.canvasFingerprint = canvas.toDataURL().substring(0, 100);
        } catch (error) {
            components.canvasFingerprint = 'unavailable';
        }

        // WebGL info (if available)
        try {
            const gl = document.createElement('canvas').getContext('webgl');
            if (gl) {
                components.webglVendor = gl.getParameter(gl.VENDOR);
                components.webglRenderer = gl.getParameter(gl.RENDERER);
            }
        } catch (error) {
            components.webglVendor = 'unavailable';
        }

        // Available fonts (simplified check)
        components.fontCheck = this.checkFonts(['Arial', 'Times', 'Courier', 'Georgia', 'Verdana']);

        // Hardware concurrency
        components.hardwareConcurrency = navigator.hardwareConcurrency || 0;

        // Memory info (if available)
        if (navigator.deviceMemory) {
            components.deviceMemory = navigator.deviceMemory;
        }

        return components;
    }

    checkFonts(fontList) {
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        const baseFonts = ['monospace', 'sans-serif', 'serif'];

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        const defaultWidths = baseFonts.map(font => {
            context.font = `${testSize} ${font}`;
            return context.measureText(testString).width;
        });

        return fontList.filter(font => {
            return baseFonts.some((baseFont, index) => {
                context.font = `${testSize} ${font}, ${baseFont}`;
                return context.measureText(testString).width !== defaultWidths[index];
            });
        });
    }

    async hashComponents(components) {
        const componentString = JSON.stringify(components, Object.keys(components).sort());

        if (crypto && crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(componentString);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return 'fp_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
            } catch (error) {
                // Fallback to simple hash
            }
        }

        // Simple hash fallback
        let hash = 0;
        for (let i = 0; i < componentString.length; i++) {
            const char = componentString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return 'fp_' + Math.abs(hash).toString(36).substring(0, 16);
    }

    async findUserByFingerprint(fingerprint) {
        // This would typically query your backend
        // For now, check local storage for fingerprint matches
        try {
            const storedFingerprint = localStorage.getItem(this.storageKeys.fingerprint);
            if (storedFingerprint === fingerprint) {
                return localStorage.getItem(this.storageKeys.userId);
            }
        } catch (error) {
            // Storage not available
        }
        return null;
    }

    async updateUserData() {
        const userData = {
            anonymousUserId: this.anonymousUserId,
            deviceFingerprint: this.deviceFingerprint,
            lastSeen: new Date().toISOString(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screenResolution: `${screen.width}x${screen.height}`,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        };

        // Store updated data
        try {
            localStorage.setItem(this.storageKeys.userData, JSON.stringify(userData));
            localStorage.setItem(this.storageKeys.fingerprint, this.deviceFingerprint);
        } catch (error) {
            // Storage might not be available
        }

        return userData;
    }

    getAnonymousUserId() {
        return this.anonymousUserId;
    }

    getDeviceFingerprint() {
        return this.deviceFingerprint;
    }

    getUserData() {
        try {
            const userData = localStorage.getItem(this.storageKeys.userData);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            return null;
        }
    }

    isReturningUser() {
        try {
            const userData = this.getUserData();
            if (!userData || !userData.createdAt) return false;

            const created = new Date(userData.createdAt);
            const now = new Date();
            const hoursDiff = (now - created) / (1000 * 60 * 60);

            return hoursDiff > 1; // Consider returning user after 1 hour
        } catch (error) {
            return false;
        }
    }

    getDaysSinceFirstVisit() {
        try {
            const userData = this.getUserData();
            if (!userData || !userData.createdAt) return 0;

            const created = new Date(userData.createdAt);
            const now = new Date();
            const daysDiff = Math.floor((now - created) / (1000 * 60 * 60 * 24));

            return daysDiff;
        } catch (error) {
            return 0;
        }
    }
}

// Initialize global user identifier
let userIdentifier = null;

async function initializeUserIdentification() {
    if (!userIdentifier) {
        userIdentifier = new AnonymousUserIdentifier();
        await userIdentifier.initialize();
    }
    return userIdentifier;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnonymousUserIdentifier, initializeUserIdentification };
} else {
    window.AnonymousUserIdentifier = AnonymousUserIdentifier;
    window.initializeUserIdentification = initializeUserIdentification;
}