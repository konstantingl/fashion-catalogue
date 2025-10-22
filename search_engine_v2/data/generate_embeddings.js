import { supabaseAdmin } from '../services/supabase_client.js';
import { generateProductEmbeddings } from '../services/openai_client.js';
import { validateConfig } from '../config/config.js';

/**
 * Fetch all products from Supabase that need embeddings
 */
async function fetchProductsNeedingEmbeddings(limit = null) {
  let query = supabaseAdmin
    .from('products')
    .select('*')
    .or('factual_embedding.is.null,style_embedding.is.null');

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return data || [];
}

/**
 * Update product with generated embeddings
 */
async function updateProductEmbeddings(productId, embeddings) {
  const { error } = await supabaseAdmin
    .from('products')
    .update({
      factual_embedding: embeddings.factualEmbedding,
      style_embedding: embeddings.styleEmbedding,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId);

  if (error) {
    throw new Error(`Failed to update product ${productId}: ${error.message}`);
  }
}

/**
 * Process products in batches
 */
async function processBatch(products, batchNumber, totalBatches) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${products.length} products)...`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    try {
      // Generate embeddings
      const embeddings = await generateProductEmbeddings(product);

      // Update in Supabase
      await updateProductEmbeddings(product.id, embeddings);

      results.success++;

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  Progress: ${i + 1}/${products.length}\r`);
      }

    } catch (error) {
      results.failed++;
      results.errors.push({
        productId: product.id,
        error: error.message
      });
      console.error(`\n  ❌ Failed for product ${product.id}: ${error.message}`);
    }

    // Rate limiting: small delay between products
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`  ✅ Batch ${batchNumber} complete: ${results.success} success, ${results.failed} failed`);

  return results;
}

/**
 * Main embedding generation function
 */
async function generateEmbeddings(options = {}) {
  console.log('=== Embedding Generation Script ===\n');

  try {
    // Validate configuration
    console.log('Validating configuration...');
    validateConfig();

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required. Please set it in .env file');
    }

    // Fetch products needing embeddings
    console.log('\nFetching products needing embeddings...');
    const products = await fetchProductsNeedingEmbeddings(options.limit);

    if (products.length === 0) {
      console.log('✨ All products already have embeddings!');
      return;
    }

    console.log(`Found ${products.length} products needing embeddings`);

    // Estimate cost and time
    const estimatedCost = (products.length * 2 * 0.00013).toFixed(2); // $0.00013 per 1k tokens, ~2 embeddings per product
    const estimatedMinutes = Math.ceil(products.length / 600); // ~600 products per minute with rate limiting

    console.log(`\nEstimated cost: ~$${estimatedCost}`);
    console.log(`Estimated time: ~${estimatedMinutes} minutes`);

    // Process in batches of 100
    const batchSize = options.batchSize || 100;
    const totalBatches = Math.ceil(products.length / batchSize);

    console.log(`\nProcessing in ${totalBatches} batches of ${batchSize}...`);

    const overallResults = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      const batchResults = await processBatch(batch, batchNumber, totalBatches);

      overallResults.success += batchResults.success;
      overallResults.failed += batchResults.failed;
      overallResults.errors.push(...batchResults.errors);

      // Delay between batches to respect rate limits
      if (batchNumber < totalBatches) {
        console.log('  Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print final results
    console.log('\n=== Final Results ===');
    console.log(`✅ Successfully generated embeddings: ${overallResults.success} products`);
    console.log(`❌ Failed: ${overallResults.failed} products`);

    if (overallResults.errors.length > 0 && overallResults.errors.length <= 20) {
      console.log('\nErrors:');
      overallResults.errors.forEach(err => {
        console.log(`  - ${err.productId}: ${err.error}`);
      });
    } else if (overallResults.errors.length > 20) {
      console.log(`\nToo many errors to display (${overallResults.errors.length} total)`);
      console.log('First 20 errors:');
      overallResults.errors.slice(0, 20).forEach(err => {
        console.log(`  - ${err.productId}: ${err.error}`);
      });
    }

    console.log('\n✨ Embedding generation complete!');
    console.log('\nNext step: Test the search API');

  } catch (error) {
    console.error('\n❌ Embedding generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
    }
  }

  generateEmbeddings(options);
}

export { generateEmbeddings, fetchProductsNeedingEmbeddings, updateProductEmbeddings };
