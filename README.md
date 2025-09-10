# Fashion Catalogue Web App

A lightweight, responsive web application for browsing fashion items with smart filtering and lazy loading.

## Features

- **11,270+ Fashion Items**: Complete catalogue from Zara, H&M, Mango, and other brands
- **Smart Filtering**: Dynamic filters that show relevant attributes based on selected category
- **Image Slider**: Multiple product photos with smooth navigation
- **Lazy Loading**: Optimized performance with paginated loading
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Direct Shopping**: Click any item to visit the original shop page

## Quick Start

1. Open `index.html` in your browser
2. Browse products with initial filters (Brand and Category)
3. Select a category to see specific attribute filters
4. Click "Load More" to see additional items
5. Click any product to visit the shop page

## Data Structure

The app uses data from `enrichment_results/enriched_dataset_merged_final.json` with the following structure:

```json
{
  "original_data": {
    "item_page_url": "https://...",
    "category": "trousers",
    "brand": "ZARA",
    "price_eur": 39.95,
    "title": "CONTRAST TOPSTITCH TROUSERS",
    "description": "...",
    "images_url": ["url1", "url2", ...]
  },
  "enriched_category": "trousers_pants",
  "attributes": {
    "cut": {"value": "FLARE", "confidence": 0.9},
    "rise": {"value": "MID", "confidence": 0.95}
  },
  "confidence_score": 0.6375
}
```

## Filter Categories

### Available Categories
- Blazers
- Cardigans  
- Co-ord Sets
- Coats
- Dresses
- Jackets
- Jeans
- Shirts & Blouses
- Shorts
- Skirts
- Sweaters & Pullovers
- Tops & Camisoles
- Trench Coats & Parkas
- Trousers & Pants
- T-Shirts

### Dynamic Attributes
Each category has specific attributes:
- **Trousers**: Cut, Fit, Length, Rise
- **Dresses**: Length, Neckline, Silhouette, Sleeve Length
- **Jackets**: Closure, Collar, Fit, Length
- And more...

## Technical Implementation

- **Pure HTML/CSS/JavaScript**: No framework dependencies
- **Client-side Filtering**: Fast, responsive filtering
- **Confidence Sorting**: Items sorted by AI confidence (hidden from users)
- **Lazy Image Loading**: Images load as they enter viewport
- **Mobile-first Design**: Optimized for all screen sizes

## Performance Features

- **Paginated Loading**: 24 items per page
- **Smart Caching**: Filtered results cached for faster navigation
- **Optimized Images**: Fallback handling for broken image URLs
- **Minimal Dependencies**: Lightweight and fast loading

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## File Structure

```
fashion-catalogue/
├── index.html          # Main application page
├── styles.css          # Responsive styles
├── script.js           # Core functionality
├── data/
│   └── products.json   # Product dataset
└── README.md           # This file
```