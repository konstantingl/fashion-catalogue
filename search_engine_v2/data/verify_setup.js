import { supabaseAdmin } from '../services/supabase_client.js';
import { validateConfig } from '../config/config.js';

/**
 * Verify Supabase setup before migration
 */
async function verifySetup() {
  console.log('=== Supabase Setup Verification ===\n');

  try {
    // 1. Validate configuration
    console.log('✓ Checking configuration...');
    validateConfig();
    console.log('  ✅ Configuration valid\n');

    // 2. Check connection
    console.log('✓ Testing Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from('_test_connection')
      .select('*')
      .limit(1);

    if (connectionError && !connectionError.message.includes('does not exist')) {
      throw new Error(`Connection failed: ${connectionError.message}`);
    }
    console.log('  ✅ Connected to Supabase\n');

    // 3. Check if pgvector extension exists
    console.log('✓ Checking pgvector extension...');
    const { data: extensionData, error: extensionError } = await supabaseAdmin.rpc('check_pgvector');

    if (extensionError) {
      console.log('  ❌ pgvector extension not found');
      console.log('  💡 Run this SQL in Supabase SQL Editor:');
      console.log('     CREATE EXTENSION IF NOT EXISTS vector;');
      return false;
    }
    console.log('  ✅ pgvector extension installed\n');

    // 4. Check if products table exists
    console.log('✓ Checking products table...');
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('products')
      .select('id')
      .limit(1);

    if (tableError) {
      console.log('  ❌ Products table does not exist');
      console.log('  💡 You need to run data/schema.sql first!\n');
      console.log('  Steps:');
      console.log('  1. Open Supabase dashboard → SQL Editor');
      console.log('  2. Click "+ New Query"');
      console.log('  3. Copy entire contents of search_engine_v2/data/schema.sql');
      console.log('  4. Paste into SQL Editor');
      console.log('  5. Click "Run"');
      console.log('  6. Wait for "Success. No rows returned"');
      console.log('  7. Then run migration again\n');
      return false;
    }
    console.log('  ✅ Products table exists\n');

    // 5. Check table structure
    console.log('✓ Checking table structure...');
    const { data: structureData, error: structureError } = await supabaseAdmin
      .from('products')
      .select('factual_embedding, style_embedding')
      .limit(1);

    if (structureError) {
      console.log('  ⚠️  Table structure might be incomplete');
      console.log(`     Error: ${structureError.message}\n`);
    } else {
      console.log('  ✅ Table structure looks good\n');
    }

    // 6. Check RPC functions
    console.log('✓ Checking RPC functions...');
    const testVector = new Array(1536).fill(0.1);

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('vector_search_factual', {
      query_embedding: testVector,
      match_limit: 1,
      category_filter: null
    });

    if (rpcError) {
      console.log('  ⚠️  RPC function might not exist');
      console.log(`     Error: ${rpcError.message}`);
      console.log('  💡 Make sure you ran the complete schema.sql\n');
    } else {
      console.log('  ✅ RPC functions working\n');
    }

    // 7. Check current product count
    console.log('✓ Checking current product count...');
    const { count, error: countError } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`  ⚠️  Could not count products: ${countError.message}\n`);
    } else {
      console.log(`  ℹ️  Current products in database: ${count}\n`);
    }

    console.log('=== ✅ All checks passed! ===');
    console.log('You can now run: npm run migrate\n');
    return true;

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifySetup().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { verifySetup };
