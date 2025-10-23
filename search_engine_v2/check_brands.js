import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from './services/supabase_client.js';

async function checkBrands() {
  try {
    // Get total count first
    const { count, error: countError } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true });

    console.log('Total products in database:', count);

    // Fetch all products with brand field only
    let allBrands = new Set();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: products, error: fetchError } = await supabaseAdmin
        .from('products')
        .select('brand')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error('Error:', fetchError);
        break;
      }

      if (!products || products.length === 0) break;

      products.forEach(p => {
        if (p.brand) allBrands.add(p.brand);
      });

      console.log(`Page ${page + 1}: ${products.length} products, total unique brands so far: ${allBrands.size}`);

      if (products.length < pageSize) break;
      page++;
    }

    console.log('\nAll unique brands:', Array.from(allBrands).sort());
    console.log('Total unique brands:', allBrands.size);

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkBrands();
