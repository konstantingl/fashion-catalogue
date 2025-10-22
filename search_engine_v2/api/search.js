import { parseQuery } from '../pipeline/stage1_query_parser.js';
import { hybridRetrieval } from '../pipeline/stage2_retrieval.js';
import { intelligentFusion } from '../pipeline/stage3_fusion.js';
import { rerankResults } from '../pipeline/stage4_reranking.js';
import { validateSearchRequest } from '../utils/validators.js';
import { generateInterpretation, formatProductForResponse } from '../utils/helpers.js';
import { validateConfig } from '../config/config.js';

/**
 * Main search function - orchestrates all 4 stages
 */
export async function search(userQuery, options = {}) {
  const startTime = Date.now();

  console.log('\n=== AI-Powered Search Pipeline ===');
  console.log(`Query: "${userQuery}"`);

  try {
    // Validate query
    const sanitizedQuery = userQuery.trim();
    if (!sanitizedQuery) {
      throw new Error('Query cannot be empty');
    }

    const limit = options.limit || 50;

    // Stage 1: Parse query with LLM
    const parsedQuery = await parseQuery(sanitizedQuery);

    // Stage 2: Hybrid retrieval (parallel execution)
    const {
      vectorResults,
      attributeResults,
      keywordResults,
      duration: retrievalDuration
    } = await hybridRetrieval(parsedQuery, sanitizedQuery);

    // Stage 3: Intelligent fusion
    const {
      fusedResults,
      weights,
      consensusStats,
      duration: fusionDuration
    } = intelligentFusion(
      vectorResults,
      attributeResults,
      keywordResults,
      parsedQuery
    );

    // Stage 4: Reranking
    const {
      results: rankedResults,
      duration: rerankingDuration
    } = rerankResults(fusedResults, parsedQuery);

    // Prepare final response
    const finalResults = rankedResults.slice(0, limit).map(item => ({
      ...formatProductForResponse(item.product, false),
      relevance_score: item.finalScore,
      match_explanation: {
        attribute_matches: Object.entries(parsedQuery.hard_attributes || {})
          .filter(([attr, value]) => item.product.attributes?.[attr]?.value === value)
          .map(([attr, value]) => `${attr}: ${value}`),
        style_match: parsedQuery.query_type === 'TYPE_2'
          ? parsedQuery.soft_preferences?.style_vibe || ''
          : '',
        sources: item.sources,
        fusion_score: item.fusionScore,
        attribute_score: item.attributeScore
      }
    }));

    const totalDuration = Date.now() - startTime;

    console.log(`\n=== Search Complete in ${totalDuration}ms ===`);

    return {
      results: finalResults,
      query_understanding: {
        query_type: parsedQuery.query_type,
        language: parsedQuery.language,
        interpreted_as: generateInterpretation(parsedQuery),
        categories: parsedQuery.categories,
        hard_attributes: parsedQuery.hard_attributes,
        complexity_score: parsedQuery.complexity_score
      },
      retrieval_stats: {
        vector_results: vectorResults.length,
        attribute_results: attributeResults.length,
        keyword_results: keywordResults.length,
        fused_unique: fusedResults.length,
        consensus_all3: consensusStats.all3,
        consensus_any2: consensusStats.any2
      },
      fusion_weights: weights,
      total_searched: vectorResults.length + attributeResults.length + keywordResults.length,
      search_time_ms: totalDuration,
      stage_timings: {
        retrieval_ms: retrievalDuration,
        fusion_ms: fusionDuration,
        reranking_ms: rerankingDuration
      }
    };

  } catch (error) {
    console.error('\n❌ Search failed:', error.message);
    throw error;
  }
}

/**
 * API handler for serverless deployment (Vercel Edge Function)
 */
export async function handler(request) {
  try {
    // Validate configuration on first request
    validateConfig();

    // Parse request
    const body = await request.json();
    const { query, limit } = validateSearchRequest(body);

    // Execute search
    const result = await search(query, { limit });

    // Return response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('API Error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        query_understanding: null,
        results: []
      }),
      {
        status: error.message.includes('Query') ? 400 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Export for Vercel - use Node.js runtime (not Edge) for fs/path support
export const config = {
  runtime: 'nodejs20.x',
};

export default handler;
