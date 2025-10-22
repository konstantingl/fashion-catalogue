import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/config.js';

// Initialize Gemini client
let geminiClient = null;

export function getGeminiClient() {
  if (!geminiClient && config.gemini.apiKey) {
    geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);
  }

  if (!geminiClient) {
    throw new Error('Gemini API key not configured');
  }

  return geminiClient;
}

/**
 * Generate content using Gemini with JSON mode
 */
export async function generateWithGemini(prompt, options = {}) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: config.gemini.model,
    generationConfig: {
      temperature: options.temperature ?? config.gemini.temperature,
      responseMimeType: 'application/json'
    }
  });

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    return JSON.parse(text);
  } catch (error) {
    if (error.message.includes('JSON')) {
      throw new Error(`Gemini returned invalid JSON: ${error.message}`);
    }
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Generate content with retry logic
 */
export async function generateWithRetry(prompt, options = {}) {
  const maxRetries = options.maxRetries || config.gemini.maxRetries;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateWithGemini(prompt, options);
    } catch (error) {
      lastError = error;
      console.warn(`Gemini attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Gemini failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Validate Gemini response structure
 */
export function validateGeminiResponse(response, expectedFields) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid Gemini response: not an object');
  }

  const missingFields = expectedFields.filter(field => !(field in response));

  if (missingFields.length > 0) {
    throw new Error(`Gemini response missing fields: ${missingFields.join(', ')}`);
  }

  return true;
}

/**
 * Cache for common queries (simple in-memory cache)
 */
const queryCache = new Map();

export function getCachedQuery(query) {
  if (!config.search.enableCache) return null;

  const cached = queryCache.get(query.toLowerCase());
  if (!cached) return null;

  // Check if cache is still valid
  const now = Date.now();
  if (now - cached.timestamp > config.search.cacheTtlSeconds * 1000) {
    queryCache.delete(query.toLowerCase());
    return null;
  }

  return cached.result;
}

export function setCachedQuery(query, result) {
  if (!config.search.enableCache) return;

  queryCache.set(query.toLowerCase(), {
    result,
    timestamp: Date.now()
  });

  // Simple cache size limit
  if (queryCache.size > 1000) {
    // Remove oldest entries
    const entries = Array.from(queryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 100).forEach(([key]) => queryCache.delete(key));
  }
}

export function clearQueryCache() {
  queryCache.clear();
}

export default {
  getGeminiClient,
  generateWithGemini,
  generateWithRetry,
  validateGeminiResponse,
  getCachedQuery,
  setCachedQuery,
  clearQueryCache
};
