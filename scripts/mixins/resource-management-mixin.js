/**
 * Resource Management Mixin
 * Handles selling resources, cargo management, and resource selection
 */

const ResourceManagementMixin = {
    /**
     * Populate selling tab with ALL available cargo types from all settlements
     * @private
     */
    _populateSellingResources() {
        console.log('🛒 POPULATING ALL SELLABLE RESOURCES');
        
        const resourceButtonsContainer = this.element.querySelector('#resource-buttons');
        if (!resourceButtonsContainer) {
            console.error('❌ Resource buttons container not found');
            return;
        }
        
        // Clear existing buttons
        resourceButtonsContainer.innerHTML = '';
        
        // Get ALL unique trading goods from settlement source lists
        const allTradingGoods = this._getAllTradingGoods();
        console.log(`📦 Found ${allTradingGoods.length} unique trading goods:`, allTradingGoods);
        
        allTradingGoods.forEach(goodName => {
            const button = document.createElement('button');
            button.className = 'resource-btn';
            button.textContent = goodName;
            button.dataset.resource = goodName;
            
            // Add click handler for resource selection
            button.addEventListener('click', () => this._onSellingResourceSelect(goodName));
            
            resourceButtonsContainer.appendChild(button);
        });
        
        this._logInfo('Selling Resources', `Populated ${allTradingGoods.length} sellable resources`);
    },

    /**
     * Get all unique trading goods from all settlements
     * @returns {Array} Array of unique trading good names
     * @private
     */
    _getAllTradingGoods() {
        if (!this.dataManager) {
            console.error('❌ DataManager not available');
            return [];
        }
        
        try {
            const allSettlements = this.dataManager.getAllSettlements();
            const uniqueGoods = new Set();
            
            allSettlements.forEach(settlement => {
                if (settlement.sources && Array.isArray(settlement.sources)) {
                    settlement.sources.forEach(source => {
                        if (source && typeof source === 'string') {
                            uniqueGoods.add(source);
                        }
                    });
                }
            });
            
            // Convert to sorted array
            return Array.from(uniqueGoods).sort();
            
        } catch (error) {
            console.error('❌ Error getting trading goods:', error);
            return [];
        }
    },

    /**
     * Handle resource selection for selling
     * @param {string} resourceName - Name of selected resource
     * @private
     */
    _onSellingResourceSelect(resourceName) {
        console.log(`🎯 RESOURCE SELECTED: ${resourceName}`);
        
        this.selectedResource = resourceName;
        
        // Update UI to show selected resource
        const resourceButtons = this.element.querySelectorAll('.resource-btn');
        resourceButtons.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.resource === resourceName) {
                btn.classList.add('selected');
            }
        });
        
        // Update selling quantity controls
        const quantitySection = this.element.querySelector('.selling-quantity-section');
        if (quantitySection) {
            quantitySection.style.display = 'block';
        }
        
        // Update resource name display
        const resourceNameDisplay = this.element.querySelector('.selected-resource-name');
        if (resourceNameDisplay) {
            resourceNameDisplay.textContent = resourceName;
        }
        
        this._logInfo('Resource Selection', `Selected resource: ${resourceName}`);
        
        // Enable selling controls
        this._updateSellingControls();
    },

    /**
     * Update selling controls based on current selection
     * @private
     */
    _updateSellingControls() {
        const hasResource = !!this.selectedResource;
        const hasSettlement = !!this.selectedSettlement;
        const hasSeason = !!this.currentSeason;
        
        // Enable/disable sell button
        const sellButton = this.element.querySelector('.sell-resource-btn');
        if (sellButton) {
            sellButton.disabled = !hasResource || !hasSettlement || !hasSeason;
        }
        
        // Enable/disable quantity input
        const quantityInput = this.element.querySelector('.selling-quantity-input');
        if (quantityInput) {
            quantityInput.disabled = !hasResource || !hasSettlement || !hasSeason;
        }
        
        this._logDebug('Selling Controls', 'Updated selling controls', {
            hasResource,
            hasSettlement,
            hasSeason
        });
    }
};

// Export the mixin
window.ResourceManagementMixin = ResourceManagementMixin;