import { parseQuery } from '../pipeline/stage1_query_parser.js';
import { hybridRetrieval } from '../pipeline/stage2_retrieval.js';
import { intelligentFusion } from '../pipeline/stage3_fusion.js';
import { rerankResults } from '../pipeline/stage4_reranking.js';
import { formatProductForResponse } from '../utils/helpers.js';
import config from '../config/config.js';

/**
 * Enhanced search function that returns full debug information
 */
export async function searchWithDebug(userQuery, options = {}) {
  const startTime = Date.now();
  const debug = {
    stages: [],
    timings: {}
  };

  try {
    // Sanitize query
    const sanitizedQuery = userQuery.trim();
    if (!sanitizedQuery) {
      throw new Error('Query cannot be empty');
    }

    const limit = options.limit || 50;

    // Stage 1: Parse query
    const stage1Start = Date.now();
    const parsedQuery = await parseQuery(sanitizedQuery);
    debug.timings.stage1_parsing = Date.now() - stage1Start;
    debug.stages.push({
      stage: 1,
      name: 'Query Parsing',
      duration_ms: debug.timings.stage1_parsing,
      output: {
        query_type: parsedQuery.query_type,
        language: parsedQuery.language,
        categories: parsedQuery.categories,
        hard_attributes: parsedQuery.hard_attributes,
        soft_preferences: parsedQuery.soft_preferences,
        complexity_score: parsedQuery.complexity_score
      }
    });

    // Stage 2: Hybrid retrieval
    const stage2Start = Date.now();
    const {
      vectorResults,
      attributeResults,
      keywordResults,
      duration: retrievalDuration
    } = await hybridRetrieval(parsedQuery, sanitizedQuery);
    debug.timings.stage2_retrieval = Date.now() - stage2Start;

    // Get top 5 from each for debug display
    const formatTopResults = (results, count = 5) => results.slice(0, count).map(r => ({
      id: r.id,
      title: r.title,
      brand: r.brand,
      category: r.enriched_category,
      attributes: r.attributes,
      confidence: r.confidence_score
    }));

    debug.stages.push({
      stage: 2,
      name: 'Hybrid Retrieval',
      duration_ms: debug.timings.stage2_retrieval,
      output: {
        vector: {
          count: vectorResults.length,
          top_results: formatTopResults(vectorResults)
        },
        attribute: {
          count: attributeResults.length,
          top_results: formatTopResults(attributeResults)
        },
        keyword: {
          count: keywordResults.length,
          top_results: formatTopResults(keywordResults)
        }
      }
    });

    // Stage 3: Intelligent fusion
    const stage3Start = Date.now();
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
    debug.timings.stage3_fusion = Date.now() - stage3Start;

    // Get score distribution
    const scores = fusedResults.map(r => r.score);
    const scoreDistribution = {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      median: scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]
    };

    debug.stages.push({
      stage: 3,
      name: 'Intelligent Fusion',
      duration_ms: debug.timings.stage3_fusion,
      output: {
        weights,
        consensus_stats: consensusStats,
        total_unique: fusedResults.length,
        score_distribution: scoreDistribution,
        top_results: fusedResults.slice(0, 10).map(r => ({
          id: r.id,
          title: r.item.title,
          brand: r.item.brand,
          fusion_score: r.score.toFixed(4),
          sources: r.sources,
          ranks: r.ranks
        }))
      }
    });

    // Stage 4: Reranking
    const stage4Start = Date.now();
    const {
      results: rankedResults,
      duration: rerankingDuration
    } = rerankResults(fusedResults, parsedQuery);
    debug.timings.stage4_reranking = Date.now() - stage4Start;

    // Calculate rank changes
    const rankChanges = rankedResults.slice(0, 10).map((item, newRank) => {
      const oldRank = fusedResults.findIndex(f => f.id === item.product.id);
      return {
        product: item.product.title,
        old_rank: oldRank + 1,
        new_rank: newRank + 1,
        change: oldRank - newRank,
        final_score: item.finalScore.toFixed(4),
        fusion_score: item.fusionScore.toFixed(4),
        attribute_score: item.attributeScore.toFixed(4)
      };
    });

    debug.stages.push({
      stage: 4,
      name: 'Reranking',
      duration_ms: debug.timings.stage4_reranking,
      output: {
        reranking_weights: {
          TYPE: parsedQuery.query_type,
          ...config.rerankingWeights[parsedQuery.query_type]
        },
        rank_changes: rankChanges
      }
    });

    // Prepare final results
    const finalResults = rankedResults.slice(0, limit).map(item => ({
      ...formatProductForResponse(item.product, false),
      relevance_score: item.finalScore,
      match_explanation: {
        attribute_matches: Object.entries(parsedQuery.hard_attributes || {})
          .filter(([attr, value]) => item.product.attributes?.[attr]?.value === value)
          .map(([attr, value]) => `${attr}: ${value}`),
        missing_attributes: Object.entries(parsedQuery.hard_attributes || {})
          .filter(([attr, value]) => item.product.attributes?.[attr]?.value !== value)
          .map(([attr, value]) => `${attr}: ${value}`),
        style_match: parsedQuery.query_type === 'TYPE_2'
          ? parsedQuery.soft_preferences?.style_vibe || ''
          : '',
        sources: item.sources,
        fusion_score: item.fusionScore,
        attribute_score: item.attributeScore,
        final_score: item.finalScore
      }
    }));

    const totalDuration = Date.now() - startTime;
    debug.timings.total = totalDuration;

    return {
      results: finalResults,
      debug,
      summary: {
        total_time_ms: totalDuration,
        query_type: parsedQuery.query_type,
        retrieval_counts: {
          vector: vectorResults.length,
          attribute: attributeResults.length,
          keyword: keywordResults.length
        },
        fusion: {
          unique_items: fusedResults.length,
          consensus_all3: consensusStats.all3,
          consensus_any2: consensusStats.any2
        }
      }
    };

  } catch (error) {
    console.error('Search with debug failed:', error);
    throw error;
  }
}

export default searchWithDebug;
