import OpenAI from 'openai';
import config from '../config/config.js';

// Initialize OpenAI client
let openaiClient = null;

export function getOpenAIClient() {
  if (!openaiClient && config.openai.apiKey) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  if (!openaiClient) {
    throw new Error('OpenAI API key not configured');
  }

  return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text) {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: config.openai.embeddingModel,
      input: text,
      dimensions: config.openai.embeddingDimensions
    });

    return response.data[0].embedding;
  } catch (error) {
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts) {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: config.openai.embeddingModel,
      input: texts,
      dimensions: config.openai.embeddingDimensions
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    throw new Error(`Failed to generate batch embeddings: ${error.message}`);
  }
}

/**
 * Create factual text for embedding from product data
 */
export function createFactualText(product) {
  const attrs = [];

  // Extract attributes as readable text
  if (product.attributes) {
    for (const [key, valueObj] of Object.entries(product.attributes)) {
      if (valueObj && valueObj.value) {
        attrs.push(`${key}: ${valueObj.value}`);
      }
    }
  }

  const attributesStr = attrs.join(', ');

  // Combine all factual information
  const parts = [
    product.original_data?.title || '',
    product.original_data?.description || '',
    `Category: ${product.enriched_category || ''}`,
    attributesStr ? `Attributes: ${attributesStr}` : '',
    product.original_data?.brand ? `Brand: ${product.original_data.brand}` : ''
  ].filter(part => part); // Remove empty parts

  return parts.join('. ').trim();
}

/**
 * Create style/vibe text for embedding from product data
 */
export function createStyleText(product) {
  // Use LLM-generated description which captures visual and stylistic elements
  return product.llm_description || product.original_data?.description || '';
}

/**
 * Generate both factual and style embeddings for a product
 */
export async function generateProductEmbeddings(product) {
  const factualText = createFactualText(product);
  const styleText = createStyleText(product);

  try {
    const [factualEmbedding, styleEmbedding] = await generateEmbeddingsBatch([
      factualText,
      styleText
    ]);

    return {
      factualEmbedding,
      styleEmbedding,
      factualText,
      styleText
    };
  } catch (error) {
    throw new Error(`Failed to generate product embeddings: ${error.message}`);
  }
}

/**
 * Generate query embedding based on query type and parsed query
 */
export async function generateQueryEmbedding(parsedQuery, originalQuery) {
  let queryText;

  if (parsedQuery.query_type === 'TYPE_1') {
    // Type 1: Combine attributes and keywords (factual)
    const attrStrings = Object.entries(parsedQuery.hard_attributes || {})
      .map(([k, v]) => `${k}: ${v}`);

    queryText = [
      ...attrStrings,
      ...(parsedQuery.soft_preferences?.semantic_keywords || [])
    ].join(', ');

    // Fallback to original query if nothing to embed
    if (!queryText.trim()) {
      queryText = originalQuery;
    }
  } else {
    // Type 2: Focus on style and vibe
    queryText = [
      parsedQuery.soft_preferences?.style_vibe || '',
      ...(parsedQuery.soft_preferences?.semantic_keywords || [])
    ].join(' ');

    // Fallback to original query
    if (!queryText.trim()) {
      queryText = originalQuery;
    }
  }

  return generateEmbedding(queryText);
}

export default {
  getOpenAIClient,
  generateEmbedding,
  generateEmbeddingsBatch,
  createFactualText,
  createStyleText,
  generateProductEmbeddings,
  generateQueryEmbedding
};
