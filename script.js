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
        this.searchTimeout = null;
        this.searchIndex = [];
        this.stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

        // Analytics tracking
        this.searchStartTime = null;

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderFilters();
        this.applyFilters();
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
        
        // Build search index for better performance
        this.buildSearchIndex();
    }

    // Advanced Search Engine Methods
    normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
            .replace(/[-_]/g, ' ')     // Convert hyphens/underscores to spaces  
            .replace(/\s+/g, ' ')      // Normalize multiple spaces
            .trim();
    }

    tokenize(text) {
        if (!text) return [];
        return this.normalizeText(text)
            .split(' ')
            .filter(token => token.length > 1)  // Remove single characters
            .filter(token => !this.stopWords.has(token)); // Remove stop words
    }

    buildSearchIndex() {
        this.searchIndex = this.allProducts.map((product, index) => ({
            productIndex: index,
            titleTokens: this.tokenize(product.original_data?.title),
            descriptionTokens: this.tokenize(product.original_data?.description),
            normalizedTitle: this.normalizeText(product.original_data?.title),
            normalizedDescription: this.normalizeText(product.original_data?.description),
            allTokens: [
                ...this.tokenize(product.original_data?.title || ''),
                ...this.tokenize(product.original_data?.description || '')
            ]
        }));
        console.log(`Built search index for ${this.searchIndex.length} products`);
    }

    calculateRelevanceScore(searchTokens, productIndex) {
        const product = this.searchIndex[productIndex];
        let score = 0;
        let matchedTerms = 0;

        searchTokens.forEach(searchToken => {
            let termScore = 0;
            let termMatched = false;

            // Exact title matches (highest weight)
            if (product.titleTokens.includes(searchToken)) {
                termScore += 3;
                termMatched = true;
            }

            // Fuzzy title matches
            product.titleTokens.forEach(titleToken => {
                if (this.fuzzyMatch(searchToken, titleToken)) {
                    termScore += 2;
                    termMatched = true;
                }
            });

            // Exact description matches
            if (product.descriptionTokens.includes(searchToken)) {
                termScore += 1;
                termMatched = true;
            }

            // Fuzzy description matches
            product.descriptionTokens.forEach(descToken => {
                if (this.fuzzyMatch(searchToken, descToken)) {
                    termScore += 0.5;
                    termMatched = true;
                }
            });

            // Phrase matching bonus
            if (product.normalizedTitle.includes(searchToken)) {
                termScore += 1;
                termMatched = true;
            }
            if (product.normalizedDescription.includes(searchToken)) {
                termScore += 0.5;
                termMatched = true;
            }

            if (termMatched) {
                matchedTerms++;
                score += termScore;
            }
        });

        // Coverage bonus: reward products that match more search terms
        const coverageBonus = (matchedTerms / searchTokens.length) * 2;
        score += coverageBonus;

        return {
            score: score,
            matchedTerms: matchedTerms,
            totalTerms: searchTokens.length,
            coverage: matchedTerms / searchTokens.length
        };
    }

    fuzzyMatch(term1, term2, threshold = 0.8) {
        if (term1 === term2) return true;
        if (term1.length < 3 || term2.length < 3) return false;
        
        // Simple fuzzy matching: check if one term contains the other (partial matching)
        if (term1.includes(term2) || term2.includes(term1)) return true;
        
        // Levenshtein distance for typo tolerance
        const distance = this.levenshteinDistance(term1, term2);
        const maxLength = Math.max(term1.length, term2.length);
        const similarity = 1 - (distance / maxLength);
        
        return similarity >= threshold;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    performAdvancedSearch(query) {
        if (!query || query.trim().length === 0) {
            return this.allProducts.map((_, index) => ({ product: this.allProducts[index], score: 0 }));
        }

        const searchTokens = this.tokenize(query);
        if (searchTokens.length === 0) {
            return this.allProducts.map((_, index) => ({ product: this.allProducts[index], score: 0 }));
        }

        // Calculate relevance scores for all products
        const results = [];
        this.searchIndex.forEach((indexedProduct, searchIndex) => {
            const relevance = this.calculateRelevanceScore(searchTokens, searchIndex);
            
            // Only include products with some relevance (at least one matching term)
            if (relevance.matchedTerms > 0) {
                results.push({
                    product: this.allProducts[indexedProduct.productIndex],
                    score: relevance.score,
                    matchedTerms: relevance.matchedTerms,
                    coverage: relevance.coverage
                });
            }
        });

        // Sort by relevance score (highest first)
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            // If scores are equal, prefer higher coverage
            if (b.coverage !== a.coverage) return b.coverage - a.coverage;
            // Finally, maintain confidence-based sorting
            return (b.product.confidence_score || 0) - (a.product.confidence_score || 0);
        });

        return results;
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

        // Clear all filters
        document.getElementById('clear-all-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Load more button
        document.getElementById('load-more-btn').addEventListener('click', () => {
            this.loadMoreProducts();
        });

        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Search clear button
        document.getElementById('search-clear').addEventListener('click', () => {
            this.clearSearch();
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('search-input').focus();
            }
            
            // Escape to clear search when search input is focused
            if (e.key === 'Escape' && document.activeElement === document.getElementById('search-input')) {
                if (this.filters.searchQuery) {
                    this.clearSearch();
                }
            }
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

    handleSearch(query) {
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Show/hide clear button
        const clearButton = document.getElementById('search-clear');
        if (query.length > 0) {
            clearButton.style.display = 'block';
            this.searchStartTime = new Date();
        } else {
            clearButton.style.display = 'none';
            this.searchStartTime = null;
        }

        // Debounce search - wait 300ms after user stops typing
        this.searchTimeout = setTimeout(() => {
            this.filters.searchQuery = query.toLowerCase().trim();
            this.applyFilters();
            this.updateSearchResultsInfo();

            // Track search event
            if (window.analytics && query.trim().length > 0) {
                const duration = this.searchStartTime ? new Date() - this.searchStartTime : null;
                window.analytics.trackSearch(
                    query.trim(),
                    this.filteredProducts.length,
                    duration,
                    false
                );
            }
        }, 300);
    }

    clearSearch() {
        const searchInput = document.getElementById('search-input');
        const clearButton = document.getElementById('search-clear');

        const previousQuery = this.filters.searchQuery;

        searchInput.value = '';
        clearButton.style.display = 'none';
        this.filters.searchQuery = '';

        this.applyFilters();
        this.updateSearchResultsInfo();

        // Track search clear event
        if (window.analytics && previousQuery) {
            window.analytics.trackSearch(previousQuery, 0, null, true);
        }
    }

    updateSearchResultsInfo() {
        const searchResultsInfo = document.getElementById('search-results-info');
        
        if (this.filters.searchQuery && this.filters.searchQuery.trim().length > 0) {
            const resultCount = this.filteredProducts.length;
            const searchTokens = this.tokenize(this.filters.searchQuery);
            
            let infoText = `${resultCount} results for "${this.filters.searchQuery}"`;
            
            if (searchTokens.length > 1) {
                infoText += ` (searching: ${searchTokens.join(', ')})`;
            }
            
            if (resultCount === 0) {
                const suggestions = this.generateSearchSuggestions(this.filters.searchQuery);
                if (suggestions.length > 0) {
                    infoText += `. Did you mean: ${suggestions.slice(0, 3).join(', ')}?`;
                }
            }
            
            searchResultsInfo.textContent = infoText;
        } else {
            searchResultsInfo.textContent = '';
        }
    }

    generateSearchSuggestions(query) {
        // Simple suggestion system - find similar terms in the product index
        const suggestions = new Set();
        const normalizedQuery = this.normalizeText(query);
        const queryTokens = this.tokenize(query);
        
        // Look for similar tokens in our search index
        this.searchIndex.forEach(product => {
            product.allTokens.forEach(token => {
                queryTokens.forEach(queryToken => {
                    // Suggest tokens that are similar but not identical
                    if (token !== queryToken && this.fuzzyMatch(queryToken, token, 0.7)) {
                        suggestions.add(token);
                    }
                    // Also suggest tokens that contain the query token
                    if (token.length > queryToken.length && token.includes(queryToken)) {
                        suggestions.add(token);
                    }
                });
            });
        });

        return Array.from(suggestions).slice(0, 5);
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

    applyFilters() {
        // Start with search results if there's a search query
        let productsToFilter;
        
        if (this.filters.searchQuery && this.filters.searchQuery.trim().length > 0) {
            // Use advanced search to get relevance-ranked results
            const searchResults = this.performAdvancedSearch(this.filters.searchQuery);
            productsToFilter = searchResults.map(result => result.product);
            console.log(`Advanced search for "${this.filters.searchQuery}" found ${productsToFilter.length} results`);
        } else {
            // No search query, start with all products (sorted by confidence)
            productsToFilter = [...this.allProducts];
        }

        // Apply other filters to the search results
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

    loadMoreProducts() {
        if (this.isLoading) return;

        this.isLoading = true;
        document.getElementById('loading-indicator').style.display = 'block';

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
            document.getElementById('load-more-btn').style.display = hasMoreProducts ? 'block' : 'none';
            document.getElementById('loading-indicator').style.display = 'none';

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
                    <div class="image-controls">
                        ${validImages.map((_, index) => `
                            <div class="image-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="product-info">
                <div class="product-brand">${product.original_data.brand || ''}</div>
                <div class="product-title">${product.original_data.title || 'Untitled'}</div>
                <div class="product-price">${product.original_data.price_eur ? `€${product.original_data.price_eur}` : 'Price not available'}</div>
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
        this.updateSearchResultsInfo();
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
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

    window.fashionCatalogue = new FashionCatalogue();
});