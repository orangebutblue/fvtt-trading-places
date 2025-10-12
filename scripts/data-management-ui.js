/**
 * Trading Places Module - Data Management UI
 * Provides in-Foundry editing capabilities for settlements and cargo types
 */

console.log('Trading Places | Loading data-management-ui.js');

/**
 * Data Management Application class
 */
class DataManagementApp extends Application {
    constructor(dataManager, options = {}) {
        super(options);
        this.dataManager = dataManager;
        this.currentTab = 'settlements';
        this.selectedItem = null;
        this.changes = new Map();
        this.originalData = new Map();
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: 'trading-data-management',
            title: 'Trading Data Management',
            template: 'modules/trading-places/templates/data-management.hbs',
            classes: ['trading-places', 'data-management'],
            width: 1200,
            height: 800,
            resizable: true,
            tabs: [
                { navSelector: '.nav-tabs', contentSelector: '.data-management-content', initial: 'settlements' }
            ]
        });
    }

    async getData() {
        const data = await super.getData();
        
        // Load all required data
        await this.dataManager.loadSettlements();
        await this.dataManager.loadCargoTypes();
        await this.dataManager.loadSourceFlags();
        await this.dataManager.loadTradingConfig();

        const settlements = this.dataManager.getSettlements();
        const cargoTypes = this.dataManager.getCargoTypes();
        const sourceFlags = this.dataManager.sourceFlags || {};
        
        // Extract unique regions and categories
        const regions = [...new Set(settlements.map(s => s.region))].sort();
        const cargoCategories = [...new Set(cargoTypes.map(c => c.category).filter(Boolean))].sort();

        return {
            ...data,
            settlements,
            cargoTypes,
            availableFlags: sourceFlags,
            regions,
            cargoCategories,
            currentTab: this.currentTab,
            hasChanges: this.changes.size > 0,
            changesCount: this.changes.size
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Tab navigation
        html.find('.nav-tab').click(this._onTabClick.bind(this));

        // List item selection
        html.find('.settlement-item').click(this._onSettlementSelect.bind(this));
        html.find('.cargo-item').click(this._onCargoSelect.bind(this));

        // Search and filter
        html.find('.search-input').on('input', this._onSearch.bind(this));
        html.find('.region-filter, .category-filter').change(this._onFilter.bind(this));

        // Form controls
        html.find('.settlement-form input, .settlement-form select, .settlement-form textarea')
            .on('input change', this._onFieldChange.bind(this));
        html.find('.cargo-form input, .cargo-form select, .cargo-form textarea')
            .on('input change', this._onFieldChange.bind(this));

        // Population to size calculation
        html.find('#settlement-population').on('input', this._onPopulationChange.bind(this));

        // Garrison strength calculation
        html.find('[id^="garrison-"]').on('input', this._updateGarrisonStrength.bind(this));

        // Flag selection
        html.find('.flag-option input[type="checkbox"]').change(this._onFlagChange.bind(this));

        // Cargo selector for produces/demands
        html.find('.cargo-selector').change(this._onCargoSelectorChange.bind(this));

        // Tag removal
        html.find('.tag-remove').click(this._onTagRemove.bind(this));

        // Action buttons
        html.find('.create-new-btn').click(this._onCreateNew.bind(this));
        html.find('.duplicate-btn').click(this._onDuplicate.bind(this));
        html.find('.delete-btn').click(this._onDelete.bind(this));
        html.find('.save-btn').click(this._onSave.bind(this));
        html.find('.revert-btn').click(this._onRevert.bind(this));

        // Footer actions
        html.find('.preview-changes-btn').click(this._onPreviewChanges.bind(this));
        html.find('.save-all-btn').click(this._onSaveAll.bind(this));
        html.find('.discard-all-btn').click(this._onDiscardAll.bind(this));

        // Header actions
        html.find('.export-data-btn').click(this._onExportData.bind(this));
        html.find('.import-data-btn').click(this._onImportData.bind(this));
        html.find('.refresh-data-btn').click(this._onRefreshData.bind(this));

        // Modal controls
        html.find('.modal-close, .cancel-btn').click(this._onCloseModal.bind(this));
        html.find('.confirm-save-btn').click(this._onConfirmSave.bind(this));

        // Initialize UI state
        this._updateUIState(html);
    }

    _onTabClick(event) {
        event.preventDefault();
        const tab = $(event.currentTarget).data('tab');
        this._switchTab(tab);
    }

    _switchTab(tab) {
        if (this.changes.size > 0) {
            Dialog.confirm({
                title: 'Unsaved Changes',
                content: 'You have unsaved changes. Switching tabs will discard them. Continue?',
                yes: () => {
                    this.changes.clear();
                    this.originalData.clear();
                    this.currentTab = tab;
                    this.render();
                }
            });
        } else {
            this.currentTab = tab;
            this.render();
        }
    }

    _onSettlementSelect(event) {
        const settlementName = $(event.currentTarget).data('id');
        this._selectSettlement(settlementName);
    }

    _onCargoSelect(event) {
        const cargoName = $(event.currentTarget).data('id');
        this._selectCargo(cargoName);
    }

    _selectSettlement(name) {
        const settlement = this.dataManager.getSettlements().find(s => s.name === name);
        if (!settlement) return;

        this.selectedItem = settlement;
        this.originalData.set(name, foundry.utils.deepClone(settlement));
        this._populateSettlementForm(settlement);
        this._updateUIState();
    }

    _selectCargo(name) {
        const cargo = this.dataManager.getCargoTypes().find(c => c.name === name);
        if (!cargo) return;

        this.selectedItem = cargo;
        this.originalData.set(name, foundry.utils.deepClone(cargo));
        this._populateCargoForm(cargo);
        this._updateUIState();
    }

    _populateSettlementForm(settlement) {
        const form = this.element.find('.settlement-form');
        
        // Basic fields
        form.find('#settlement-name').val(settlement.name);
        form.find('#settlement-region').val(settlement.region);
        form.find('#settlement-population').val(settlement.population);
        form.find('#settlement-size').val(settlement.size);
        form.find('#settlement-wealth').val(settlement.wealth);
        form.find('#settlement-ruler').val(settlement.ruler || '');
        form.find('#settlement-notes').val(settlement.notes || '');

        // Flags
        form.find('.flag-option input[type="checkbox"]').prop('checked', false);
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                form.find(`#flag-${flag}`).prop('checked', true);
            });
        }

        // Produces and Demands tags
        this._updateTagList('produces', settlement.produces || []);
        this._updateTagList('demands', settlement.demands || []);

        // Garrison
        form.find('#garrison-a').val(settlement.garrison?.a || 0);
        form.find('#garrison-b').val(settlement.garrison?.b || 0);
        form.find('#garrison-c').val(settlement.garrison?.c || 0);
        this._updateGarrisonStrength();

        // Show form
        form.show();
        this.element.find('.no-selection-message').hide();
    }

    _populateCargoForm(cargo) {
        const form = this.element.find('.cargo-form');
        
        // Basic fields
        form.find('#cargo-name').val(cargo.name);
        form.find('#cargo-category').val(cargo.category || '');
        form.find('#cargo-base-price').val(cargo.basePrice);
        form.find('#cargo-description').val(cargo.description || '');

        // Seasonal modifiers
        const seasonal = cargo.seasonalModifiers || {};
        form.find('#seasonal-spring').val(seasonal.spring || 1);
        form.find('#seasonal-summer').val(seasonal.summer || 1);
        form.find('#seasonal-autumn').val(seasonal.autumn || 1);
        form.find('#seasonal-winter').val(seasonal.winter || 1);

        // Show form
        form.show();
        this.element.find('.no-selection-message').hide();
    }

    _onFieldChange(event) {
        if (!this.selectedItem) return;

        const field = $(event.target);
        const fieldName = field.attr('name');
        const value = this._getFieldValue(field);

        // Track change
        const itemKey = this.selectedItem.name;
        if (!this.changes.has(itemKey)) {
            this.changes.set(itemKey, {});
        }
        
        const changes = this.changes.get(itemKey);
        foundry.utils.setProperty(changes, fieldName, value);

        // Update selected item
        foundry.utils.setProperty(this.selectedItem, fieldName, value);

        // Special handling for population -> size calculation
        if (fieldName === 'population') {
            this._onPopulationChange(event);
        }

        this._updateUIState();
    }

    _getFieldValue(field) {
        const type = field.attr('type');
        
        if (type === 'number') {
            const val = parseFloat(field.val());
            return isNaN(val) ? 0 : val;
        } else if (type === 'checkbox') {
            return field.prop('checked');
        } else {
            return field.val();
        }
    }

    _onPopulationChange(event) {
        const population = parseInt($(event.target).val()) || 0;
        const size = this._calculateSizeFromPopulation(population);
        
        this.element.find('#settlement-size').val(size);
        
        if (this.selectedItem) {
            this.selectedItem.size = size;
            const itemKey = this.selectedItem.name;
            if (!this.changes.has(itemKey)) {
                this.changes.set(itemKey, {});
            }
            this.changes.get(itemKey).size = size;
        }
    }

    _calculateSizeFromPopulation(population) {
        const thresholds = this.dataManager.config?.populationThresholds;
        if (!thresholds) return 1;

        for (let size = 1; size <= 5; size++) {
            const threshold = thresholds[size.toString()];
            if (threshold && population >= threshold.min && population <= threshold.max) {
                return size;
            }
        }
        return 1;
    }

    _updateGarrisonStrength() {
        const a = parseInt(this.element.find('#garrison-a').val()) || 0;
        const b = parseInt(this.element.find('#garrison-b').val()) || 0;
        const c = parseInt(this.element.find('#garrison-c').val()) || 0;
        
        const strength = (a * 3) + (b * 2) + (c * 1);
        this.element.find('#garrison-strength').text(strength);
    }

    _onFlagChange(event) {
        if (!this.selectedItem) return;

        const flags = [];
        this.element.find('.flag-option input[type="checkbox"]:checked').each((i, el) => {
            flags.push($(el).val());
        });

        this.selectedItem.flags = flags;
        
        const itemKey = this.selectedItem.name;
        if (!this.changes.has(itemKey)) {
            this.changes.set(itemKey, {});
        }
        this.changes.get(itemKey).flags = flags;

        this._updateUIState();
    }

    _onCargoSelectorChange(event) {
        const selector = $(event.target);
        const target = selector.data('target');
        const cargoType = selector.val();
        
        if (!cargoType || !this.selectedItem) return;

        // Add to the target array
        if (!this.selectedItem[target]) {
            this.selectedItem[target] = [];
        }
        
        if (!this.selectedItem[target].includes(cargoType)) {
            this.selectedItem[target].push(cargoType);
            this._updateTagList(target, this.selectedItem[target]);
            
            // Track change
            const itemKey = this.selectedItem.name;
            if (!this.changes.has(itemKey)) {
                this.changes.set(itemKey, {});
            }
            this.changes.get(itemKey)[target] = this.selectedItem[target];
            
            this._updateUIState();
        }
        
        // Reset selector
        selector.val('');
    }

    _updateTagList(target, items) {
        const container = this.element.find(`#${target}-tags`);
        container.empty();
        
        items.forEach(item => {
            const tag = $(`
                <div class="tag-item">
                    ${item}
                    <span class="tag-remove" data-target="${target}" data-value="${item}">×</span>
                </div>
            `);
            container.append(tag);
        });
        
        // Rebind removal handlers
        container.find('.tag-remove').click(this._onTagRemove.bind(this));
    }

    _onTagRemove(event) {
        event.preventDefault();
        if (!this.selectedItem) return;

        const target = $(event.target).data('target');
        const value = $(event.target).data('value');
        
        if (this.selectedItem[target]) {
            const index = this.selectedItem[target].indexOf(value);
            if (index >= 0) {
                this.selectedItem[target].splice(index, 1);
                this._updateTagList(target, this.selectedItem[target]);
                
                // Track change
                const itemKey = this.selectedItem.name;
                if (!this.changes.has(itemKey)) {
                    this.changes.set(itemKey, {});
                }
                this.changes.get(itemKey)[target] = this.selectedItem[target];
                
                this._updateUIState();
            }
        }
    }

    _updateUIState() {
        const hasChanges = this.changes.size > 0;
        const hasSelection = !!this.selectedItem;
        
        // Update button states
        this.element.find('.save-btn').prop('disabled', !hasSelection || !this.changes.has(this.selectedItem?.name));
        this.element.find('.revert-btn').prop('disabled', !hasSelection || !this.changes.has(this.selectedItem?.name));
        this.element.find('.duplicate-btn').prop('disabled', !hasSelection);
        this.element.find('.delete-btn').prop('disabled', !hasSelection);
        
        // Update changes summary
        const changesContainer = this.element.find('.changes-summary');
        if (hasChanges) {
            changesContainer.show();
            changesContainer.find('.changes-count').text(this.changes.size);
        } else {
            changesContainer.hide();
        }
    }

    async _onSave() {
        if (!this.selectedItem) return;
        
        try {
            const itemKey = this.selectedItem.name;
            const changes = this.changes.get(itemKey);
            
            if (!changes) return;
            
            // Validate before saving
            const validation = this._validateItem(this.selectedItem);
            if (!validation.valid) {
                ui.notifications.error(`Validation failed: ${validation.errors.join(', ')}`);
                this._showValidationErrors(validation.errors);
                return;
            }
            
            // Save via DataManager
            if (this.currentTab === 'settlements') {
                await this.dataManager.updateSettlement(this.selectedItem);
            } else if (this.currentTab === 'cargo-types') {
                await this.dataManager.updateCargoType(this.selectedItem);
            }
            
            // Clear changes for this item
            this.changes.delete(itemKey);
            this.originalData.set(itemKey, foundry.utils.deepClone(this.selectedItem));
            
            ui.notifications.info(`${this.selectedItem.name} saved successfully`);
            this._updateUIState();
            
        } catch (error) {
            console.error('Save failed:', error);
            ui.notifications.error(`Save failed: ${error.message}`);
        }
    }

    _validateItem(item) {
        const result = { valid: true, errors: [] };
        
        if (this.currentTab === 'settlements') {
            return this.dataManager.validateSettlement(item);
        } else if (this.currentTab === 'cargo-types') {
            return this.dataManager.validateCargoType(item);
        }
        
        return result;
    }

    _showValidationErrors(errors) {
        // Clear existing errors
        this.element.find('.field-error').hide().text('');
        this.element.find('.form-group').removeClass('error');
        
        // Show new errors (simplified - would need field mapping)
        errors.forEach(error => {
            console.warn('Validation error:', error);
        });
    }

    _onRevert() {
        if (!this.selectedItem) return;
        
        const itemKey = this.selectedItem.name;
        const original = this.originalData.get(itemKey);
        
        if (original) {
            this.selectedItem = foundry.utils.deepClone(original);
            this.changes.delete(itemKey);
            
            if (this.currentTab === 'settlements') {
                this._populateSettlementForm(this.selectedItem);
            } else if (this.currentTab === 'cargo-types') {
                this._populateCargoForm(this.selectedItem);
            }
            
            this._updateUIState();
        }
    }

    async _onCreateNew() {
        const name = await this._promptForName();
        if (!name) return;
        
        let newItem;
        if (this.currentTab === 'settlements') {
            newItem = {
                region: 'New Region',
                name: name,
                population: 100,
                size: 1,
                ruler: '',
                wealth: 3,
                flags: [],
                produces: [],
                demands: [],
                garrison: { a: 0, b: 0, c: 0 },
                notes: ''
            };
        } else if (this.currentTab === 'cargo-types') {
            newItem = {
                name: name,
                category: '',
                description: '',
                basePrice: 1,
                seasonalModifiers: {
                    spring: 1,
                    summer: 1,
                    autumn: 1,
                    winter: 1
                }
            };
        }
        
        if (newItem) {
            this.selectedItem = newItem;
            this.changes.set(name, foundry.utils.deepClone(newItem));
            this.originalData.set(name, {});
            
            if (this.currentTab === 'settlements') {
                this._populateSettlementForm(newItem);
            } else if (this.currentTab === 'cargo-types') {
                this._populateCargoForm(newItem);
            }
            
            this._updateUIState();
        }
    }

    async _promptForName() {
        return new Promise((resolve) => {
            new Dialog({
                title: 'Create New Entry',
                content: '<p>Enter name:</p><input type="text" id="new-name" style="width: 100%;" />',
                buttons: {
                    ok: {
                        label: 'Create',
                        callback: (html) => {
                            const name = html.find('#new-name').val().trim();
                            resolve(name || null);
                        }
                    },
                    cancel: {
                        label: 'Cancel',
                        callback: () => resolve(null)
                    }
                },
                default: 'ok'
            }).render(true);
        });
    }

    _onDuplicate() {
        if (!this.selectedItem) return;
        
        const duplicate = foundry.utils.deepClone(this.selectedItem);
        duplicate.name = `${duplicate.name} (Copy)`;
        
        this.selectedItem = duplicate;
        this.changes.set(duplicate.name, foundry.utils.deepClone(duplicate));
        this.originalData.set(duplicate.name, {});
        
        if (this.currentTab === 'settlements') {
            this._populateSettlementForm(duplicate);
        } else if (this.currentTab === 'cargo-types') {
            this._populateCargoForm(duplicate);
        }
        
        this._updateUIState();
    }

    _onDelete() {
        if (!this.selectedItem) return;
        
        Dialog.confirm({
            title: 'Delete Entry',
            content: `Are you sure you want to delete "${this.selectedItem.name}"?`,
            yes: async () => {
                try {
                    if (this.currentTab === 'settlements') {
                        await this.dataManager.deleteSettlement(this.selectedItem.name);
                    } else if (this.currentTab === 'cargo-types') {
                        await this.dataManager.deleteCargoType(this.selectedItem.name);
                    }
                    
                    this.selectedItem = null;
                    this.render();
                    ui.notifications.info('Entry deleted successfully');
                    
                } catch (error) {
                    console.error('Delete failed:', error);
                    ui.notifications.error(`Delete failed: ${error.message}`);
                }
            }
        });
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TradingPlacesDataManagementApp = DataManagementApp;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManagementApp;
}

console.log('Trading Places | DataManagementApp class loaded');