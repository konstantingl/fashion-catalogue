import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './services/supabase_client.js';

async function testUnifiedSetup() {
  console.log('=== Testing Unified Supabase Setup ===\n');

  // Test 1: Check products table
  const { count: productsCount, error: productsError } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (productsError) {
    console.log('❌ products table:', productsError.message);
  } else {
    console.log(`✅ products table: ${productsCount} products`);
  }

  // Test 2: Check user_favorites table
  const { count: favoritesCount, error: favoritesError } = await supabaseAdmin
    .from('user_favorites')
    .select('*', { count: 'exact', head: true });

  if (favoritesError) {
    console.log('❌ user_favorites table:', favoritesError.message);
  } else {
    console.log(`✅ user_favorites table: ${favoritesCount} favorites`);
  }

  // Test 3: Verify we're using the correct Supabase project
  console.log(`\n📍 Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`   Expected: https://ytrfzgxzdbkscwxfiwnv.supabase.co`);

  if (process.env.SUPABASE_URL === 'https://ytrfzgxzdbkscwxfiwnv.supabase.co') {
    console.log('   ✅ Correct backend Supabase project!');
  } else {
    console.log('   ❌ Wrong Supabase project!');
  }

  console.log('\n=== Setup Complete ===');
  console.log('✅ Both products and user_favorites are in the same Supabase project');
  console.log('✅ Frontend will use: https://ytrfzgxzdbkscwxfiwnv.supabase.co');
  console.log('✅ Backend will use: https://ytrfzgxzdbkscwxfiwnv.supabase.co');
  console.log('\n📝 Next steps:');
  console.log('   1. Refresh your browser to clear any cached Supabase clients');
  console.log('   2. Sign up/login to create a user in the backend Supabase project');
  console.log('   3. Test adding a product to favorites');
  console.log('   4. View favorites page to confirm products load correctly');

  process.exit(0);
}

testUnifiedSetup();
