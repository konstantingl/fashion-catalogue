import { supabaseAdmin } from '../services/supabase_client.js';

/**
 * Get all available brands and categories from database
 */
export async function getFilters() {
  try {
    console.log('Fetching all brands and categories...');

    // Get all distinct brands and categories by fetching all products
    // We'll paginate through the entire table to ensure we get all unique values
    let allBrands = new Set();
    let allCategories = new Set();
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('brand, enriched_category')
        .not('brand', 'is', null)
        .not('enriched_category', 'is', null)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        throw new Error(`Error fetching products: ${error.message}`);
      }

      if (!products || products.length === 0) {
        hasMore = false;
        break;
      }

      // Add to sets
      products.forEach(item => {
        if (item.brand) allBrands.add(item.brand);
        if (item.enriched_category) allCategories.add(item.enriched_category);
      });

      console.log(`Page ${page + 1}: Found ${products.length} products, running totals: ${allBrands.size} brands, ${allCategories.size} categories`);

      // If we got less than pageSize, we're done
      if (products.length < pageSize) {
        hasMore = false;
      }

      page++;
    }

    // Convert sets to sorted arrays
    const brands = Array.from(allBrands).sort();
    const categories = Array.from(allCategories).sort();

    console.log(`Final result: ${brands.length} unique brands and ${categories.length} unique categories`);
    console.log('Brands:', brands);

    return {
      brands,
      categories
    };

  } catch (error) {
    console.error('Error fetching filters:', error);
    throw error;
  }
}

/**
 * Vercel Serverless Function handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Fetch all filters
    const filters = await getFilters();

    // Return response
    res.status(200).json(filters);

  } catch (error) {
    console.error('Filters API error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error',
      brands: [],
      categories: []
    });
  }
}
