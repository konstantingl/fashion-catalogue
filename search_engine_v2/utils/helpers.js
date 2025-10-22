/**
 * Calculate attribute match score between product and query attributes
 */
export function calculateAttributeMatchScore(productAttrs, queryAttrs) {
  if (!queryAttrs || Object.keys(queryAttrs).length === 0) {
    return 1.0; // No attributes to match
  }

  let matches = 0;
  let total = 0;

  for (const [attr, expectedValue] of Object.entries(queryAttrs)) {
    total++;
    const productAttr = productAttrs?.[attr];

    if (!productAttr || !productAttr.value) {
      // Missing attribute: small penalty
      matches += 0.3;
    } else if (productAttr.value === expectedValue) {
      // Perfect match: weighted by confidence
      matches += (productAttr.confidence || 1.0);
    } else {
      // Wrong value: no points
      matches += 0;
    }
  }

  return total > 0 ? matches / total : 1.0;
}

/**
 * Generate human-readable interpretation of parsed query
 */
export function generateInterpretation(parsedQuery) {
  const parts = [];

  // Query type
  if (parsedQuery.query_type === 'TYPE_1') {
    parts.push('Looking for specific attributes:');
  } else {
    parts.push('Looking for style/vibe:');
  }

  // Categories
  if (parsedQuery.categories && parsedQuery.categories.length > 0) {
    const catNames = parsedQuery.categories.map(c => c.replace(/_/g, ' '));
    parts.push(`in ${catNames.join(', ')}`);
  }

  // Hard attributes
  if (parsedQuery.hard_attributes && Object.keys(parsedQuery.hard_attributes).length > 0) {
    const attrs = Object.entries(parsedQuery.hard_attributes)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(`with ${attrs}`);
  }

  // Style vibe
  if (parsedQuery.soft_preferences?.style_vibe) {
    parts.push(`(${parsedQuery.soft_preferences.style_vibe})`);
  }

  return parts.join(' ');
}

/**
 * Format product for API response
 */
export function formatProductForResponse(product, includeScores = false) {
  const formatted = {
    id: product.id || product.item_page_url,
    title: product.title,
    brand: product.brand,
    price_eur: product.price_eur,
    images_url: product.images_url,
    llm_description: product.llm_description,
    enriched_category: product.enriched_category,
    attributes: product.attributes
  };

  if (includeScores) {
    formatted.relevance_score = product.final_score || product.score || 0;
    formatted.confidence_score = product.confidence_score || 0;
  }

  return formatted;
}

/**
 * Create match explanation for a product
 */
export function createMatchExplanation(product, parsedQuery, scores = {}) {
  const explanation = {
    attribute_matches: [],
    style_match: '',
    scores: {}
  };

  // Attribute matches
  if (parsedQuery.hard_attributes) {
    for (const [attr, expectedValue] of Object.entries(parsedQuery.hard_attributes)) {
      const productAttr = product.attributes?.[attr];

      if (productAttr && productAttr.value === expectedValue) {
        explanation.attribute_matches.push(`${attr}: ${expectedValue}`);
      }
    }
  }

  // Style match
  if (parsedQuery.query_type === 'TYPE_2' && parsedQuery.soft_preferences?.style_vibe) {
    explanation.style_match = parsedQuery.soft_preferences.style_vibe;
  }

  // Scores
  if (scores) {
    explanation.scores = {
      fusion_score: scores.fusion_score || 0,
      attribute_score: scores.attribute_score || 0,
      final_score: scores.final_score || 0
    };
  }

  return explanation;
}

/**
 * Measure execution time for a function
 */
export async function measureTime(fn, label = '') {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;

  if (label) {
    console.log(`${label}: ${duration}ms`);
  }

  return { result, duration };
}

/**
 * Simple in-memory cache with TTL
 */
export class SimpleCache {
  constructor(ttlSeconds = 3600) {
    this.cache = new Map();
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check expiration
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Simple size limit
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * Deduplicate products by ID
 */
export function deduplicateProducts(products) {
  const seen = new Set();
  const unique = [];

  for (const product of products) {
    const id = product.id || product.item_page_url;

    if (!seen.has(id)) {
      seen.add(id);
      unique.push(product);
    }
  }

  return unique;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  calculateAttributeMatchScore,
  generateInterpretation,
  formatProductForResponse,
  createMatchExplanation,
  measureTime,
  SimpleCache,
  deduplicateProducts,
  sleep
};
