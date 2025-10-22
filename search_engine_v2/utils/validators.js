/**
 * Validate parsed query structure from Gemini
 */
export function validateParsedQuery(parsedQuery) {
  const required = [
    'query_type',
    'language',
    'categories',
    'hard_attributes',
    'soft_preferences',
    'complexity_score'
  ];

  for (const field of required) {
    if (!(field in parsedQuery)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate query_type
  if (!['TYPE_1', 'TYPE_2'].includes(parsedQuery.query_type)) {
    throw new Error(`Invalid query_type: ${parsedQuery.query_type}`);
  }

  // Validate language
  if (!['en', 'de'].includes(parsedQuery.language)) {
    throw new Error(`Invalid language: ${parsedQuery.language}`);
  }

  // Validate categories is array
  if (!Array.isArray(parsedQuery.categories)) {
    throw new Error('categories must be an array');
  }

  // Validate hard_attributes is object
  if (typeof parsedQuery.hard_attributes !== 'object' || parsedQuery.hard_attributes === null) {
    throw new Error('hard_attributes must be an object');
  }

  // Validate soft_preferences structure
  if (typeof parsedQuery.soft_preferences !== 'object' || parsedQuery.soft_preferences === null) {
    throw new Error('soft_preferences must be an object');
  }

  if (!('style_vibe' in parsedQuery.soft_preferences)) {
    parsedQuery.soft_preferences.style_vibe = '';
  }

  if (!('semantic_keywords' in parsedQuery.soft_preferences)) {
    parsedQuery.soft_preferences.semantic_keywords = [];
  }

  if (!Array.isArray(parsedQuery.soft_preferences.semantic_keywords)) {
    throw new Error('soft_preferences.semantic_keywords must be an array');
  }

  // Validate complexity_score
  if (typeof parsedQuery.complexity_score !== 'number' ||
      parsedQuery.complexity_score < 0 ||
      parsedQuery.complexity_score > 1) {
    throw new Error('complexity_score must be a number between 0 and 1');
  }

  return true;
}

/**
 * Sanitize user query input
 */
export function sanitizeQuery(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  // Remove excessive whitespace
  const sanitized = query.trim().replace(/\s+/g, ' ');

  if (sanitized.length === 0) {
    throw new Error('Query cannot be empty');
  }

  if (sanitized.length > 500) {
    throw new Error('Query is too long (max 500 characters)');
  }

  return sanitized;
}

/**
 * Validate search API request
 */
export function validateSearchRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid request format');
  }

  if (!('query' in request)) {
    throw new Error('Missing required field: query');
  }

  const sanitizedQuery = sanitizeQuery(request.query);

  const limit = request.limit || 50;
  if (typeof limit !== 'number' || limit < 1 || limit > 200) {
    throw new Error('limit must be a number between 1 and 200');
  }

  return {
    query: sanitizedQuery,
    limit
  };
}

/**
 * Validate product structure
 */
export function validateProduct(product) {
  if (!product || typeof product !== 'object') {
    return false;
  }

  // Check essential fields
  const required = ['id', 'item_page_url', 'enriched_category'];

  for (const field of required) {
    if (!(field in product) || !product[field]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate fusion result
 */
export function validateFusionResult(result) {
  if (!result || typeof result !== 'object') {
    return false;
  }

  if (!('id' in result) || !('score' in result) || !('item' in result)) {
    return false;
  }

  if (typeof result.score !== 'number' || result.score < 0) {
    return false;
  }

  return validateProduct(result.item);
}

export default {
  validateParsedQuery,
  sanitizeQuery,
  validateSearchRequest,
  validateProduct,
  validateFusionResult
};
