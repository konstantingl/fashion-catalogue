import { supabaseAdmin } from '../services/supabase_client.js';

/**
 * Get all available brands and categories from database
 */
export async function getFilters() {
  try {
    console.log('Fetching all brands and categories...');

    // Get distinct brands
    const { data: brandData, error: brandError } = await supabaseAdmin
      .from('products')
      .select('brand')
      .not('brand', 'is', null);

    if (brandError) {
      throw new Error(`Error fetching brands: ${brandError.message}`);
    }

    // Get distinct categories
    const { data: categoryData, error: categoryError } = await supabaseAdmin
      .from('products')
      .select('enriched_category')
      .not('enriched_category', 'is', null);

    if (categoryError) {
      throw new Error(`Error fetching categories: ${categoryError.message}`);
    }

    // Extract unique values
    const brands = [...new Set(brandData.map(item => item.brand))].sort();
    const categories = [...new Set(categoryData.map(item => item.enriched_category))].sort();

    console.log(`Found ${brands.length} brands and ${categories.length} categories`);

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
