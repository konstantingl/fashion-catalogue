class FashionCatalogue {
    constructor() {
        this.allProducts = [];
        this.filteredProducts = [];
        this.displayedProducts = [];
        this.itemsPerPage = 24;
        this.currentPage = 0;
        this.filters = {
            brands: new Set(),
            categories: new Set(),
            attributes: {},
            priceMin: null,
            priceMax: null,
            searchQuery: ''
        };
        this.categoryAttributes = {};
        this.isLoading = false;
        this.activeDropdown = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderFilters();
        this.applyFilters();

        // Refresh favorites UI after initial load
        setTimeout(() => {
            if (window.favoritesManager) {
                window.favoritesManager.refreshFavoritesUI();
            }
        }, 1000); // Give some time for everything to initialize
    }

    async loadData() {
        try {
            const response = await fetch('data/products.json');
            this.allProducts = await response.json();
            
            // Sort by confidence score (highest first) - hidden from user
            this.allProducts.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
            
            this.preprocessData();
            console.log(`Loaded ${this.allProducts.length} products`);
        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('loading-indicator').textContent = 'Error loading products. Please refresh the page.';
        }
    }

    preprocessData() {
        const brands = new Set();
        const categories = new Set();
        const categoryAttributeMap = {};

        this.allProducts.forEach(item => {
            // Extract brands
            if (item.original_data?.brand) {
                brands.add(item.original_data.brand);
            }

            // Extract enriched categories
            if (item.enriched_category) {
                categories.add(item.enriched_category);
                
                // Map attributes to categories
                if (!categoryAttributeMap[item.enriched_category]) {
                    categoryAttributeMap[item.enriched_category] = new Set();
                }
                
                if (item.attributes) {
                    Object.keys(item.attributes).forEach(attr => {
                        if (item.attributes[attr]?.value) {
                            categoryAttributeMap[item.enriched_category].add(attr);
                        }
                    });
                }
            }
        });

        this.availableBrands = Array.from(brands).sort();
        this.availableCategories = Array.from(categories).sort();
        this.categoryAttributes = categoryAttributeMap;
    }

    // Convert text to sentence case (first letter capitalized, rest lowercase)
    toSentenceCase(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    setupEventListeners() {
        // Filter button click handlers
        document.getElementById('brand-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('brand');
        });

        document.getElementById('category-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('category');
        });

        document.getElementById('price-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown('price');
        });

        // Save button handlers
        document.getElementById('save-brand').addEventListener('click', () => {
            this.saveBrandFilters();
        });

        document.getElementById('save-category').addEventListener('click', () => {
            this.saveCategoryFilters();
        });

        document.getElementById('save-price').addEventListener('click', () => {
            this.savePriceFilters();
        });

        // Reset button handlers
        document.getElementById('reset-brand').addEventListener('click', () => {
            this.resetBrandFilters();
        });

        document.getElementById('reset-category').addEventListener('click', () => {
            this.resetCategoryFilters();
        });

        document.getElementById('reset-price').addEventListener('click', () => {
            this.resetPriceFilters();
        });

        // Search functionality
        document.getElementById('brand-search').addEventListener('input', (e) => {
            this.filterBrandOptions(e.target.value);
        });

        document.getElementById('category-search').addEventListener('input', (e) => {
            this.filterCategoryOptions(e.target.value);
        });

        // Search input - AI-powered semantic search (only on Enter key or button click)
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        const searchButton = document.getElementById('search-button');

        // Show/hide clear button based on input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            searchClear.style.display = query ? 'flex' : 'none';
        });

        // Handle Enter key to search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                if (query) {
                    console.log('Search triggered by Enter key:', query);
                    this.performSemanticSearch(query);
                }
            }
        });

        // Handle search button click
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    console.log('Search triggered by button click:', query);
                    this.performSemanticSearch(query);
                }
            });
        }

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            this.filters.searchQuery = '';
            this.applyFilters();
        });

        // Clear all filters
        document.getElementById('clear-all-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Load more button
        document.getElementById('load-more-btn').addEventListener('click', () => {
            this.loadMoreProducts();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeAllDropdowns();
        });

        // Prevent dropdown from closing when clicking inside
        document.querySelectorAll('.filter-dropdown-panel').forEach(panel => {
            panel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

    }

    toggleDropdown(type) {
        const button = document.getElementById(`${type}-button`);
        const panel = document.getElementById(`${type}-panel`);
        
        if (this.activeDropdown === type) {
            this.closeDropdown(type);
        } else {
            this.closeAllDropdowns();
            this.openDropdown(type);
        }
    }

    openDropdown(type) {
        const button = document.getElementById(`${type}-button`);
        const panel = document.getElementById(`${type}-panel`);

        button.classList.add('active');
        panel.classList.add('show');
        this.activeDropdown = type;

        // Focus search input if available
        const searchInput = panel.querySelector('.filter-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    closeDropdown(type) {
        const button = document.getElementById(`${type}-button`);
        const panel = document.getElementById(`${type}-panel`);

        button.classList.remove('active');
        panel.classList.remove('show');
        this.activeDropdown = null;
    }

    closeAllDropdowns() {
        ['brand', 'category', 'price'].forEach(type => {
            this.closeDropdown(type);
        });
        
        // Close dynamic attribute dropdowns
        document.querySelectorAll('.dynamic-filter-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.dynamic-dropdown-panel').forEach(panel => {
            panel.classList.remove('show');
        });
        
        this.activeDropdown = null;
    }

    renderFilters() {
        this.renderBrandFilters();
        this.renderCategoryFilters();
        this.updateFilterButtons();
    }

    renderBrandFilters() {
        const container = document.getElementById('brand-options');
        container.innerHTML = '';

        this.availableBrands.forEach(brand => {
            const option = this.createFilterOption(brand, brand, this.filters.brands.has(brand));
            container.appendChild(option);
        });
    }

    renderCategoryFilters() {
        const container = document.getElementById('category-options');
        container.innerHTML = '';

        this.availableCategories.forEach(category => {
            const displayName = this.formatCategoryName(category);
            const option = this.createFilterOption(category, displayName, this.filters.categories.has(category));
            container.appendChild(option);
        });
    }

    createFilterOption(value, displayText, checked = false) {
        const option = document.createElement('div');
        option.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.dataset.value = value;

        const label = document.createElement('label');
        label.textContent = displayText;

        option.appendChild(checkbox);
        option.appendChild(label);

        return option;
    }

    filterBrandOptions(searchTerm) {
        const options = document.querySelectorAll('#brand-options .filter-option');
        options.forEach(option => {
            const label = option.querySelector('label').textContent.toLowerCase();
            const matches = label.includes(searchTerm.toLowerCase());
            option.style.display = matches ? 'flex' : 'none';
        });
    }

    filterCategoryOptions(searchTerm) {
        const options = document.querySelectorAll('#category-options .filter-option');
        options.forEach(option => {
            const label = option.querySelector('label').textContent.toLowerCase();
            const matches = label.includes(searchTerm.toLowerCase());
            option.style.display = matches ? 'flex' : 'none';
        });
    }

    saveBrandFilters() {
        const checkboxes = document.querySelectorAll('#brand-options input[type="checkbox"]');
        const previousBrands = new Set(this.filters.brands);
        this.filters.brands.clear();

        checkboxes.forEach(cb => {
            if (cb.checked) {
                this.filters.brands.add(cb.dataset.value);
            }
        });

        this.closeDropdown('brand');
        this.updateFilterButtons();
        this.applyFilters();

        // Track filter event
        if (window.analytics) {
            window.analytics.trackFilter(
                'brand',
                'save',
                'brands',
                Array.from(this.filters.brands),
                this.filteredProducts.length
            );
        }
    }

    saveCategoryFilters() {
        const checkboxes = document.querySelectorAll('#category-options input[type="checkbox"]');
        this.filters.categories.clear();

        checkboxes.forEach(cb => {
            if (cb.checked) {
                this.filters.categories.add(cb.dataset.value);
            }
        });

        this.closeDropdown('category');
        this.updateFilterButtons();
        this.renderDynamicAttributeFilters();
        this.applyFilters();

        // Track filter event
        if (window.analytics) {
            window.analytics.trackFilter(
                'category',
                'save',
                'categories',
                Array.from(this.filters.categories),
                this.filteredProducts.length
            );
        }
    }

    savePriceFilters() {
        const minPrice = document.getElementById('min-price').value;
        const maxPrice = document.getElementById('max-price').value;

        this.filters.priceMin = minPrice ? parseFloat(minPrice) : null;
        this.filters.priceMax = maxPrice ? parseFloat(maxPrice) : null;

        this.closeDropdown('price');
        this.updateFilterButtons();
        this.applyFilters();

        // Track filter event
        if (window.analytics) {
            window.analytics.trackFilter(
                'price',
                'save',
                'price_range',
                { min: this.filters.priceMin, max: this.filters.priceMax },
                this.filteredProducts.length
            );
        }
    }

    resetBrandFilters() {
        document.querySelectorAll('#brand-options input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }

    resetCategoryFilters() {
        document.querySelectorAll('#category-options input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }

    resetPriceFilters() {
        document.getElementById('min-price').value = '';
        document.getElementById('max-price').value = '';
    }

    renderDynamicAttributeFilters() {
        // Remove existing dynamic attribute filters
        const existingFilters = document.querySelectorAll('.dynamic-filter-container');
        existingFilters.forEach(filter => filter.remove());

        if (this.filters.categories.size === 0) return;

        // Get all attributes for selected categories
        const attributeValues = {};
        Array.from(this.filters.categories).forEach(category => {
            if (this.categoryAttributes[category]) {
                this.categoryAttributes[category].forEach(attr => {
                    if (!attributeValues[attr]) {
                        attributeValues[attr] = new Set();
                    }
                    
                    this.allProducts.forEach(item => {
                        if (item.enriched_category === category && 
                            item.attributes?.[attr]?.value) {
                            attributeValues[attr].add(item.attributes[attr].value);
                        }
                    });
                });
            }
        });

        // Get the filter buttons container and clear all button
        const filterButtonsContainer = document.querySelector('.filter-buttons');
        const clearAllButton = document.getElementById('clear-all-filters');

        // Create attribute filter buttons and insert before the clear all button
        Object.keys(attributeValues).sort().forEach(attr => {
            const filterContainer = this.createDynamicAttributeFilter(attr, attributeValues[attr]);
            filterContainer.classList.add('dynamic-filter-container'); // Add class for easy removal
            filterButtonsContainer.insertBefore(filterContainer, clearAllButton);
        });
    }

    createDynamicAttributeFilter(attribute, values) {
        const container = document.createElement('div');
        container.className = 'filter-dropdown-container';

        const button = document.createElement('button');
        button.className = 'filter-button dynamic-filter-button';
        button.innerHTML = `
            <span class="filter-label">${this.formatAttributeName(attribute)}</span>
            <span class="filter-arrow">▼</span>
        `;

        const panel = document.createElement('div');
        panel.className = 'filter-dropdown-panel dynamic-dropdown-panel';
        
        const content = document.createElement('div');
        content.className = 'dropdown-content';

        Array.from(values).sort().forEach(value => {
            const isSelected = this.filters.attributes[attribute]?.has(value) || false;
            const option = this.createFilterOption(`${attribute}:${value}`, this.formatAttributeValue(value), isSelected);
            content.appendChild(option);
        });

        const footer = document.createElement('div');
        footer.className = 'dropdown-footer';
        footer.innerHTML = `
            <button class="reset-btn">Reset</button>
            <button class="save-btn">Save</button>
        `;

        panel.appendChild(content);
        panel.appendChild(footer);
        container.appendChild(button);
        container.appendChild(panel);

        // Add event listeners
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDynamicDropdown(container, attribute);
        });

        footer.querySelector('.save-btn').addEventListener('click', () => {
            this.saveDynamicAttributeFilter(container, attribute);
        });

        footer.querySelector('.reset-btn').addEventListener('click', () => {
            this.resetDynamicAttributeFilter(container, attribute);
        });

        // Prevent dropdown from closing when clicking inside
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        return container;
    }

    toggleDynamicDropdown(container, attribute) {
        const button = container.querySelector('.filter-button');
        const panel = container.querySelector('.filter-dropdown-panel');

        const isOpen = button.classList.contains('active');

        this.closeAllDropdowns();

        if (!isOpen) {
            button.classList.add('active');
            panel.classList.add('show');
            this.activeDropdown = `dynamic_${attribute}`;
        }
    }

    saveDynamicAttributeFilter(container, attribute) {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        
        if (!this.filters.attributes[attribute]) {
            this.filters.attributes[attribute] = new Set();
        } else {
            this.filters.attributes[attribute].clear();
        }
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                const value = cb.dataset.value.split(':')[1];
                this.filters.attributes[attribute].add(value);
            }
        });

        if (this.filters.attributes[attribute].size === 0) {
            delete this.filters.attributes[attribute];
        }

        container.querySelector('.filter-button').classList.remove('active');
        container.querySelector('.filter-dropdown-panel').classList.remove('show');
        this.activeDropdown = null;

        this.updateFilterButtons();
        this.applyFilters();
    }

    resetDynamicAttributeFilter(container, attribute) {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }


    updateFilterButtons() {
        // Update brand button text
        const brandButton = document.querySelector('#brand-button .filter-label');
        if (this.filters.brands.size > 0) {
            brandButton.textContent = `Brand (${this.filters.brands.size})`;
        } else {
            brandButton.textContent = 'Brand';
        }

        // Update category button text
        const categoryButton = document.querySelector('#category-button .filter-label');
        if (this.filters.categories.size > 0) {
            categoryButton.textContent = `Category (${this.filters.categories.size})`;
        } else {
            categoryButton.textContent = 'Category';
        }

        // Show/hide filter hint based on category selection
        const filterHint = document.querySelector('.filter-hint');
        if (filterHint) {
            if (this.filters.categories.size > 0) {
                filterHint.style.display = 'none';
            } else {
                filterHint.style.display = 'block';
            }
        }

        // Update price button text
        const priceButton = document.querySelector('#price-button .filter-label');
        if (this.filters.priceMin !== null || this.filters.priceMax !== null) {
            let priceText = 'Price (';
            if (this.filters.priceMin !== null) priceText += `€${this.filters.priceMin}`;
            priceText += '-';
            if (this.filters.priceMax !== null) priceText += `€${this.filters.priceMax}`;
            priceText += ')';
            priceButton.textContent = priceText;
        } else {
            priceButton.textContent = 'Price';
        }

        // Update dynamic attribute buttons
        document.querySelectorAll('.dynamic-filter-button').forEach(button => {
            const label = button.querySelector('.filter-label');
            const attr = label.textContent.toLowerCase().replace(/\s+/g, '_');
            const count = this.filters.attributes[attr]?.size || 0;
            
            if (count > 0) {
                label.textContent = `${this.formatAttributeName(attr)} (${count})`;
            }
        });
    }

    async applyFilters() {
        // Start with all products (sorted by confidence)
        let productsToFilter = [...this.allProducts];

        // Apply filters to products
        this.filteredProducts = productsToFilter.filter(item => {
            // Brand filter
            if (this.filters.brands.size > 0) {
                if (!this.filters.brands.has(item.original_data?.brand)) {
                    return false;
                }
            }

            // Category filter
            if (this.filters.categories.size > 0) {
                if (!this.filters.categories.has(item.enriched_category)) {
                    return false;
                }
            }

            // Price filter
            if (this.filters.priceMin !== null || this.filters.priceMax !== null) {
                const price = item.original_data?.price_eur;
                if (price) {
                    if (this.filters.priceMin !== null && price < this.filters.priceMin) return false;
                    if (this.filters.priceMax !== null && price > this.filters.priceMax) return false;
                }
            }

            // Attribute filters
            for (const [attr, values] of Object.entries(this.filters.attributes)) {
                if (values.size > 0) {
                    const itemValue = item.attributes?.[attr]?.value;
                    if (!itemValue || !values.has(itemValue)) {
                        return false;
                    }
                }
            }

            return true;
        });

        // Reset pagination
        this.currentPage = 0;
        this.displayedProducts = [];

        // Load first page
        this.loadMoreProducts();
        this.updateResultsCount();
    }

    async performSemanticSearch(query) {
        console.log('performSemanticSearch called with query:', query);

        // Store the search query
        this.filters.searchQuery = query;

        // Show AI loader overlay
        const aiLoader = document.getElementById('ai-search-loader');
        const aiLoaderMessage = document.getElementById('ai-loader-message');
        const resultsCount = document.getElementById('results-count');
        const loadingIndicator = document.getElementById('loading-indicator');
        const productsGrid = document.getElementById('products-grid');

        // Define rotating messages
        const messages = [
            'Understanding your query with AI...',
            'Searching 10,000+ fashion items...',
            'Running hybrid retrieval...',
            'Analyzing attributes and style...',
            'Ranking by relevance...',
            'Finding your perfect match...'
        ];

        let messageIndex = 0;
        let messageInterval = null;

        // Show the AI loader
        aiLoader.classList.add('active');
        aiLoaderMessage.textContent = messages[0];

        // Rotate messages every 1.5 seconds
        messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            aiLoaderMessage.textContent = messages[messageIndex];
        }, 1500);

        // Also update old loading indicator for backwards compatibility
        resultsCount.textContent = 'Searching with AI...';
        loadingIndicator.classList.add('show');
        productsGrid.innerHTML = '';

        try {
            console.log('Calling search API v2...');

            // Determine API endpoint based on environment
            const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000/api/search'  // Local development
                : '/api/search';  // Production (Vercel)

            // Call the new search engine API
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    limit: 50
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Search API v2 response:', data);
            console.log('Found', data.results.length, 'results');

            // Split results by relevance score
            const RELEVANCE_THRESHOLD = 0.36;
            const MIN_PRIMARY_RESULTS = 8;

            const primaryResults = [];
            const secondaryResults = [];

            data.results.forEach(result => {
                const score = result.relevance_score || 0;
                if (score >= RELEVANCE_THRESHOLD) {
                    primaryResults.push(result);
                } else {
                    secondaryResults.push(result);
                }
            });

            console.log(`Split results: ${primaryResults.length} primary (>= ${RELEVANCE_THRESHOLD}), ${secondaryResults.length} secondary`);

            // Decide whether to show split view
            const shouldSplit = primaryResults.length >= MIN_PRIMARY_RESULTS &&
                               secondaryResults.length > 0;

            if (shouldSplit) {
                console.log('Rendering split view');
                this.renderSplitResults(primaryResults, secondaryResults);
            } else {
                console.log('Rendering unified view');
                this.renderUnifiedResults(data.results);
            }

            // Show query understanding to user
            if (data.query_understanding) {
                console.log('Query understood as:', data.query_understanding.interpreted_as);
                console.log('Query type:', data.query_understanding.query_type);
                console.log('Language:', data.query_understanding.language);
            }

            // Track search event
            if (window.analytics) {
                window.analytics.trackEvent('search', 'ai_search_v2', {
                    metadata: {
                        query: query,
                        results_count: this.filteredProducts.length,
                        execution_time: data.search_time_ms,
                        query_type: data.query_understanding?.query_type,
                        language: data.query_understanding?.language
                    }
                });
            }

        } catch (error) {
            console.error('Search API error:', error);

            // Fallback to client-side filtering on error
            resultsCount.textContent = 'AI search unavailable, using basic filter...';

            // Simple text search fallback
            this.filteredProducts = this.allProducts.filter(item => {
                const searchLower = query.toLowerCase();
                const title = item.original_data?.title?.toLowerCase() || '';
                const description = item.original_data?.description?.toLowerCase() || '';
                const brand = item.original_data?.brand?.toLowerCase() || '';
                const category = item.enriched_category?.toLowerCase() || '';

                return title.includes(searchLower) ||
                       description.includes(searchLower) ||
                       brand.includes(searchLower) ||
                       category.includes(searchLower);
            });

            this.currentPage = 0;
            this.displayedProducts = [];
            this.loadMoreProducts();
            this.updateResultsCount();
        } finally {
            // Clear message rotation interval
            if (messageInterval) {
                clearInterval(messageInterval);
            }

            // Hide AI loader overlay
            aiLoader.classList.remove('active');

            // Hide old loading indicator
            loadingIndicator.classList.remove('show');
        }
    }

    renderSplitResults(primaryResults, secondaryResults) {
        // Create split structure if it doesn't exist
        this.ensureSplitStructure();

        const primaryGrid = document.getElementById('primary-products-grid');
        const secondaryGrid = document.getElementById('secondary-products-grid');
        const divider = document.getElementById('results-divider');
        const secondarySection = document.getElementById('secondary-results');

        // Clear previous results
        primaryGrid.innerHTML = '';
        secondaryGrid.innerHTML = '';

        // Map results to full product objects
        const primaryProducts = primaryResults
            .map(result => this.findProductByUrl(result.id))
            .filter(p => p !== undefined);

        const secondaryProducts = secondaryResults
            .map(result => this.findProductByUrl(result.id))
            .filter(p => p !== undefined);

        // Render primary results
        primaryProducts.forEach(product => {
            const card = this.createProductCard(product);
            primaryGrid.appendChild(card);
        });

        // Render secondary results
        secondaryProducts.forEach(product => {
            const card = this.createProductCard(product);
            secondaryGrid.appendChild(card);
        });

        // Show divider and secondary section
        divider.style.display = 'block';
        secondarySection.style.display = 'block';

        // Store for pagination/filters
        this.filteredProducts = [...primaryProducts, ...secondaryProducts];
        this.displayedProducts = this.filteredProducts;

        // Update results count
        document.getElementById('results-count').textContent =
            `Showing ${this.filteredProducts.length} products (${primaryProducts.length} top matches)`;
    }

    renderUnifiedResults(results) {
        // Ensure normal structure (hide split elements)
        this.ensureNormalStructure();

        // Map results to full product objects
        this.filteredProducts = results
            .map(result => this.findProductByUrl(result.id))
            .filter(p => p !== undefined);

        // Reset pagination and display
        this.currentPage = 0;
        this.displayedProducts = [];
        this.loadMoreProducts();
        this.updateResultsCount();
    }

    findProductByUrl(url) {
        return this.allProducts.find(p => p.original_data?.item_page_url === url);
    }

    ensureSplitStructure() {
        const productsGrid = document.getElementById('products-grid');

        // Check if split structure already exists
        if (!document.getElementById('primary-products-grid')) {
            // Create split structure
            const container = document.createElement('div');
            container.id = 'products-container';
            container.innerHTML = `
                <div id="primary-results" class="primary-results-section">
                    <div class="products-grid" id="primary-products-grid"></div>
                </div>

                <div id="results-divider" class="results-divider" style="display: none;">
                    <div class="container">
                        <div class="results-divider-content">
                            <h3 class="results-divider-title">More Styles to Consider</h3>
                            <p class="results-divider-subtitle">These pieces share similar attributes and may inspire your curation</p>
                        </div>
                    </div>
                </div>

                <div id="secondary-results" class="secondary-results-section" style="display: none;">
                    <div class="container">
                        <div class="products-grid" id="secondary-products-grid"></div>
                    </div>
                </div>
            `;

            // Replace products-grid with new structure
            productsGrid.parentNode.replaceChild(container, productsGrid);
        }
    }

    ensureNormalStructure() {
        const divider = document.getElementById('results-divider');
        const secondarySection = document.getElementById('secondary-results');

        if (divider) divider.style.display = 'none';
        if (secondarySection) secondarySection.style.display = 'none';

        // Make sure primary grid exists and is used as the main grid
        const primaryGrid = document.getElementById('primary-products-grid');
        if (primaryGrid) {
            // Use primary grid as the main products grid
            const productsGrid = primaryGrid;
        }
    }

    loadMoreProducts() {
        if (this.isLoading) return;

        this.isLoading = true;
        const loadMoreBtn = document.getElementById('load-more-btn');
        const loadingIndicator = document.getElementById('loading-indicator');

        // Hide button and show elegant loading circle
        loadMoreBtn.style.display = 'none';
        loadingIndicator.classList.add('show');

        // Track load more event
        if (window.analytics && this.currentPage > 0) {
            window.analytics.trackEvent('click', 'load_more_button', {
                metadata: {
                    currentPage: this.currentPage,
                    displayedProductsCount: this.displayedProducts.length,
                    totalFilteredProducts: this.filteredProducts.length,
                    filtersActive: Object.keys(this.getActiveFilters()).length
                }
            });
        }

        setTimeout(() => {
            const startIndex = this.currentPage * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const newProducts = this.filteredProducts.slice(startIndex, endIndex);

            if (this.currentPage === 0) {
                this.displayedProducts = newProducts;
                this.renderProducts();
            } else {
                this.displayedProducts = [...this.displayedProducts, ...newProducts];
                this.appendProducts(newProducts);
            }

            this.currentPage++;

            const hasMoreProducts = endIndex < this.filteredProducts.length;

            // Hide loading circle
            loadingIndicator.classList.remove('show');

            // Show button again if there are more products
            loadMoreBtn.style.display = hasMoreProducts ? 'block' : 'none';

            this.isLoading = false;
        }, 300);
    }

    renderProducts() {
        const container = document.getElementById('products-grid');
        container.innerHTML = '';
        this.appendProducts(this.displayedProducts);
    }

    appendProducts(products) {
        const container = document.getElementById('products-grid');

        products.forEach(product => {
            const card = this.createProductCard(product);
            container.appendChild(card);
        });

        this.initializeImageSliders();
        this.initializeDesktopImageNavigation();
        this.initializeFavoriteButtons();

        // Update favorite button states after products are rendered
        if (window.favoritesManager) {
            window.favoritesManager.updateFavoriteButtons();
        }

        // Dispatch event that products have been rendered
        document.dispatchEvent(new CustomEvent('productsRendered'));
    }

    createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.addEventListener('click', (e) => {
            // Track product click
            if (window.analytics) {
                window.analytics.trackProductInteraction(product, 'click', {
                    positionInList: this.displayedProducts.indexOf(product),
                    metadata: {
                        currentPage: this.currentPage,
                        isFiltered: this.filteredProducts.length < this.allProducts.length,
                        searchQuery: this.filters.searchQuery || null
                    }
                });
            }
            window.open(product.original_data.item_page_url, '_blank');
        });

        const images = product.original_data.images_url || [];
        const validImages = images.filter(img => img && img.trim() !== '').slice(0, 6);

        card.innerHTML = `
            <div class="product-image-container">
                <div class="product-images" data-current="0" style="transform: translateX(0%)">
                    ${validImages.map((img, index) => `
                        <div class="product-image">
                            <img src="${img}" alt="${product.original_data.title}" loading="lazy" 
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik0xNTAgMjAwQzE2MS4wNDYgMjAwIDE3MCAyMDguOTU0IDE3MCAyMjBDMTcwIDIzMS4wNDYgMTYxLjA0NiAyNDAgMTUwIDI0MEMxMzguOTU0IDI0MCAxMzAgMjMxLjA0NiAxMzAgMjIwQzEzMCAyMDguOTU0IDEzOC45NTQgMjAwIDE1MCAyMDBaIiBmaWxsPSIjREREREREIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5OTk5IiBmb250LXNpemU9IjE0cHgiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'">
                        </div>
                    `).join('')}
                </div>
                ${validImages.length > 1 ? `
                    <button class="image-nav-arrow image-nav-prev" aria-label="Previous image" data-direction="prev">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="image-nav-arrow image-nav-next" aria-label="Next image" data-direction="next">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="image-counter">
                        <span class="current-image">1</span> / <span class="total-images">${validImages.length}</span>
                    </div>
                    <div class="image-controls">
                        ${validImages.map((_, index) => `
                            <div class="image-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="product-info">
                <div class="product-header">
                    <div class="product-text">
                        <div class="product-brand">${product.original_data.brand || ''}</div>
                        <div class="product-title">${this.toSentenceCase(product.original_data.title) || 'Untitled'}</div>
                        <div class="product-price">${product.original_data.price_eur ? `€${product.original_data.price_eur}` : 'Price not available'}</div>
                    </div>
                    <button class="favorite-btn" data-product-id="${product.id || product.original_data.item_page_url}"
                            aria-label="Add to favorites" title="Add to favorites">
                        <svg class="heart-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        return card;
    }

    initializeImageSliders() {
        document.querySelectorAll('.image-dot').forEach(dot => {
            if (!dot.hasAttribute('data-listener')) {
                dot.setAttribute('data-listener', 'true');
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.switchImage(dot);
                });
            }
        });
        
        // Add touch gesture support for mobile
        document.querySelectorAll('.product-image-container').forEach(container => {
            if (!container.hasAttribute('data-touch-listener')) {
                container.setAttribute('data-touch-listener', 'true');
                this.addTouchSupport(container);
            }
        });
    }

    switchImage(dot) {
        const index = parseInt(dot.dataset.index);
        const container = dot.closest('.product-image-container');

        // Track image navigation
        if (window.analytics) {
            const productCard = container.closest('.product-card');
            const productIndex = Array.from(document.querySelectorAll('.product-card')).indexOf(productCard);

            if (productIndex >= 0 && this.displayedProducts[productIndex]) {
                window.analytics.trackProductInteraction(
                    this.displayedProducts[productIndex],
                    'image_navigation',
                    {
                        imageIndex: index,
                        positionInList: productIndex
                    }
                );
            }
        }

        this.switchToImageIndex(container, index);
    }
    
    switchToImageIndex(container, index) {
        const imagesContainer = container.querySelector('.product-images');
        const dots = container.querySelectorAll('.image-dot');
        const totalImages = container.querySelectorAll('.product-image').length;

        // Clamp index to valid range
        index = Math.max(0, Math.min(index, totalImages - 1));

        // Update transform to show the selected image
        const translateX = -index * 100;
        imagesContainer.style.transform = `translateX(${translateX}%)`;
        imagesContainer.dataset.current = index;

        // Update dot indicators
        dots.forEach(d => d.classList.remove('active'));
        if (dots[index]) {
            dots[index].classList.add('active');
        }

        // Update arrow states and counter (for desktop navigation)
        this.updateArrowStatesForContainer(container);
        this.updateImageCounter(container, index + 1, totalImages);
    }

    initializeDesktopImageNavigation() {
        // Only initialize on desktop
        if (window.innerWidth < 1025) return;

        document.querySelectorAll('.image-nav-arrow').forEach(arrow => {
            if (!arrow.hasAttribute('data-desktop-listener')) {
                arrow.setAttribute('data-desktop-listener', 'true');
                arrow.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card click
                    this.navigateImage(arrow);
                });
            }
        });

        // Update arrow states for all cards
        this.updateArrowStates();
    }

    navigateImage(arrow) {
        const direction = arrow.dataset.direction; // 'prev' or 'next'
        const container = arrow.closest('.product-image-container');
        const imagesContainer = container.querySelector('.product-images');
        const currentIndex = parseInt(imagesContainer.dataset.current) || 0;
        const totalImages = container.querySelectorAll('.product-image').length;

        let newIndex = currentIndex;

        if (direction === 'prev' && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else if (direction === 'next' && currentIndex < totalImages - 1) {
            newIndex = currentIndex + 1;
        }

        if (newIndex !== currentIndex) {
            // Track analytics
            if (window.analytics) {
                const productCard = container.closest('.product-card');
                const productIndex = Array.from(document.querySelectorAll('.product-card')).indexOf(productCard);

                if (productIndex >= 0 && this.displayedProducts[productIndex]) {
                    window.analytics.trackProductInteraction(
                        this.displayedProducts[productIndex],
                        'image_navigation_desktop_arrow',
                        {
                            direction: direction,
                            fromIndex: currentIndex,
                            toIndex: newIndex,
                            positionInList: productIndex
                        }
                    );
                }
            }

            // Perform the switch
            this.switchToImageIndex(container, newIndex);
        }
    }

    updateArrowStatesForContainer(container) {
        const imagesContainer = container.querySelector('.product-images');
        const currentIndex = parseInt(imagesContainer.dataset.current) || 0;
        const totalImages = container.querySelectorAll('.product-image').length;

        const prevArrow = container.querySelector('.image-nav-prev');
        const nextArrow = container.querySelector('.image-nav-next');

        if (prevArrow) {
            prevArrow.disabled = (currentIndex === 0);
        }

        if (nextArrow) {
            nextArrow.disabled = (currentIndex === totalImages - 1);
        }
    }

    updateArrowStates() {
        document.querySelectorAll('.product-image-container').forEach(container => {
            this.updateArrowStatesForContainer(container);
        });
    }

    updateImageCounter(container, current, total) {
        const counter = container.querySelector('.image-counter');
        if (counter) {
            counter.querySelector('.current-image').textContent = current;
            counter.querySelector('.total-images').textContent = total;
        }
    }

    addTouchSupport(container) {
        let startX = 0;
        let startY = 0;
        let isDragging = false;
        let currentX = 0;
        let initialTransform = 0;
        
        const imagesContainer = container.querySelector('.product-images');
        const totalImages = container.querySelectorAll('.product-image').length;
        
        if (totalImages <= 1) return; // No need for touch support with single image
        
        const handleTouchStart = (e) => {
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            
            const currentIndex = parseInt(imagesContainer.dataset.current) || 0;
            initialTransform = -currentIndex * 100;
            
            // Disable transition during touch
            imagesContainer.style.transition = 'none';
        };
        
        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            
            // Check if this is a horizontal swipe (not vertical scroll)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                e.preventDefault(); // Prevent vertical scroll
                
                const containerWidth = container.offsetWidth;
                const dragPercentage = (deltaX / containerWidth) * 100;
                const newTransform = initialTransform + dragPercentage;
                
                // Apply transform with some resistance at boundaries
                const currentIndex = parseInt(imagesContainer.dataset.current) || 0;
                const maxTransform = -(totalImages - 1) * 100;
                
                let clampedTransform = newTransform;
                if (newTransform > 0) {
                    clampedTransform = newTransform * 0.3; // Resistance at start
                } else if (newTransform < maxTransform) {
                    clampedTransform = maxTransform + (newTransform - maxTransform) * 0.3; // Resistance at end
                }
                
                imagesContainer.style.transform = `translateX(${clampedTransform}%)`;
            }
        };
        
        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            // Re-enable transition
            imagesContainer.style.transition = 'transform 0.3s ease';
            
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - startX;
            const threshold = container.offsetWidth * 0.2; // 20% of container width
            
            const currentIndex = parseInt(imagesContainer.dataset.current) || 0;
            let newIndex = currentIndex;
            
            if (Math.abs(deltaX) > threshold) {
                if (deltaX > 0 && currentIndex > 0) {
                    newIndex = currentIndex - 1; // Swipe right = previous image
                } else if (deltaX < 0 && currentIndex < totalImages - 1) {
                    newIndex = currentIndex + 1; // Swipe left = next image
                }
            }
            
            this.switchToImageIndex(container, newIndex);
        };
        
        // Add touch event listeners
        imagesContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        imagesContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        imagesContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    initializeFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            if (!btn.hasAttribute('data-listener')) {
                btn.setAttribute('data-listener', 'true');
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent product card click
                    this.handleFavoriteClick(btn);
                });
            }
        });
    }

    async handleFavoriteClick(btn) {
        const productId = btn.dataset.productId;

        // Check if user is authenticated
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            // Show login modal
            if (window.authUI) {
                window.authUI.showModal('login');
            } else {
                alert('Please log in to add favorites');
            }
            return;
        }

        // Check if favorites manager is available
        if (!window.favoritesManager) {
            console.warn('Favorites manager not available');
            return;
        }

        try {
            const isFavorited = btn.classList.contains('favorited');

            if (isFavorited) {
                await window.favoritesManager.removeFavorite(productId);
                btn.classList.remove('favorited');
                btn.setAttribute('aria-label', 'Add to favorites');
                btn.setAttribute('title', 'Add to favorites');
            } else {
                await window.favoritesManager.addFavorite(productId);
                btn.classList.add('favorited');
                btn.setAttribute('aria-label', 'Remove from favorites');
                btn.setAttribute('title', 'Remove from favorites');
            }

            // Track analytics
            if (window.analytics) {
                window.analytics.trackEvent('click', isFavorited ? 'remove_favorite' : 'add_favorite', {
                    productId: productId,
                    metadata: {
                        userId: window.authManager.getUserId()
                    }
                });
            }
        } catch (error) {
            console.error('Error handling favorite:', error);
            alert('Error updating favorites. Please try again.');
        }
    }

    clearAllFilters() {
        this.filters.brands.clear();
        this.filters.categories.clear();
        this.filters.attributes = {};
        this.filters.priceMin = null;
        this.filters.priceMax = null;
        this.filters.searchQuery = '';

        // Reset all checkboxes
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset price inputs
        document.getElementById('min-price').value = '';
        document.getElementById('max-price').value = '';

        // Reset search input
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear').style.display = 'none';

        // Remove dynamic attribute filters
        const existingFilters = document.querySelectorAll('.dynamic-filter-container');
        existingFilters.forEach(filter => filter.remove());

        this.updateFilterButtons();
        this.applyFilters();
    }

    updateResultsCount() {
        const count = this.filteredProducts.length;
        document.getElementById('results-count').textContent = 
            `Showing ${count} products`;
    }

    formatCategoryName(category) {
        return category.replace(/_/g, ' ')
                      .replace(/\b\w/g, l => l.toUpperCase());
    }

    formatAttributeName(attr) {
        return attr.replace(/_/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase());
    }

    formatAttributeValue(value) {
        if (!value) return '';
        return value.replace(/_/g, ' ')
                   .toLowerCase()
                   .replace(/\b\w/g, l => l.toUpperCase());
    }

    getActiveFilters() {
        const activeFilters = {};

        if (this.filters.brands.size > 0) {
            activeFilters.brands = Array.from(this.filters.brands);
        }

        if (this.filters.categories.size > 0) {
            activeFilters.categories = Array.from(this.filters.categories);
        }

        if (this.filters.priceMin !== null || this.filters.priceMax !== null) {
            activeFilters.price = {
                min: this.filters.priceMin,
                max: this.filters.priceMax
            };
        }

        if (Object.keys(this.filters.attributes).length > 0) {
            activeFilters.attributes = {};
            Object.entries(this.filters.attributes).forEach(([key, values]) => {
                activeFilters.attributes[key] = Array.from(values);
            });
        }

        if (this.filters.searchQuery) {
            activeFilters.search = this.filters.searchQuery;
        }

        return activeFilters;
    }
}

// Initialize AI Loader Accessibility
function initializeAILoader() {
    const aiLoader = document.getElementById('ai-search-loader');
    if (!aiLoader) return;

    // Handle body scroll locking when loader is active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (aiLoader.classList.contains('active')) {
                    // Prevent body scroll when loader is active
                    document.body.style.overflow = 'hidden';
                } else {
                    // Restore body scroll when loader is hidden
                    document.body.style.overflow = '';
                }
            }
        });
    });

    observer.observe(aiLoader, { attributes: true });

    // Optional: Allow ESC key to be handled gracefully (though we don't cancel searches)
    // This is just for accessibility - announce to screen readers
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiLoader.classList.contains('active')) {
            // Don't actually cancel the search, but announce for accessibility
            console.log('Search in progress - please wait for completion');
        }
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize analytics if configured
    if (window.CONFIG && window.CONFIG.ANALYTICS_ENABLED) {
        try {
            window.analytics = initializeAnalytics(
                window.CONFIG.SUPABASE_URL,
                window.CONFIG.SUPABASE_ANON_KEY
            );

            if (window.CONFIG.DEBUG_MODE) {
                console.log('Analytics initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize analytics:', error);
        }
    }

    // Initialize authentication system
    if (window.CONFIG && window.CONFIG.AUTH_ENABLED) {
        try {
            await initializeAuth();
            if (window.CONFIG.DEBUG_MODE) {
                console.log('Authentication system initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize authentication:', error);
        }
    }

    // Initialize favorites system (depends on auth)
    if (window.CONFIG && window.CONFIG.AUTH_ENABLED) {
        try {
            await initializeFavorites();
            if (window.CONFIG.DEBUG_MODE) {
                console.log('Favorites system initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize favorites:', error);
        }
    }

    // Initialize AI Loader
    initializeAILoader();

    window.fashionCatalogue = new FashionCatalogue();
});