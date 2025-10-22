import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { supabaseAdmin, insertProductsBatch, getProductCount } from '../services/supabase_client.js';
import { validateConfig } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load products from JSON file
 */
function loadProductsFromJSON() {
  const productsPath = join(__dirname, '../../data/products.json');
  console.log('Loading products from:', productsPath);

  const raw = readFileSync(productsPath, 'utf-8');
  const products = JSON.parse(raw);

  console.log(`Loaded ${products.length} products from JSON`);
  return products;
}

/**
 * Transform product for Supabase schema
 */
function transformProduct(product) {
  return {
    id: product.original_data.item_page_url,
    item_page_url: product.original_data.item_page_url,
    category: product.original_data.category,
    subcategory: product.original_data.subcategory || null,
    brand: product.original_data.brand,
    price_eur: product.original_data.price_eur,
    title: product.original_data.title,
    description: product.original_data.description,
    images_url: product.original_data.images_url,
    enriched_category: product.enriched_category,
    attributes: product.attributes,
    missing_attributes: product.missing_attributes || [],
    confidence_score: product.confidence_score || 0,
    llm_description: product.llm_description || null,
    llm_description_metadata: product.llm_description_metadata || null,
    valid_images_count: product.valid_images_count || 0,
    enrichment_timestamp: product.enrichment_timestamp || null,
    // Embeddings will be added later by generate_embeddings.js
    factual_embedding: null,
    style_embedding: null
  };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('=== Supabase Migration Script ===\n');

  try {
    // Validate configuration
    console.log('Validating configuration...');
    validateConfig();

    // Load products from JSON
    const products = loadProductsFromJSON();

    // Transform products for Supabase
    console.log('\nTransforming products for Supabase schema...');
    const transformedProducts = products.map(transformProduct);

    // Check existing product count
    let existingCount = 0;
    try {
      existingCount = await getProductCount();
      console.log(`\nFound ${existingCount} existing products in Supabase`);
    } catch (error) {
      console.log('\nNo existing products table found (this is normal for first run)');
    }

    // Ask for confirmation
    console.log(`\nReady to migrate ${transformedProducts.length} products to Supabase`);
    console.log('This will upsert (insert or update) products based on item_page_url');

    // Insert products in batches
    console.log('\nStarting batch insertion...');
    const results = await insertProductsBatch(transformedProducts, 100);

    // Print results
    console.log('\n=== Migration Results ===');
    console.log(`✅ Successfully inserted/updated: ${results.success} products`);
    console.log(`❌ Failed: ${results.failed} products`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => {
        console.log(`  - Batch ${err.batch}: ${err.error}`);
      });
    }

    // Verify final count
    const finalCount = await getProductCount();
    console.log(`\n📊 Final product count in Supabase: ${finalCount}`);

    console.log('\n✨ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Run generate_embeddings.js to create vector embeddings');
    console.log('2. Test the search API');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate, transformProduct, loadProductsFromJSON };
