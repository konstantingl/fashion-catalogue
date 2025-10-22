import express from 'express';
import cors from 'cors';
import { search } from './api/search.js';
import { validateConfig } from './config/config.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Validate configuration on startup
try {
  validateConfig();
  console.log('✅ Configuration validated');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Search endpoint
app.post('/api/search', async (req, res) => {
  console.log('\n=== New Search Request ===');
  console.log('Query:', req.body.query);

  try {
    const { query, limit } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string',
        results: []
      });
    }

    const result = await search(query, { limit: limit || 50 });

    res.json(result);

  } catch (error) {
    console.error('Search error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error',
      query_understanding: null,
      results: []
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 Search Engine API Server');
  console.log('=================================');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Search endpoint: POST http://localhost:${PORT}/api/search`);
  console.log('\nReady to receive search requests! 🔍\n');
});

export default app;
