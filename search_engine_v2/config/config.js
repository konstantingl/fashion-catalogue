import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

export const config = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveWZ6YnJhc3liaWxieHlycHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MjY3ODUsImV4cCI6MjA3NDMwMjc4NX0.HoS2ezSVx_6Qty-jaotmkFaGe-JqjlPlpQlog9XTJX0'
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-large',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS) || 1536
  },

  // Google Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    temperature: 0,
    maxRetries: 3
  },

  // Search settings
  search: {
    latencyTargetMs: parseInt(process.env.SEARCH_LATENCY_TARGET_MS) || 2000,
    enableCache: process.env.ENABLE_QUERY_CACHE === 'true',
    cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS) || 3600
  },

  // Retrieval settings
  retrieval: {
    vectorTopK: parseInt(process.env.VECTOR_TOP_K) || 200,
    attributeTopK: parseInt(process.env.ATTRIBUTE_TOP_K) || 300,
    keywordTopK: parseInt(process.env.KEYWORD_TOP_K) || 200,
    fusionTopK: parseInt(process.env.FUSION_TOP_K) || 500,
    finalResultsLimit: parseInt(process.env.FINAL_RESULTS_LIMIT) || 50
  },

  // Fusion weights by query type
  fusionWeights: {
    TYPE_1: {
      keyword: 0.25,
      vector: 0.15,
      attribute: 0.60
    },
    TYPE_2: {
      keyword: 0.20,
      vector: 0.60,
      attribute: 0.20
    }
  },

  // Reranking weights by query type
  rerankingWeights: {
    TYPE_1: {
      fusionScore: 0.50,
      attributeScore: 0.45,
      confidencePenalty: 0.05
    },
    TYPE_2: {
      fusionScore: 0.75,
      attributeScore: 0.20,
      confidencePenalty: 0.05
    }
  },

  // RRF parameters
  rrf: {
    k: 60 // Constant for reciprocal rank fusion
  },

  // Consensus bonuses
  consensus: {
    twoSources: 1.15,  // 15% boost for 2 sources
    threeSources: 1.10 // Additional 10% for all 3 sources
  }
};

// Validate required config
export function validateConfig() {
  const required = [
    ['SUPABASE_URL', config.supabase.url],
    ['GEMINI_API_KEY', config.gemini.apiKey]
  ];

  const missing = required.filter(([name, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  // Warnings for optional but recommended
  if (!config.openai.apiKey) {
    console.warn('⚠️  OPENAI_API_KEY not set - embeddings will fail');
  }

  if (!config.supabase.serviceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - using anon key (limited permissions)');
  }
}

export default config;
