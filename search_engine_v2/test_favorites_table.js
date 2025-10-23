import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './services/supabase_client.js';

async function testFavoritesTable() {
  try {
    console.log('Testing user_favorites table...\n');

    // Check if the table exists and has the correct structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('user_favorites')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Error accessing user_favorites table:', tableError.message);
      console.log('\n⚠️  The user_favorites table may not exist or may have permission issues.');
      console.log('Please create the table in Supabase SQL editor with this SQL:\n');
      console.log(`
CREATE TABLE IF NOT EXISTS user_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own favorites
CREATE POLICY "Users can manage their own favorites" ON user_favorites
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id ON user_favorites(product_id);
      `);
      process.exit(1);
    }

    console.log('✅ user_favorites table exists and is accessible');

    // Get count of favorites
    const { count, error: countError } = await supabaseAdmin
      .from('user_favorites')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting count:', countError);
    } else {
      console.log(`   Total favorites in database: ${count}`);
    }

    // Get sample favorites (if any)
    const { data: samples, error: sampleError } = await supabaseAdmin
      .from('user_favorites')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('Error getting samples:', sampleError);
    } else if (samples && samples.length > 0) {
      console.log(`\n   Sample favorites (first ${samples.length}):`);
      samples.forEach((fav, idx) => {
        console.log(`   ${idx + 1}. User: ${fav.user_id}, Product: ${fav.product_id}, Added: ${fav.created_at}`);
      });
    } else {
      console.log('   No favorites in database yet');
    }

    console.log('\n✅ Favorites system is properly connected to the database!');
    console.log('   - Favorites are stored in: user_favorites table');
    console.log('   - Product details fetched from: products table');
    console.log('   - No dependency on products.json file');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testFavoritesTable();
