// Check which Supabase project has which tables
import dotenv from 'dotenv';
dotenv.config({ path: './search_engine_v2/.env' });

// Import createClient function
import { createClient } from '@supabase/supabase-js';

const frontendSupabase = createClient(
  'https://coyfzbrasybilbxyrpyk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveWZ6YnJhc3liaWxieHlycHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjY3ODUsImV4cCI6MjA3NDMwMjc4NX0.HoS2ezSVx_6Qty-jaotmkFaGe-JqjlPlpQlog9XTJX0'
);

const backendSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('=== FRONTEND SUPABASE (coyfzbrasybilbxyrpyk) ===\n');

  // Check products table
  const { data: frontendProducts, error: frontendProductsError } = await frontendSupabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  if (frontendProductsError) {
    console.log('❌ products table:', frontendProductsError.message);
  } else {
    console.log(`✅ products table: exists`);
  }

  // Check user_favorites table
  const { data: frontendFavorites, error: frontendFavoritesError } = await frontendSupabase
    .from('user_favorites')
    .select('id', { count: 'exact', head: true });

  if (frontendFavoritesError) {
    console.log('❌ user_favorites table:', frontendFavoritesError.message);
  } else {
    console.log(`✅ user_favorites table: exists`);
  }

  console.log('\n=== BACKEND SUPABASE (ytrfzgxzdbkscwxfiwnv) ===\n');

  // Check products table
  const { count: backendProductsCount, error: backendProductsError } = await backendSupabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (backendProductsError) {
    console.log('❌ products table:', backendProductsError.message);
  } else {
    console.log(`✅ products table: exists (${backendProductsCount} products)`);
  }

  // Check user_favorites table
  const { count: backendFavoritesCount, error: backendFavoritesError } = await backendSupabase
    .from('user_favorites')
    .select('*', { count: 'exact', head: true });

  if (backendFavoritesError) {
    console.log('❌ user_favorites table:', backendFavoritesError.message);
  } else {
    console.log(`✅ user_favorites table: exists (${backendFavoritesCount} favorites)`);
  }

  console.log('\n=== RECOMMENDATION ===\n');
  console.log('You should use ONE Supabase project for everything.');
  console.log('Migrate all tables to the backend project (ytrfzgxzdbkscwxfiwnv) and update frontend config.js');

  process.exit(0);
}

checkTables();
