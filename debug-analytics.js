// Debug Analytics Helper
// Add this to your browser console to diagnose issues

function debugAnalytics() {
    console.log('=== ANALYTICS DEBUG REPORT ===');

    // Check if analytics is initialized
    console.log('Analytics object:', window.analytics);
    console.log('Anonymous User ID:', window.analytics?.anonymousUserId);
    console.log('User Identifier:', window.analytics?.userIdentifier);
    console.log('Session ID:', window.analytics?.sessionId);

    // Check localStorage data
    console.log('\n=== LOCAL STORAGE ===');
    console.log('fashion_app_user_id:', localStorage.getItem('fashion_app_user_id'));
    console.log('fashion_app_user_data:', localStorage.getItem('fashion_app_user_data'));
    console.log('fashion_app_device_fp:', localStorage.getItem('fashion_app_device_fp'));

    // Check if functions are available
    console.log('\n=== FUNCTION AVAILABILITY ===');
    console.log('initializeUserIdentification:', typeof window.initializeUserIdentification);
    console.log('AnonymousUserIdentifier:', typeof window.AnonymousUserIdentifier);
    console.log('CONFIG:', window.CONFIG);

    // Test user identification manually
    if (window.initializeUserIdentification) {
        console.log('\n=== TESTING USER IDENTIFICATION ===');
        window.initializeUserIdentification().then(userIdentifier => {
            console.log('Manual test - User ID:', userIdentifier.getAnonymousUserId());
            console.log('Manual test - Device FP:', userIdentifier.getDeviceFingerprint());
            console.log('Manual test - Is returning:', userIdentifier.isReturningUser());
        }).catch(error => {
            console.error('Manual test failed:', error);
        });
    }

    // Check Supabase connectivity
    if (window.analytics) {
        console.log('\n=== TESTING SUPABASE CONNECTION ===');
        window.analytics.makeSupabaseRequest('user_sessions?limit=1', 'GET')
            .then(result => console.log('Supabase connection OK:', result))
            .catch(error => console.error('Supabase connection failed:', error));
    }

    console.log('=== END DEBUG REPORT ===');
}

// Auto-run debug after a short delay
setTimeout(debugAnalytics, 2000);

// Make it available globally
window.debugAnalytics = debugAnalytics;