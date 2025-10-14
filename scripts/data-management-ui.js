/**
 * Trading Places Module - Data Management UI
 * Provides in-Foundry editing capabilities for settlements and cargo types
 */

console.log('Trading Places | Loading data-management-ui.js');

/**
 * Data Management Application class
 */
class DataManagementApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    
    async _renderHTML(context, options) {
        console.log('DataManagementApp: _renderHTML called with context:', context);
        console.log('Template path:', this.options.template);
        
        try {
            // Try the HandlebarsApplicationMixin first
            let result = await super._renderHTML(context, options);
            console.log('Super._renderHTML returned:', typeof result, result);
            
            // If it returns an empty object, render manually
            if (typeof result === 'object' && Object.keys(result).length === 0) {
                console.log('Super._renderHTML returned empty object, rendering manually...');
                
                // Load and render template manually using the correct namespaced function
                const template = await foundry.applications.handlebars.getTemplate(this.options.template);
                result = template(context);
                console.log('Manual template rendering result:', typeof result, result.substring(0, 200));
            }
            
            return result;
        } catch (error) {
            console.error('Template rendering failed:', error);
            throw error;
        }
    }
    
    async _replaceHTML(element, content, options) {
        try {
            const result = await super._replaceHTML(element, content, options);
            return result;
        } catch (error) {
            // The parameters are swapped: element=HTML string, content=DOM element
            if (typeof element === 'string' && content && content.innerHTML !== undefined) {
                content.innerHTML = element;
                // Manually attach event listeners instead of using the mixin
                this._attachDataManagementListeners(content);
                return content;
            }
            
            throw error;
        }
    }
    
    constructor(dataManager, options = {}) {
        super(options);
        this.dataManager = dataManager;
        this.currentTab = 'settlements';
        this.selectedItem = null;
        this.changes = new Map();
        this.originalData = new Map();
    }

    static get DEFAULT_OPTIONS() {
        const options = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: 'trading-data-management',
            title: 'Trading Data Management',
            template: 'modules/trading-places/templates/data-management.hbs',
            classes: ['trading-places', 'data-management'],
            width: 1200,
            height: 800,
            resizable: true,
            position: {
                width: 1200,
                height: 800
            },
            tabs: [
                { navSelector: '.trading-places-nav-tabs', contentSelector: '.trading-places-data-management-content', initial: 'settlements' }
            ]
        });
        console.log('DataManagementApp DEFAULT_OPTIONS:', options);
        return options;
    }

    async _prepareContext(options) {
        console.log('DataManagementApp: _prepareContext called');
        try {
            console.log('DataManager state:', {
                hasSettlements: !!this.dataManager.settlements,
                settlementsLength: this.dataManager.settlements?.length || 0,
                hasCargoTypes: !!this.dataManager.cargoTypes,
                cargoTypesLength: this.dataManager.cargoTypes?.length || 0
            });

            // Ensure the DataManager has loaded the active dataset
            if (!this.dataManager.settlements || this.dataManager.settlements.length === 0) {
                console.log('Loading active dataset for data management...');
                await this.dataManager.loadActiveDataset();
            }

            // Load all required data
            console.log('Loading trading config and source flags...');
            await this.dataManager.loadTradingConfig();
            await this.dataManager.loadSourceFlags();

            const settlements = this.dataManager.getAllSettlements();
            const cargoTypes = this.dataManager.getCargoTypes();
            const sourceFlags = this.dataManager.sourceFlags || {};
            
            console.log('Data loaded:', {
                settlements: settlements.length,
                cargoTypes: cargoTypes.length,
                sourceFlags: Object.keys(sourceFlags).length
            });
            
            // Extract unique regions and categories
            const regions = [...new Set(settlements.map(s => s.region))].sort();
            const cargoCategories = [...new Set(cargoTypes.map(c => c.category).filter(Boolean))].sort();

            console.log(`Data Management UI: Loaded ${settlements.length} settlements, ${cargoTypes.length} cargo types`);

            const context = {
                settlements,
                cargoTypes,
                availableFlags: sourceFlags,
                regions,
                cargoCategories,
                currentTab: this.currentTab,
                hasChanges: this.changes.size > 0,
                changesCount: this.changes.size
            };
            
            console.log('Final context:', context);
            return context;
        } catch (error) {
            console.error('Failed to prepare data management context:', error);
            ui.notifications.error(`Failed to load data: ${error.message}`);
            return {
                settlements: [],
                cargoTypes: [],
                availableFlags: {},
                regions: [],
                cargoCategories: [],
                currentTab: this.currentTab,
                hasChanges: false,
                changesCount: 0,
                error: error.message
            };
        }
    }

    _attachDataManagementListeners(element) {
        console.log('Attaching data management event listeners...');
        
        // Attach tab navigation listeners
        const navTabs = element.querySelectorAll('.trading-places-nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                event.preventDefault();
                const tabId = tab.dataset.tab;
                this._switchTab(tabId);
            });
        });
        
        // Attach settlement list item listeners
        const settlementItems = element.querySelectorAll('.trading-places-settlement-item');
        settlementItems.forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                const settlementName = item.dataset.settlement;
                this._selectSettlement(settlementName);
            });
        });
        
        // Attach cargo list item listeners  
        const cargoItems = element.querySelectorAll('.trading-places-cargo-item');
        cargoItems.forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                const cargoName = item.dataset.cargo;
                this._selectCargoType(cargoName);
            });
        });
        
        console.log('Event listeners attached successfully');
    }

    _attachPartListeners(partId, htmlElement, options) {
        try {
            super._attachPartListeners(partId, htmlElement, options);
        } catch (error) {
            console.log('Super._attachPartListeners failed, using manual attachment:', error);
            this._attachDataManagementListeners(htmlElement);
        }

        if (partId === 'content') {
            // Tab navigation
            htmlElement.querySelectorAll('.trading-places-nav-tab').forEach(tab => {
                tab.addEventListener('click', this._onTabClick.bind(this));
            });

            // List item selection
            htmlElement.querySelectorAll('.trading-places-settlement-item').forEach(item => {
                item.addEventListener('click', this._onSettlementSelect.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-cargo-item').forEach(item => {
                item.addEventListener('click', this._onCargoSelect.bind(this));
            });

            // Search and filter
            htmlElement.querySelectorAll('.trading-places-search-input').forEach(input => {
                input.addEventListener('input', this._onSearch.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-region-filter, .category-filter').forEach(select => {
                select.addEventListener('change', this._onFilter.bind(this));
            });

            // Form controls
            htmlElement.querySelectorAll('.trading-places-settlement-form input, .settlement-form select, .settlement-form textarea').forEach(element => {
                element.addEventListener('input', this._onFieldChange.bind(this));
                element.addEventListener('change', this._onFieldChange.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-cargo-form input, .cargo-form select, .cargo-form textarea').forEach(element => {
                element.addEventListener('input', this._onFieldChange.bind(this));
                element.addEventListener('change', this._onFieldChange.bind(this));
            });

            // Population to size calculation
            const populationInput = htmlElement.querySelector('#settlement-population');
            if (populationInput) {
                populationInput.addEventListener('input', this._onPopulationChange.bind(this));
            }

            // Garrison strength calculation
            htmlElement.querySelectorAll('[id^="garrison-"]').forEach(input => {
                input.addEventListener('input', this._updateGarrisonStrength.bind(this));
            });

            // Flag selection
            htmlElement.querySelectorAll('.trading-places-flag-option input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', this._onFlagChange.bind(this));
            });

            // Cargo selector for produces/demands
            htmlElement.querySelectorAll('.trading-places-cargo-selector').forEach(select => {
                select.addEventListener('change', this._onCargoSelectorChange.bind(this));
            });

            // Tag removal
            htmlElement.querySelectorAll('.tag-remove').forEach(button => {
                button.addEventListener('click', this._onTagRemove.bind(this));
            });

            // Action buttons
            htmlElement.querySelectorAll('.trading-places-create-new-btn').forEach(button => {
                button.addEventListener('click', this._onCreateNew.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-duplicate-btn').forEach(button => {
                button.addEventListener('click', this._onDuplicate.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-delete-btn').forEach(button => {
                button.addEventListener('click', this._onDelete.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-save-btn').forEach(button => {
                button.addEventListener('click', this._onSave.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-revert-btn').forEach(button => {
                button.addEventListener('click', this._onRevert.bind(this));
            });

            // Footer actions
            htmlElement.querySelectorAll('.trading-places-preview-changes-btn').forEach(button => {
                button.addEventListener('click', this._onPreviewChanges.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-save-all-btn').forEach(button => {
                button.addEventListener('click', this._onSaveAll.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-discard-all-btn').forEach(button => {
                button.addEventListener('click', this._onDiscardAll.bind(this));
            });

            // Header actions
            htmlElement.querySelectorAll('.trading-places-export-data-btn').forEach(button => {
                button.addEventListener('click', this._onExportData.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-import-data-btn').forEach(button => {
                button.addEventListener('click', this._onImportData.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-refresh-data-btn').forEach(button => {
                button.addEventListener('click', this._onRefreshData.bind(this));
            });

            // Modal controls
            htmlElement.querySelectorAll('.trading-places-modal-close, .trading-places-cancel-btn').forEach(button => {
                button.addEventListener('click', this._onCloseModal.bind(this));
            });
            htmlElement.querySelectorAll('.trading-places-confirm-save-btn').forEach(button => {
                button.addEventListener('click', this._onConfirmSave.bind(this));
            });

            // Initialize UI state
            this._updateUIState(htmlElement);
        }
    }

    _onTabClick(event) {
        event.preventDefault();
        const tab = event.currentTarget.dataset.tab;
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
        const settlementName = event.currentTarget.dataset.id;
        this._selectSettlement(settlementName);
    }

    _onCargoSelect(event) {
        const cargoName = event.currentTarget.dataset.id;
        this._selectCargo(cargoName);
    }

    _selectSettlement(name) {
        const settlement = this.dataManager.getAllSettlements().find(s => s.name === name);
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
        const form = this.element.querySelector('.trading-places-settlement-form');
        
        // Basic fields
        const nameInput = form?.querySelector('#settlement-name');
        if (nameInput) nameInput.value = settlement.name;
        
        const regionSelect = form?.querySelector('#settlement-region');
        if (regionSelect) regionSelect.value = settlement.region;
        
        const populationInput = form?.querySelector('#settlement-population');
        if (populationInput) populationInput.value = settlement.population;
        
        const sizeSelect = form?.querySelector('#settlement-size');
        if (sizeSelect) sizeSelect.value = settlement.size;
        
        const wealthSelect = form?.querySelector('#settlement-wealth');
        if (wealthSelect) wealthSelect.value = settlement.wealth;
        
        const rulerInput = form?.querySelector('#settlement-ruler');
        if (rulerInput) rulerInput.value = settlement.ruler || '';
        
        const notesTextarea = form?.querySelector('#settlement-notes');
        if (notesTextarea) notesTextarea.value = settlement.notes || '';

        // Flags
        form?.querySelectorAll('.trading-places-flag-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        if (settlement.flags && Array.isArray(settlement.flags)) {
            settlement.flags.forEach(flag => {
                const checkbox = form?.querySelector(`#flag-${flag}`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Produces and Demands tags
        this._updateTagList('produces', settlement.produces || []);
        this._updateTagList('demands', settlement.demands || []);

        // Garrison
        const garrisonA = form?.querySelector('#garrison-a');
        if (garrisonA) garrisonA.value = settlement.garrison?.a || 0;
        
        const garrisonB = form?.querySelector('#garrison-b');
        if (garrisonB) garrisonB.value = settlement.garrison?.b || 0;
        
        const garrisonC = form?.querySelector('#garrison-c');
        if (garrisonC) garrisonC.value = settlement.garrison?.c || 0;
        
        this._updateGarrisonStrength();

        // Show form
        if (form) form.style.display = 'block';
        const noSelectionMsg = this.element.querySelector('.trading-places-no-selection-message');
        if (noSelectionMsg) noSelectionMsg.style.display = 'none';
    }

    _populateCargoForm(cargo) {
        const form = this.element.querySelector('.trading-places-cargo-form');
        
        // Basic fields
        const nameInput = form?.querySelector('#cargo-name');
        if (nameInput) nameInput.value = cargo.name;
        
        const categorySelect = form?.querySelector('#cargo-category');
        if (categorySelect) categorySelect.value = cargo.category || '';
        
        const basePriceInput = form?.querySelector('#cargo-base-price');
        if (basePriceInput) basePriceInput.value = cargo.basePrice;
        
        const descriptionTextarea = form?.querySelector('#cargo-description');
        if (descriptionTextarea) descriptionTextarea.value = cargo.description || '';

        // Seasonal modifiers
        const seasonal = cargo.seasonalModifiers || {};
        const springInput = form?.querySelector('#seasonal-spring');
        if (springInput) springInput.value = seasonal.spring || 1;
        
        const summerInput = form?.querySelector('#seasonal-summer');
        if (summerInput) summerInput.value = seasonal.summer || 1;
        
        const autumnInput = form?.querySelector('#seasonal-autumn');
        if (autumnInput) autumnInput.value = seasonal.autumn || 1;
        
        const winterInput = form?.querySelector('#seasonal-winter');
        if (winterInput) winterInput.value = seasonal.winter || 1;

        // Show form
        if (form) form.style.display = 'block';
        const noSelectionMsg = this.element.querySelector('.trading-places-no-selection-message');
        if (noSelectionMsg) noSelectionMsg.style.display = 'none';
    }

    _onFieldChange(event) {
        if (!this.selectedItem) return;

        const field = event.target;
        const fieldName = field.name;
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
        const type = field.type;
        
        if (type === 'number') {
            const val = parseFloat(field.value);
            return isNaN(val) ? 0 : val;
        } else if (type === 'checkbox') {
            return field.checked;
        } else {
            return field.value;
        }
    }

    _onPopulationChange(event) {
        const population = parseInt(event.target.value) || 0;
        const size = this._calculateSizeFromPopulation(population);
        
        const sizeSelect = this.element.querySelector('#settlement-size');
        if (sizeSelect) sizeSelect.value = size;
        
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
        const garrisonA = this.element.querySelector('#garrison-a');
        const garrisonB = this.element.querySelector('#garrison-b');
        const garrisonC = this.element.querySelector('#garrison-c');
        
        const a = parseInt(garrisonA?.value) || 0;
        const b = parseInt(garrisonB?.value) || 0;
        const c = parseInt(garrisonC?.value) || 0;
        
        const strength = (a * 3) + (b * 2) + (c * 1);
        const strengthDisplay = this.element.querySelector('#garrison-strength');
        if (strengthDisplay) strengthDisplay.textContent = strength;
    }

    _onFlagChange(event) {
        if (!this.selectedItem) return;

        const flags = [];
        this.element.querySelectorAll('.trading-places-flag-option input[type="checkbox"]:checked').forEach(checkbox => {
            flags.push(checkbox.value);
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
        const selector = event.target;
        const target = selector.dataset.target;
        const cargoType = selector.value;
        
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
        selector.value = '';
    }

    _updateTagList(target, items) {
        const container = this.element.querySelector(`#${target}-tags`);
        if (!container) return;
        
        container.innerHTML = '';
        
        items.forEach((item, index) => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = `
                ${item}
                <button type="button" class="tag-remove" data-target="${target}" data-index="${index}">×</button>
            `;
            container.appendChild(tag);
        });
    }

    _onTagRemove(event) {
        event.preventDefault();
        if (!this.selectedItem) return;

        const button = event.target;
        const target = button.dataset.target;
        const value = button.dataset.value;
        
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
        const saveBtn = this.element.querySelector('.trading-places-save-btn');
        const revertBtn = this.element.querySelector('.trading-places-revert-btn');
        const duplicateBtn = this.element.querySelector('.trading-places-duplicate-btn');
        const deleteBtn = this.element.querySelector('.trading-places-delete-btn');
        
        if (saveBtn) saveBtn.disabled = !hasSelection || !this.changes.has(this.selectedItem?.name);
        if (revertBtn) revertBtn.disabled = !hasSelection || !this.changes.has(this.selectedItem?.name);
        if (duplicateBtn) duplicateBtn.disabled = !hasSelection;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        
        // Update changes summary
        const changesContainer = this.element.querySelector('.trading-places-changes-summary');
        if (changesContainer) {
            if (hasChanges) {
                changesContainer.style.display = 'block';
                const changesCount = changesContainer.querySelector('.trading-places-changes-count');
                if (changesCount) changesCount.textContent = this.changes.size;
            } else {
                changesContainer.style.display = 'none';
            }
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
        this.element.querySelectorAll('.trading-places-field-error').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
        this.element.querySelectorAll('.trading-places-form-group').forEach(el => el.classList.remove('error'));
        
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
                            const input = html.querySelector('#new-name');
                            const name = input ? input.value.trim() : '';
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

    // Tab switching functionality
    _switchTab(tabId) {
        console.log('Switching to tab:', tabId);
        this.currentTab = tabId;
        
        // Update tab navigation
        const allTabs = this.element.querySelectorAll('.trading-places-nav-tab');
        const allTabContents = this.element.querySelectorAll('.trading-places-tab-content');
        
        allTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        allTabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
        
        console.log(`Switched to ${tabId} tab`);
    }

    // Missing event handler methods that are referenced in the template

    _onSearch(event) {
        // TODO: Implement search functionality
        console.log('Search functionality not yet implemented');
    }

    _onFilter(event) {
        // TODO: Implement filter functionality
        console.log('Filter functionality not yet implemented');
    }

    _onPreviewChanges(event) {
        // TODO: Implement preview changes functionality
        console.log('Preview changes functionality not yet implemented');
    }

    _onSaveAll(event) {
        // TODO: Implement save all functionality
        console.log('Save all functionality not yet implemented');
    }

    _onDiscardAll(event) {
        // TODO: Implement discard all functionality
        console.log('Discard all functionality not yet implemented');
    }

    _onExportData(event) {
        // TODO: Implement export data functionality
        console.log('Export data functionality not yet implemented');
    }

    _onImportData(event) {
        // TODO: Implement import data functionality
        console.log('Import data functionality not yet implemented');
    }

    _onRefreshData(event) {
        // TODO: Implement refresh data functionality
        console.log('Refresh data functionality not yet implemented');
        this.render();
    }

    _onCloseModal(event) {
        // TODO: Implement close modal functionality
        console.log('Close modal functionality not yet implemented');
    }

    _onConfirmSave(event) {
        // TODO: Implement confirm save functionality
        console.log('Confirm save functionality not yet implemented');
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