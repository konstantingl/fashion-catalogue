import { supabaseAdmin } from '../services/supabase_client.js';

/**
 * Get all available brands and categories from database
 */
export async function getFilters() {
  try {
    console.log('Fetching all brands and categories...');

    // Use RPC to get distinct values (more efficient for large datasets)
    // Get all products and extract unique values client-side since Supabase doesn't have DISTINCT easily
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('brand, enriched_category')
      .not('brand', 'is', null)
      .not('enriched_category', 'is', null)
      .limit(10000); // Get a large sample

    if (error) {
      throw new Error(`Error fetching products: ${error.message}`);
    }

    if (!products || products.length === 0) {
      return {
        brands: [],
        categories: []
      };
    }

    // Extract unique values
    const brands = [...new Set(products.map(item => item.brand).filter(Boolean))].sort();
    const categories = [...new Set(products.map(item => item.enriched_category).filter(Boolean))].sort();

    console.log(`Found ${brands.length} brands and ${categories.length} categories from ${products.length} products`);

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
