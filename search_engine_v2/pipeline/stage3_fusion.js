import config from '../config/config.js';

/**
 * Stage 3: Intelligent Fusion
 *
 * Combine results from 3 sources using Weighted Reciprocal Rank Fusion (RRF)
 * with query-type-aware weighting
 */

/**
 * Calculate RRF score for an item at a given rank
 */
function calculateRRFScore(rank, k = 60) {
  return 1 / (rank + k);
}

/**
 * Get fusion weights based on query type and complexity
 */
function getFusionWeights(parsedQuery) {
  // Base weights from config
  const baseWeights = config.fusionWeights[parsedQuery.query_type];

  // Clone weights
  const weights = { ...baseWeights };

  // Adjust weights if complexity is high
  if (parsedQuery.complexity_score > 0.7) {
    // For complex queries, rely more on semantic understanding
    weights.vector += 0.15;
    weights.keyword -= 0.10;
    weights.attribute -= 0.05;
  }

  return weights;
}

/**
 * Add scores from a result set to the fusion map
 */
function addScoresToFusion(results, sourceName, weight, itemScores, k = 60) {
  results.forEach((item, index) => {
    const itemId = item.id || item.item_page_url;
    const rank = index + 1;
    const rrfScore = calculateRRFScore(rank, k);

    // Get or create item entry
    let currentScore = itemScores.get(itemId);

    if (!currentScore) {
      currentScore = {
        id: itemId,
        score: 0,
        sources: [],
        ranks: {},
        item: item
      };
      itemScores.set(itemId, currentScore);
    }

    // Add weighted RRF score
    currentScore.score += weight * rrfScore;
    currentScore.sources.push(sourceName);
    currentScore.ranks[sourceName] = rank;
  });
}

/**
 * Apply consensus bonuses to items appearing in multiple sources
 */
function applyConsensusBonuses(itemScores) {
  for (const item of itemScores.values()) {
    const sourceCount = item.sources.length;

    if (sourceCount >= 2) {
      // 15% boost for appearing in 2 sources
      item.score *= config.consensus.twoSources;
    }

    if (sourceCount === 3) {
      // Additional 10% boost for appearing in all 3 sources
      item.score *= config.consensus.threeSources;
    }

    // Store original score before bonuses for debugging
    item.baseScore = item.score / (
      sourceCount >= 3 ? config.consensus.twoSources * config.consensus.threeSources :
      sourceCount >= 2 ? config.consensus.twoSources :
      1.0
    );
  }
}

/**
 * Main fusion function
 */
export function intelligentFusion(
  vectorResults,
  attributeResults,
  keywordResults,
  parsedQuery
) {
  console.log('[Stage 3] Starting intelligent fusion...');

  const startTime = Date.now();

  // Get query-type-aware weights
  const weights = getFusionWeights(parsedQuery);

  console.log(`[Stage 3] Using weights:`, weights);
  console.log(`[Stage 3] Query complexity: ${parsedQuery.complexity_score.toFixed(2)}`);

  // Map to store aggregated scores
  const itemScores = new Map();

  // Add scores from each source
  addScoresToFusion(vectorResults, 'vector', weights.vector, itemScores, config.rrf.k);
  addScoresToFusion(attributeResults, 'attribute', weights.attribute, itemScores, config.rrf.k);
  addScoresToFusion(keywordResults, 'keyword', weights.keyword, itemScores, config.rrf.k);

  // Apply consensus bonuses
  applyConsensusBonuses(itemScores);

  // Convert to array and sort by score
  const sortedItems = Array.from(itemScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, config.retrieval.fusionTopK);

  const duration = Date.now() - startTime;

  console.log(`[Stage 3] Fusion complete in ${duration}ms`);
  console.log(`[Stage 3] Fused ${itemScores.size} unique items, returning top ${sortedItems.length}`);

  // Log consensus stats
  const consensusStats = {
    all3: sortedItems.filter(i => i.sources.length === 3).length,
    any2: sortedItems.filter(i => i.sources.length === 2).length,
    only1: sortedItems.filter(i => i.sources.length === 1).length
  };

  console.log(`[Stage 3] Consensus: ${consensusStats.all3} in all 3, ${consensusStats.any2} in 2, ${consensusStats.only1} in 1`);

  return {
    fusedResults: sortedItems,
    weights,
    consensusStats,
    totalUnique: itemScores.size,
    duration
  };
}

/**
 * Get detailed fusion info for debugging
 */
export function getFusionDebugInfo(fusedItem) {
  return {
    id: fusedItem.id,
    score: fusedItem.score.toFixed(4),
    baseScore: fusedItem.baseScore?.toFixed(4),
    sources: fusedItem.sources,
    ranks: fusedItem.ranks,
    title: fusedItem.item?.title || 'Unknown'
  };
}

export default {
  intelligentFusion,
  getFusionDebugInfo,
  getFusionWeights,
  calculateRRFScore
};
