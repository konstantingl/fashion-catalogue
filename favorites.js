class FavoritesManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = null;
        this.userFavorites = new Set();
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Get Supabase client from auth manager
            this.supabase = this.authManager.getSupabaseClient();

            if (!this.supabase) {
                throw new Error('Supabase client not available');
            }

            // Set up auth state listener
            this.authManager.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    this.loadUserFavorites();
                } else if (event === 'SIGNED_OUT') {
                    this.clearUserFavorites();
                }
            });

            // Load favorites if user is already signed in
            if (this.authManager.isAuthenticated()) {
                await this.loadUserFavorites();
            }

            // Also listen for when products are loaded to update buttons
            this.setupProductLoadListener();

            this.isInitialized = true;
            console.log('FavoritesManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize FavoritesManager:', error);
            throw error;
        }
    }

    async createFavoritesTable() {
        try {
            // This would typically be done via Supabase dashboard or migrations
            // Including here for reference of the expected schema
            const tableSQL = `
                CREATE TABLE IF NOT EXISTS user_favorites (
                    id BIGSERIAL PRIMARY KEY,
                    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                    product_id TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(user_id, product_id)
                );

                -- Enable Row Level Security
                ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

                -- Create policy for users to manage their own favorites
                CREATE POLICY "Users can manage their own favorites" ON user_favorites
                    FOR ALL USING (auth.uid() = user_id);

                -- Create index for performance
                CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
                CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id ON user_favorites(product_id);
            `;

            console.log('Favorites table schema (run this in Supabase SQL editor):', tableSQL);
        } catch (error) {
            console.error('Error with table schema:', error);
        }
    }

    async loadUserFavorites() {
        if (!this.authManager.isAuthenticated()) {
            this.userFavorites.clear();
            this.updateFavoriteButtons();
            return;
        }

        try {
            const userId = this.authManager.getUserId();

            const { data, error } = await this.supabase
                .from('user_favorites')
                .select('product_id')
                .eq('user_id', userId);

            if (error) {
                console.error('Error loading favorites:', error);
                // Still update UI even if there's an error
                this.updateFavoriteButtons();
                return;
            }

            this.userFavorites.clear();
            if (data && data.length > 0) {
                data.forEach(favorite => {
                    this.userFavorites.add(favorite.product_id);
                });
            }

            this.updateFavoriteButtons();
        } catch (error) {
            console.error('Error loading user favorites:', error);
            this.updateFavoriteButtons();
        }
    }

    async addFavorite(productId) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('User must be authenticated to add favorites');
        }

        try {
            const userId = this.authManager.getUserId();

            const { error } = await this.supabase
                .from('user_favorites')
                .insert([
                    {
                        user_id: userId,
                        product_id: productId
                    }
                ]);

            if (error) {
                // Check if it's a duplicate entry error
                if (error.code === '23505') {
                    console.log('Product already in favorites');
                    this.userFavorites.add(productId);
                    return;
                }
                throw error;
            }

            this.userFavorites.add(productId);

            // Update UI immediately
            this.updateFavoriteButtons();

            // Track analytics
            if (window.analytics) {
                window.analytics.trackEvent('user_action', 'add_favorite', {
                    productId: productId,
                    metadata: {
                        userId: userId,
                        totalFavorites: this.userFavorites.size
                    }
                });
            }
        } catch (error) {
            console.error('Error adding favorite:', error);
            throw new Error('Failed to add favorite. Please try again.');
        }
    }

    async removeFavorite(productId) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('User must be authenticated to remove favorites');
        }

        try {
            const userId = this.authManager.getUserId();

            const { error } = await this.supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', userId)
                .eq('product_id', productId);

            if (error) {
                throw error;
            }

            this.userFavorites.delete(productId);

            // Update UI immediately
            this.updateFavoriteButtons();

            // Track analytics
            if (window.analytics) {
                window.analytics.trackEvent('user_action', 'remove_favorite', {
                    productId: productId,
                    metadata: {
                        userId: userId,
                        totalFavorites: this.userFavorites.size
                    }
                });
            }
        } catch (error) {
            console.error('Error removing favorite:', error);
            throw new Error('Failed to remove favorite. Please try again.');
        }
    }

    async getFavorites() {
        if (!this.authManager.isAuthenticated()) {
            return [];
        }

        try {
            const userId = this.authManager.getUserId();

            const { data, error } = await this.supabase
                .from('user_favorites')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error getting favorites:', error);
            return [];
        }
    }

    isFavorite(productId) {
        return this.userFavorites.has(productId);
    }

    getFavoriteCount() {
        return this.userFavorites.size;
    }

    clearUserFavorites() {
        this.userFavorites.clear();
        this.updateFavoriteButtons();
        console.log('Cleared user favorites');
    }

    updateFavoriteButtons() {
        const favoriteButtons = document.querySelectorAll('.favorite-btn');

        // Update all favorite button states based on current favorites
        favoriteButtons.forEach(btn => {
            const productId = btn.dataset.productId;
            const isFavorited = this.isFavorite(productId);

            if (isFavorited) {
                btn.classList.add('favorited');
                btn.setAttribute('aria-label', 'Remove from favorites');
                btn.setAttribute('title', 'Remove from favorites');
            } else {
                btn.classList.remove('favorited');
                btn.setAttribute('aria-label', 'Add to favorites');
                btn.setAttribute('title', 'Add to favorites');
            }
        });

        // Update favorites count in header - always do this
        this.updateFavoritesCountInHeader();
    }

    updateFavoritesCountInHeader() {
        const favoritesCountEl = document.querySelector('.favorites-count');
        const count = this.getFavoriteCount();

        if (favoritesCountEl) {
            favoritesCountEl.textContent = count;
        }

        // Also update via authUI if available
        if (window.authUI) {
            window.authUI.updateFavoritesCount();
        }
    }

    setupProductLoadListener() {
        // Listen for when products are loaded/rendered
        document.addEventListener('productsRendered', () => {
            this.updateFavoriteButtons();
        });
    }

    // Public method to refresh favorites UI (called when products are loaded)
    async refreshFavoritesUI() {
        if (this.authManager.isAuthenticated()) {
            await this.loadUserFavorites();
        } else {
            this.updateFavoriteButtons();
        }
    }

    createFavoritesModal() {
        // Remove existing modal if any
        const existingModal = document.querySelector('.favorites-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'favorites-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="favorites-modal">
                <div class="favorites-modal-header">
                    <h2 class="favorites-modal-title">My Favorites</h2>
                    <button class="favorites-modal-close" aria-label="Close favorites">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="favorites-modal-body">
                    <div class="favorites-grid" id="favorites-grid">
                        <!-- Favorites will be populated here -->
                    </div>
                    <div class="favorites-empty" id="favorites-empty" style="display: none;">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                                  stroke="currentColor" stroke-width="1" fill="none"/>
                        </svg>
                        <h3>No favorites yet</h3>
                        <p>Start adding items to your favorites by clicking the heart icon on products you love!</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // Add event listeners
        modalOverlay.querySelector('.favorites-modal-close').addEventListener('click', () => {
            this.hideFavoritesPage();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.hideFavoritesPage();
            }
        });

        // Escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hideFavoritesPage();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return modalOverlay;
    }

    async showFavoritesPage() {
        const modal = this.createFavoritesModal();
        const favoritesGrid = modal.querySelector('#favorites-grid');
        const emptyState = modal.querySelector('#favorites-empty');

        try {
            // Show modal
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';

            // Load favorite products
            const favoriteProducts = await this.getFavoriteProducts();

            if (favoriteProducts.length === 0) {
                favoritesGrid.style.display = 'none';
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
                favoritesGrid.style.display = 'grid';
                this.renderFavoriteProducts(favoritesGrid, favoriteProducts);
            }
        } catch (error) {
            console.error('Error showing favorites page:', error);
            favoritesGrid.innerHTML = '<p>Error loading favorites. Please try again.</p>';
        }
    }

    hideFavoritesPage() {
        const modal = document.querySelector('.favorites-modal-overlay');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            setTimeout(() => {
                modal.remove();
            }, 300);
        }
    }

    renderFavoriteProducts(container, products) {
        container.innerHTML = '';

        products.forEach(product => {
            const card = this.createFavoriteProductCard(product);
            container.appendChild(card);
        });
    }

    createFavoriteProductCard(product) {
        const card = document.createElement('div');
        card.className = 'favorite-product-card';

        const productId = product.id || product.original_data.item_page_url;
        const images = product.original_data.images_url || [];
        const validImages = images.filter(img => img && img.trim() !== '').slice(0, 1); // Just show first image

        card.innerHTML = `
            <div class="favorite-product-image">
                ${validImages.length > 0 ?
                    `<img src="${validImages[0]}" alt="${product.original_data.title}" loading="lazy"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE2MS4wNDYgMjAwIDE3MCAyMDguOTU0IDE3MCAyMjBDMTcwIDIzMS4wNDYgMTYxLjA0NiAyNDAgMTUwIDI0MEMxMzguOTU0IDI0MCAxMzAgMjMxLjA0NiAxMzAgMjIwQzEzMCAyMDguOTU0IDEzOC45NTQgMjAwIDE1MCAyMDBaIiBmaWxsPSIjREREREREIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5OTk5IiBmb250LXNpemU9IjE0cHgiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'">` :
                    `<div class="no-image">No Image</div>`
                }
                <button class="remove-favorite-btn" data-product-id="${productId}" title="Remove from favorites">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="favorite-product-info">
                <div class="favorite-product-brand">${product.original_data.brand || ''}</div>
                <div class="favorite-product-title">${product.original_data.title || 'Untitled'}</div>
                <div class="favorite-product-price">${product.original_data.price_eur ? `€${product.original_data.price_eur}` : 'Price not available'}</div>
                <button class="view-product-btn" data-url="${product.original_data.item_page_url}">
                    View Product
                </button>
            </div>
        `;

        // Add event listeners
        const removeBtn = card.querySelector('.remove-favorite-btn');
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await this.removeFavorite(productId);
                card.remove();

                // Check if no favorites left
                const remainingCards = document.querySelectorAll('.favorite-product-card');
                if (remainingCards.length === 0) {
                    const favoritesGrid = document.querySelector('#favorites-grid');
                    const emptyState = document.querySelector('#favorites-empty');
                    favoritesGrid.style.display = 'none';
                    emptyState.style.display = 'block';
                }
            } catch (error) {
                console.error('Error removing favorite:', error);
                alert('Error removing favorite. Please try again.');
            }
        });

        const viewBtn = card.querySelector('.view-product-btn');
        viewBtn.addEventListener('click', () => {
            window.open(product.original_data.item_page_url, '_blank');
        });

        return card;
    }

    // Get favorite products with full details
    async getFavoriteProducts() {
        if (!this.authManager.isAuthenticated()) {
            return [];
        }

        try {
            const favorites = await this.getFavorites();
            const favoriteProductIds = favorites.map(fav => fav.product_id);

            // Get product details from the main products array
            if (window.fashionCatalogue && window.fashionCatalogue.allProducts) {
                const favoriteProducts = window.fashionCatalogue.allProducts.filter(product => {
                    const productId = product.id || product.original_data.item_page_url;
                    return favoriteProductIds.includes(productId);
                });

                return favoriteProducts;
            }

            return [];
        } catch (error) {
            console.error('Error getting favorite products:', error);
            return [];
        }
    }

    // Export favorites (useful for data portability)
    async exportFavorites() {
        try {
            const favorites = await this.getFavorites();
            const favoriteProducts = await this.getFavoriteProducts();

            const exportData = {
                exported_at: new Date().toISOString(),
                user_id: this.authManager.getUserId(),
                total_favorites: favorites.length,
                favorites: favoriteProducts.map(product => ({
                    product_id: product.id || product.original_data.item_page_url,
                    title: product.original_data.title,
                    brand: product.original_data.brand,
                    price: product.original_data.price_eur,
                    url: product.original_data.item_page_url,
                    added_at: favorites.find(f =>
                        f.product_id === (product.id || product.original_data.item_page_url)
                    )?.created_at
                }))
            };

            return exportData;
        } catch (error) {
            console.error('Error exporting favorites:', error);
            throw new Error('Failed to export favorites');
        }
    }

    // Import favorites (for data restoration)
    async importFavorites(exportData) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('User must be authenticated to import favorites');
        }

        try {
            const userId = this.authManager.getUserId();
            const favoritesToImport = exportData.favorites.map(fav => ({
                user_id: userId,
                product_id: fav.product_id
            }));

            const { error } = await this.supabase
                .from('user_favorites')
                .upsert(favoritesToImport, {
                    onConflict: 'user_id,product_id',
                    ignoreDuplicates: true
                });

            if (error) {
                throw error;
            }

            await this.loadUserFavorites();
            console.log(`Imported ${favoritesToImport.length} favorites`);

            return {
                success: true,
                imported: favoritesToImport.length
            };
        } catch (error) {
            console.error('Error importing favorites:', error);
            throw new Error('Failed to import favorites');
        }
    }
}

// Global favorites manager instance
let favoritesManager = null;

// Initialize favorites system
async function initializeFavorites() {
    if (!window.authManager) {
        console.warn('Auth manager not available, waiting...');
        setTimeout(initializeFavorites, 500);
        return;
    }

    try {
        favoritesManager = new FavoritesManager(window.authManager);
        await favoritesManager.init();

        // Make favorites manager globally available
        window.favoritesManager = favoritesManager;

        console.log('Favorites system initialized');
        return favoritesManager;
    } catch (error) {
        console.error('Failed to initialize favorites:', error);
        return null;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FavoritesManager, initializeFavorites };
}