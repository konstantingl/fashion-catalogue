import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

// Create Supabase client with service role key for admin operations
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create Supabase client with anon key for public operations
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

/**
 * Check if pgvector extension is enabled
 */
export async function checkPgVectorEnabled() {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_pgvector');
    if (error) {
      console.warn('pgvector extension check failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('pgvector not available:', err.message);
    return false;
  }
}

/**
 * Insert products in batches
 */
export async function insertProductsBatch(products, batchSize = 100) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const { data, error } = await supabaseAdmin
      .from('products')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      results.failed += batch.length;
      results.errors.push({
        batch: Math.floor(i / batchSize) + 1,
        error: error.message
      });
      console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
    } else {
      results.success += batch.length;
      console.log(`Batch ${Math.floor(i / batchSize) + 1} success: ${batch.length} products`);
    }
  }

  return results;
}

/**
 * Get product count
 */
export async function getProductCount() {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to get product count: ${error.message}`);
  }

  return count;
}

/**
 * Vector search using pgvector
 */
export async function vectorSearch(embedding, limit = 200, embeddingType = 'factual', filters = {}) {
  const columnName = embeddingType === 'factual' ? 'factual_embedding' : 'style_embedding';

  // Build filter query
  let query = supabase.rpc('vector_search', {
    query_embedding: embedding,
    match_limit: limit,
    embedding_column: columnName
  });

  // Apply category filter if provided
  if (filters.categories && filters.categories.length > 0) {
    query = query.in('enriched_category', filters.categories);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Attribute-based filtering
 */
export async function attributeFilter(parsedQuery, limit = 300) {
  let query = supabase.from('products').select('*');

  // Category filter
  if (parsedQuery.categories && parsedQuery.categories.length > 0) {
    query = query.in('enriched_category', parsedQuery.categories);
  }

  // Hard attribute filters
  if (parsedQuery.hard_attributes) {
    for (const [attr, value] of Object.entries(parsedQuery.hard_attributes)) {
      // Query JSONB: attributes->'attr'->>'value' = 'VALUE'
      query = query.eq(`attributes->${attr}->>value`, value);
    }
  }

  // Order by confidence and limit
  query = query.order('confidence_score', { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Attribute filter failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Keyword search using PostgreSQL full-text search
 */
export async function keywordSearch(searchTerms, filters = {}, limit = 200) {
  let query = supabase.from('products').select('*');

  // Full-text search across multiple fields
  if (searchTerms) {
    query = query.textSearch('search_vector', searchTerms, {
      type: 'websearch',
      config: 'simple' // Simple config works for both EN and DE
    });
  }

  // Category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in('enriched_category', filters.categories);
  }

  // Attribute filters
  if (filters.attributes) {
    for (const [attr, value] of Object.entries(filters.attributes)) {
      query = query.eq(`attributes->${attr}->>value`, value);
    }
  }

  // Order by confidence and limit
  query = query.order('confidence_score', { ascending: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  return data || [];
}

export default {
  supabase,
  supabaseAdmin,
  checkPgVectorEnabled,
  insertProductsBatch,
  getProductCount,
  vectorSearch,
  attributeFilter,
  keywordSearch
};
