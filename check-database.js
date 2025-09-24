// Database Check Script
// Run this in your browser console to check if data is being saved

async function checkDatabaseRecords() {
    console.log('=== CHECKING DATABASE RECORDS ===');

    if (!window.analytics) {
        console.error('Analytics not initialized');
        return;
    }

    const analytics = window.analytics;
    const userId = analytics.anonymousUserId;

    console.log('Checking for user:', userId);

    try {
        // Check anonymous_users table
        console.log('\n--- ANONYMOUS USERS ---');
        const users = await analytics.makeSupabaseRequest('anonymous_users', 'GET');
        console.log('Total users in database:', users.length);
        const currentUser = users.find(u => u.anonymous_user_id === userId);
        if (currentUser) {
            console.log('Current user found:', currentUser);
        } else {
            console.log('Current user not found in database');
        }

        // Check user_sessions table
        console.log('\n--- USER SESSIONS ---');
        const sessions = await analytics.makeSupabaseRequest(`user_sessions?anonymous_user_id=eq.${userId}`, 'GET');
        console.log('Sessions for current user:', sessions.length);
        sessions.forEach((session, index) => {
            console.log(`Session ${index + 1}:`, {
                session_id: session.session_id,
                start_time: session.start_time,
                is_returning_user: session.is_returning_user
            });
        });

        // Check user_journeys table
        console.log('\n--- USER JOURNEYS ---');
        const journeys = await analytics.makeSupabaseRequest(`user_journeys?anonymous_user_id=eq.${userId}`, 'GET');
        console.log('Journeys for current user:', journeys.length);
        journeys.forEach((journey, index) => {
            console.log(`Journey ${index + 1}:`, {
                id: journey.id,
                journey_start: journey.journey_start,
                total_sessions: journey.total_sessions
            });
        });

        // Check user_interactions table
        console.log('\n--- USER INTERACTIONS ---');
        const interactions = await analytics.makeSupabaseRequest(`user_interactions?anonymous_user_id=eq.${userId}&limit=5`, 'GET');
        console.log('Recent interactions for current user:', interactions.length);
        interactions.forEach((interaction, index) => {
            console.log(`Interaction ${index + 1}:`, {
                event_type: interaction.event_type,
                element_type: interaction.element_type,
                timestamp: interaction.timestamp
            });
        });

    } catch (error) {
        console.error('Error checking database:', error);
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.error('\n❌ DATABASE SCHEMA NOT APPLIED!');
            console.error('You need to run the SQL schema update in your Supabase dashboard:');
            console.error('1. Go to your Supabase dashboard');
            console.error('2. Navigate to SQL Editor');
            console.error('3. Run the contents of "supabase_schema_with_users.sql"');
        }
    }

    console.log('\n=== END DATABASE CHECK ===');
}

// Auto-run check after 3 seconds
setTimeout(checkDatabaseRecords, 3000);

// Make it available globally
window.checkDatabaseRecords = checkDatabaseRecords;

console.log('Database checker loaded. Run checkDatabaseRecords() to manually check database records.');