import { generateQueryEmbedding } from '../services/openai_client.js';
import { supabaseAdmin } from '../services/supabase_client.js';
import config from '../config/config.js';
import { expandColorFamily } from '../config/taxonomy.js';

/**
 * Stage 2: Hybrid Retrieval
 *
 * Execute three parallel searches:
 * - Vector semantic search (Supabase pgvector)
 * - Attribute-based filtering (Supabase)
 * - Keyword search (PostgreSQL full-text)
 */

/**
 * 2A: Vector Semantic Search using pgvector
 */
export async function vectorSearch(parsedQuery, originalQuery) {
  console.log('[Stage 2A] Running vector search...');

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(parsedQuery, originalQuery);

    // Determine which index/function to use based on query type
    const functionName = parsedQuery.query_type === 'TYPE_1'
      ? 'vector_search_factual'
      : 'vector_search_style';

    // Prepare category filter
    const categoryFilter = parsedQuery.categories && parsedQuery.categories.length > 0
      ? parsedQuery.categories
      : null;

    // Call Supabase RPC function
    const { data, error } = await supabaseAdmin.rpc(functionName, {
      query_embedding: queryEmbedding,
      match_limit: config.retrieval.vectorTopK,
      category_filter: categoryFilter
    });

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    console.log(`[Stage 2A] Vector search returned ${data?.length || 0} results`);

    return data || [];

  } catch (error) {
    console.error('[Stage 2A] Vector search error:', error.message);
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

/**
 * 2B: Attribute-Based Filtering
 */
export async function attributeFilter(parsedQuery) {
  console.log('[Stage 2B] Running attribute filter...');

  try {
    // If no hard attributes and no categories, return empty
    const hasFilters =
      (parsedQuery.hard_attributes && Object.keys(parsedQuery.hard_attributes).length > 0) ||
      (parsedQuery.categories && parsedQuery.categories.length > 0);

    if (!hasFilters) {
      console.log('[Stage 2B] No filters to apply, skipping');
      return [];
    }

    let query = supabaseAdmin.from('products').select('*');

    // Category filter
    if (parsedQuery.categories && parsedQuery.categories.length > 0) {
      query = query.in('enriched_category', parsedQuery.categories);
    }

    // Hard attribute filters
    if (parsedQuery.hard_attributes) {
      for (const [attr, value] of Object.entries(parsedQuery.hard_attributes)) {
        // Special handling for color - allow color family matches
        if (attr === 'color') {
          // Expand color to include family members (e.g., BLACK includes only BLACK)
          const colorFamily = expandColorFamily(value);

          // Use OR condition for color families using JSONB operators
          // Build the filter: attributes->color->value IN (colorFamily)
          const colorFilters = colorFamily.map(c =>
            `attributes->${attr}->>value.eq.${c}`
          ).join(',');

          // For now, just match the exact color - we'll need RPC function for OR queries
          query = query.eq(`attributes->${attr}->>value`, value);
        } else {
          query = query.eq(`attributes->${attr}->>value`, value);
        }
      }
    }

    // Order by confidence and limit
    query = query
      .order('confidence_score', { ascending: false })
      .limit(config.retrieval.attributeTopK);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Attribute filter failed: ${error.message}`);
    }

    console.log(`[Stage 2B] Attribute filter returned ${data?.length || 0} results`);

    return data || [];

  } catch (error) {
    console.error('[Stage 2B] Attribute filter error:', error.message);
    return [];
  }
}

/**
 * 2C: Keyword Search using PostgreSQL full-text search
 */
export async function keywordSearch(parsedQuery, originalQuery) {
  console.log('[Stage 2C] Running keyword search...');

  try {
    // Build search terms from original query and semantic keywords
    const searchTerms = originalQuery || [
      ...(parsedQuery.soft_preferences?.semantic_keywords || []),
      ...Object.values(parsedQuery.hard_attributes || {})
    ].join(' ');

    if (!searchTerms.trim()) {
      console.log('[Stage 2C] No search terms, skipping');
      return [];
    }

    let query = supabaseAdmin.from('products').select('*');

    // Full-text search using the search_vector column
    query = query.textSearch('search_vector', searchTerms, {
      type: 'websearch',
      config: 'simple' // Simple config works for both EN and DE
    });

    // Category filter if specified
    if (parsedQuery.categories && parsedQuery.categories.length > 0) {
      query = query.in('enriched_category', parsedQuery.categories);
    }

    // Order by confidence and limit
    query = query
      .order('confidence_score', { ascending: false })
      .limit(config.retrieval.keywordTopK);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Keyword search failed: ${error.message}`);
    }

    console.log(`[Stage 2C] Keyword search returned ${data?.length || 0} results`);

    return data || [];

  } catch (error) {
    console.error('[Stage 2C] Keyword search error:', error.message);
    return [];
  }
}

/**
 * Run all three retrieval methods in parallel
 */
export async function hybridRetrieval(parsedQuery, originalQuery) {
  console.log('[Stage 2] Starting hybrid retrieval...');

  const startTime = Date.now();

  try {
    // Execute all three searches in parallel
    const [vectorResults, attributeResults, keywordResults] = await Promise.all([
      vectorSearch(parsedQuery, originalQuery),
      attributeFilter(parsedQuery),
      keywordSearch(parsedQuery, originalQuery)
    ]);

    const duration = Date.now() - startTime;

    console.log(`[Stage 2] Hybrid retrieval complete in ${duration}ms`);
    console.log(`[Stage 2] Results: Vector=${vectorResults.length}, Attribute=${attributeResults.length}, Keyword=${keywordResults.length}`);

    return {
      vectorResults,
      attributeResults,
      keywordResults,
      duration
    };

  } catch (error) {
    console.error('[Stage 2] Hybrid retrieval error:', error.message);
    throw error;
  }
}

export default {
  vectorSearch,
  attributeFilter,
  keywordSearch,
  hybridRetrieval
};
