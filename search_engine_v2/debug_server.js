import express from 'express';
import cors from 'cors';
import { searchWithDebug } from './api/search_debug.js';
import { search } from './api/search.js';
import { validateConfig } from './config/config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DEBUG_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'debug-ui')));

// Validate config on startup
try {
  validateConfig();
  console.log('✓ Configuration valid');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

// Regular search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await search(query, { limit: limit || 50 });
    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug search endpoint
app.post('/api/search/debug', async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await searchWithDebug(query, { limit: limit || 10 });
    res.json(result);
  } catch (error) {
    console.error('Debug search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve debug UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug-ui', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔍 Search Debug Server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/search/debug`);
  console.log(`   UI:  http://localhost:${PORT}\n`);
});

export default app;
