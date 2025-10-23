import { supabaseAdmin } from '../services/supabase_client.js';
import { formatProductForResponse } from '../utils/helpers.js';

/**
 * Get products with filters applied
 */
export async function getFilteredProducts(filters = {}, limit = 50) {
  try {
    console.log('Fetching filtered products with filters:', JSON.stringify(filters, null, 2));

    // Start building the query
    let query = supabaseAdmin
      .from('products')
      .select('*');

    // Apply brand filter
    if (filters.brands && filters.brands.length > 0) {
      query = query.in('brand', filters.brands);
    }

    // Apply category filter
    if (filters.categories && filters.categories.length > 0) {
      query = query.in('enriched_category', filters.categories);
    }

    // Apply price filters
    if (filters.priceMin !== null && filters.priceMin !== undefined) {
      query = query.gte('price_eur', filters.priceMin);
    }
    if (filters.priceMax !== null && filters.priceMax !== undefined) {
      query = query.lte('price_eur', filters.priceMax);
    }

    // Apply attribute filters
    // Attributes are stored as JSONB, so we need to use containment operators
    if (filters.attributes && Object.keys(filters.attributes).length > 0) {
      for (const [attr, values] of Object.entries(filters.attributes)) {
        if (values && values.length > 0) {
          // For each attribute value, we need to check if the product has that attribute with that value
          // Using JSONB contains operator
          // Format: attributes @> '{"attribute_name": {"value": "attribute_value"}}'
          const conditions = values.map(value => ({
            [attr]: { value: value }
          }));

          // Use OR logic for multiple values of the same attribute
          const orFilters = conditions.map(condition =>
            `attributes @> '${JSON.stringify(condition)}'`
          ).join(' OR ');

          query = query.or(orFilters);
        }
      }
    }

    // Order by ID descending to get recent products first
    query = query.order('id', { ascending: false });

    // Apply limit
    query = query.limit(limit);

    const { data: products, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!products || products.length === 0) {
      console.log('No products found matching filters');
      return [];
    }

    console.log(`Found ${products.length} products matching filters`);

    // Format products for response
    return products.map(product => formatProductForResponse(product, false));

  } catch (error) {
    console.error('Error fetching filtered products:', error);
    throw error;
  }
}

/**
 * Vercel Serverless Function handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Get filters and limit from request body
    const { filters = {}, limit = 50 } = req.body;

    // Fetch filtered products
    const products = await getFilteredProducts(filters, limit);

    // Return response
    res.status(200).json({
      products,
      count: products.length,
      filters_applied: filters
    });

  } catch (error) {
    console.error('Filtered products API error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error',
      products: []
    });
  }
}
