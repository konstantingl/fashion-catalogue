import { supabaseAdmin } from '../services/supabase_client.js';
import { formatProductForResponse } from '../utils/helpers.js';

/**
 * Get random featured products
 */
export async function getFeaturedProducts(limit = 30) {
  try {
    console.log(`Fetching ${limit} random featured products...`);

    // Get random products from database
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('id', { ascending: false }) // Get recent products
      .limit(limit * 3); // Get more than needed for randomization

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!products || products.length === 0) {
      return [];
    }

    // Shuffle and take the requested number
    const shuffled = products.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, limit);

    // Format products for response
    return selected.map(product => formatProductForResponse(product, false));

  } catch (error) {
    console.error('Error fetching featured products:', error);
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
    // Get limit from query params (default 30)
    const limit = parseInt(req.query.limit) || 30;

    // Fetch featured products
    const products = await getFeaturedProducts(limit);

    // Return response
    res.status(200).json({
      products,
      count: products.length
    });

  } catch (error) {
    console.error('Featured products API error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error',
      products: []
    });
  }
}
