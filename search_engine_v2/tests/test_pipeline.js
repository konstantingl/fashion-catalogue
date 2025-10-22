import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { search } from '../api/search.js';
import { validateConfig } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load test queries
 */
function loadTestQueries() {
  const queriesPath = join(__dirname, 'test_queries.json');
  const raw = readFileSync(queriesPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Calculate attribute match rate for a result set
 */
function calculateAttributeMatchRate(results, requiredAttributes) {
  if (!requiredAttributes || Object.keys(requiredAttributes).length === 0) {
    return 1.0; // No attributes to check
  }

  let matches = 0;

  for (const result of results) {
    let allMatch = true;

    for (const [attr, expectedValue] of Object.entries(requiredAttributes)) {
      const productAttr = result.attributes?.[attr];

      if (!productAttr || productAttr.value !== expectedValue) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      matches++;
    }
  }

  return matches / results.length;
}

/**
 * Run a single test query
 */
async function runTestQuery(testCase) {
  console.log(`\n--- Testing: ${testCase.name} ---`);
  console.log(`Query: "${testCase.query}"`);

  try {
    const startTime = Date.now();
    const result = await search(testCase.query, { limit: 10 });
    const duration = Date.now() - startTime;

    // Check query understanding
    const understanding = result.query_understanding;
    const passed = [];
    const failed = [];

    // Test 1: Query type
    if (testCase.expected_type) {
      if (understanding.query_type === testCase.expected_type) {
        passed.push(`✓ Query type: ${understanding.query_type}`);
      } else {
        failed.push(`✗ Query type: expected ${testCase.expected_type}, got ${understanding.query_type}`);
      }
    }

    // Test 2: Language
    if (testCase.expected_language) {
      if (understanding.language === testCase.expected_language) {
        passed.push(`✓ Language: ${understanding.language}`);
      } else {
        failed.push(`✗ Language: expected ${testCase.expected_language}, got ${understanding.language}`);
      }
    }

    // Test 3: Categories
    if (testCase.expected_categories) {
      const hasCategory = testCase.expected_categories.some(cat =>
        understanding.categories.includes(cat)
      );
      if (hasCategory) {
        passed.push(`✓ Category matches one of: ${testCase.expected_categories.join(', ')}`);
      } else {
        failed.push(`✗ Category: expected one of ${testCase.expected_categories.join(', ')}, got ${understanding.categories.join(', ')}`);
      }
    }

    // Test 4: Attribute match rate
    if (testCase.must_have_attributes) {
      const matchRate = calculateAttributeMatchRate(result.results, testCase.must_have_attributes);
      const target = testCase.precision_target || 0.9;

      if (matchRate >= target) {
        passed.push(`✓ Attribute match rate: ${(matchRate * 100).toFixed(1)}% (target: ${(target * 100).toFixed(1)}%)`);
      } else {
        failed.push(`✗ Attribute match rate: ${(matchRate * 100).toFixed(1)}% (target: ${(target * 100).toFixed(1)}%)`);
      }
    }

    // Test 5: Complexity score
    if (testCase.complexity_expected) {
      const diff = Math.abs(understanding.complexity_score - testCase.complexity_expected);
      if (diff < 0.2) {
        passed.push(`✓ Complexity score: ${understanding.complexity_score.toFixed(2)} (expected ~${testCase.complexity_expected})`);
      } else {
        failed.push(`✗ Complexity score: ${understanding.complexity_score.toFixed(2)} (expected ~${testCase.complexity_expected})`);
      }
    }

    // Test 6: Results count
    if (result.results.length > 0) {
      passed.push(`✓ Returned ${result.results.length} results`);
    } else {
      failed.push(`✗ No results returned`);
    }

    // Test 7: Latency
    const latencyTarget = 2000; // 2 seconds
    if (duration < latencyTarget) {
      passed.push(`✓ Latency: ${duration}ms (target: <${latencyTarget}ms)`);
    } else {
      failed.push(`✗ Latency: ${duration}ms (target: <${latencyTarget}ms)`);
    }

    // Print results
    console.log('\n✅ Passed:');
    passed.forEach(p => console.log(`   ${p}`));

    if (failed.length > 0) {
      console.log('\n❌ Failed:');
      failed.forEach(f => console.log(`   ${f}`));
    }

    // Print top 3 results
    console.log('\n🔍 Top 3 Results:');
    result.results.slice(0, 3).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title} (${r.brand}) - Score: ${r.relevance_score.toFixed(4)}`);
      if (r.match_explanation?.attribute_matches?.length > 0) {
        console.log(`      Attributes: ${r.match_explanation.attribute_matches.join(', ')}`);
      }
    });

    // Print stats
    console.log('\n📊 Stats:');
    console.log(`   Total searched: ${result.total_searched}`);
    console.log(`   Search time: ${result.search_time_ms}ms`);
    console.log(`   Fusion weights: keyword=${result.fusion_weights.keyword}, vector=${result.fusion_weights.vector}, attribute=${result.fusion_weights.attribute}`);

    return {
      testCase: testCase.name,
      passed: failed.length === 0,
      passedChecks: passed.length,
      failedChecks: failed.length,
      duration
    };

  } catch (error) {
    console.error(`\n❌ Test failed with error: ${error.message}`);
    return {
      testCase: testCase.name,
      passed: false,
      error: error.message
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('=== AI-Powered Search Engine Test Suite ===\n');

  try {
    // Validate configuration
    console.log('Validating configuration...');
    validateConfig();
    console.log('✓ Configuration valid\n');

    // Load test queries
    const testQueries = loadTestQueries();
    console.log(`Loaded ${testQueries.length} test queries\n`);

    // Run each test
    const results = [];

    for (const testCase of testQueries) {
      const result = await runTestQuery(testCase);
      results.push(result);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Print summary
    console.log('\n\n=== Test Summary ===');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;

    console.log(`\nTotal: ${results.length} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Average latency: ${avgDuration.toFixed(0)}ms`);

    if (failed > 0) {
      console.log('\nFailed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.testCase}${r.error ? ` (${r.error})` : ''}`);
      });
    }

    console.log('\n✨ Test suite complete!');

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { runTestQuery, runAllTests };
