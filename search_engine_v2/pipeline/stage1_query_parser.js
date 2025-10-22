import { generateWithRetry, getCachedQuery, setCachedQuery } from '../services/gemini_client.js';
import { getQueryParsingPrompt, createFallbackParsedQuery } from '../utils/prompts.js';
import { validateParsedQuery } from '../utils/validators.js';

/**
 * Stage 1: Parse user query using Gemini LLM
 *
 * Input: Raw user query string
 * Output: Structured ParsedQuery object
 */
export async function parseQuery(userQuery) {
  console.log(`[Stage 1] Parsing query: "${userQuery}"`);

  // Check cache first
  const cached = getCachedQuery(userQuery);
  if (cached) {
    console.log('[Stage 1] Using cached result');
    return cached;
  }

  try {
    // Generate prompt
    const prompt = getQueryParsingPrompt(userQuery);

    // Call Gemini with retry logic
    const parsedQuery = await generateWithRetry(prompt, {
      temperature: 0
    });

    // Validate response structure
    validateParsedQuery(parsedQuery);

    console.log('[Stage 1] Query parsed successfully:', {
      type: parsedQuery.query_type,
      language: parsedQuery.language,
      categories: parsedQuery.categories,
      attributes: Object.keys(parsedQuery.hard_attributes || {}).length,
      complexity: parsedQuery.complexity_score
    });

    // Cache the result
    setCachedQuery(userQuery, parsedQuery);

    return parsedQuery;

  } catch (error) {
    console.warn('[Stage 1] Query parsing failed, using fallback:', error.message);

    // Create fallback parsed query
    const fallback = createFallbackParsedQuery(userQuery);
    console.log('[Stage 1] Fallback query:', fallback);

    return fallback;
  }
}

/**
 * Parse multiple queries in batch (for testing)
 */
export async function parseQueriesBatch(queries) {
  const results = [];

  for (const query of queries) {
    try {
      const parsed = await parseQuery(query);
      results.push({
        query,
        parsed,
        success: true
      });
    } catch (error) {
      results.push({
        query,
        error: error.message,
        success: false
      });
    }
  }

  return results;
}

export default {
  parseQuery,
  parseQueriesBatch
};
