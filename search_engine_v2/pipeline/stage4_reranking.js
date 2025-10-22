import config from '../config/config.js';
import { calculateAttributeMatchScore } from '../utils/helpers.js';

/**
 * Stage 4: Attribute-Based Reranking
 *
 * Apply final ranking using:
 * - Fusion score (from Stage 3)
 * - Attribute match score (precision for TYPE_1)
 * - Confidence penalty (data quality)
 */

/**
 * Calculate confidence penalty
 * Higher confidence = lower penalty
 */
function calculateConfidencePenalty(product) {
  const confidence = product.confidence_score || 0;
  // Penalty ranges from 0 (low confidence) to 0.1 (high confidence)
  return confidence * 0.1;
}

/**
 * Calculate final score for a product
 */
function calculateFinalScore(fusedItem, parsedQuery) {
  const product = fusedItem.item;

  // Fusion score (already calculated in Stage 3)
  const fusionScore = fusedItem.score;

  // Attribute match score
  const attributeScore = calculateAttributeMatchScore(
    product.attributes,
    parsedQuery.hard_attributes || {}
  );

  // Confidence penalty
  const confidencePenalty = calculateConfidencePenalty(product);

  // Get query-type-aware reranking weights
  const weights = config.rerankingWeights[parsedQuery.query_type];

  // Calculate weighted final score
  const finalScore =
    (weights.fusionScore * fusionScore) +
    (weights.attributeScore * attributeScore) +
    (weights.confidencePenalty * confidencePenalty);

  return {
    finalScore,
    fusionScore,
    attributeScore,
    confidencePenalty
  };
}

/**
 * Apply boosts based on query-specific logic
 */
function applyQuerySpecificBoosts(product, parsedQuery, scores) {
  let boostedScore = scores.finalScore;

  // Boost exact category matches
  if (parsedQuery.categories && parsedQuery.categories.length > 0) {
    if (parsedQuery.categories.includes(product.enriched_category)) {
      boostedScore *= 1.05; // 5% boost
    }
  }

  // Boost products with high attribute match AND high confidence (TYPE_1 only)
  if (parsedQuery.query_type === 'TYPE_1') {
    if (scores.attributeScore > 0.9 && product.confidence_score > 0.8) {
      boostedScore *= 1.10; // 10% boost for high quality matches
    }
  }

  // Boost products with complete attribute data
  const missingAttrs = product.missing_attributes || [];
  if (missingAttrs.length === 0) {
    boostedScore *= 1.03; // 3% boost for complete data
  }

  return boostedScore;
}

/**
 * Main reranking function
 */
export function rerankResults(fusedResults, parsedQuery) {
  console.log('[Stage 4] Starting reranking...');

  const startTime = Date.now();

  // Determine how many to rerank based on complexity
  const topK = parsedQuery.complexity_score > 0.7 ? 150 : 100;
  const candidates = fusedResults.slice(0, Math.min(topK, fusedResults.length));

  console.log(`[Stage 4] Reranking top ${candidates.length} candidates`);
  console.log(`[Stage 4] Using ${parsedQuery.query_type} weights`);

  // Calculate final scores for each candidate
  const reranked = candidates.map(fusedItem => {
    const scores = calculateFinalScore(fusedItem, parsedQuery);

    // Apply query-specific boosts
    const boostedScore = applyQuerySpecificBoosts(
      fusedItem.item,
      parsedQuery,
      scores
    );

    return {
      product: fusedItem.item,
      finalScore: boostedScore,
      fusionScore: scores.fusionScore,
      attributeScore: scores.attributeScore,
      confidencePenalty: scores.confidencePenalty,
      baseScore: scores.finalScore,
      sources: fusedItem.sources,
      ranks: fusedItem.ranks
    };
  });

  // Sort by final score
  reranked.sort((a, b) => b.finalScore - a.finalScore);

  // Limit to final results
  const finalResults = reranked.slice(0, config.retrieval.finalResultsLimit);

  const duration = Date.now() - startTime;

  console.log(`[Stage 4] Reranking complete in ${duration}ms`);
  console.log(`[Stage 4] Returning top ${finalResults.length} results`);

  // Log score distribution
  if (finalResults.length > 0) {
    const topScore = finalResults[0].finalScore;
    const bottomScore = finalResults[finalResults.length - 1].finalScore;
    const avgScore = finalResults.reduce((sum, r) => sum + r.finalScore, 0) / finalResults.length;

    console.log(`[Stage 4] Score range: ${topScore.toFixed(4)} - ${bottomScore.toFixed(4)}, avg: ${avgScore.toFixed(4)}`);
  }

  return {
    results: finalResults,
    duration
  };
}

/**
 * Get detailed ranking info for debugging
 */
export function getRankingDebugInfo(rankedItem) {
  return {
    title: rankedItem.product?.title || 'Unknown',
    finalScore: rankedItem.finalScore.toFixed(4),
    fusionScore: rankedItem.fusionScore.toFixed(4),
    attributeScore: rankedItem.attributeScore.toFixed(4),
    confidencePenalty: rankedItem.confidencePenalty.toFixed(4),
    sources: rankedItem.sources,
    category: rankedItem.product?.enriched_category
  };
}

/**
 * Analyze reranking changes
 */
export function analyzeRerankingChanges(fusedResults, rerankedResults) {
  const changes = [];

  for (let i = 0; i < Math.min(20, rerankedResults.length); i++) {
    const rerankedItem = rerankedResults[i];
    const originalRank = fusedResults.findIndex(
      f => f.id === rerankedItem.product.id
    );

    if (originalRank !== -1 && originalRank !== i) {
      changes.push({
        product: rerankedItem.product.title,
        oldRank: originalRank + 1,
        newRank: i + 1,
        change: originalRank - i
      });
    }
  }

  return changes;
}

export default {
  rerankResults,
  getRankingDebugInfo,
  analyzeRerankingChanges,
  calculateFinalScore
};
