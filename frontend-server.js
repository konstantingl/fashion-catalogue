import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve data directory explicitly
app.use('/data', express.static(path.join(__dirname, 'data')));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🎨 Fashion App Frontend Server');
  console.log('=================================');
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Products data: http://localhost:${PORT}/data/products.json`);
  console.log('\n✨ Open http://localhost:8080 in your browser!\n');
});
