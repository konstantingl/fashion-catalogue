import { search } from './api/search.js';

async function test() {
  console.log('Testing search...\n');

  const result = await search('long black trench with belt', { limit: 10 });

  console.log('Results:', result.results.length);
  console.log('Query type:', result.query_understanding.query_type);
  console.log('Search time:', result.search_time_ms, 'ms');

  console.log('\nTop 3 results:');
  result.results.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title} (${r.brand})`);
    console.log(`   Score: ${r.relevance_score.toFixed(4)}`);
  });
}

test()