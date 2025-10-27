/**
 * Data Management using ApplicationV2 - No more deprecation warnings!
 */

const MODULE_ID = "fvtt-trading-places";

class DataManagementV2 extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    constructor(dataManager, options = {}) {
        super(options);
        this.dataManager = dataManager;
        this.currentDataset = null; // Will be set when we load datasets
        this.searchFilters = {
            settlements: '',
            cargo: ''
        };
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: 'trading-data-management',
            title: 'Trading Data Management',
            tag: 'div',
            classes: ['trading-places', 'data-management'],
            position: {
                width: 1100, // Increased width to accommodate sidebar
                height: 700
            },
            window: {
                resizable: true,
                minimizable: false
            }
        });
    }

    async _prepareContext(options) {
        // Load dataset pointer if not already loaded
        if (!this.dataManager.datasetPointer) {
            await this.dataManager.loadDatasetPointer();
        }
        
        // Set current dataset if not already set
        if (!this.currentDataset) {
            this.currentDataset = this.dataManager.activeDatasetName || 'wfrp4e';
        }
        
        const settlements = this.dataManager.getAllSettlements();
        const cargoTypes = this.dataManager.getCargoTypes();
        const tradingConfig = this.dataManager.getTradingConfig();
        const config = this.dataManager.getConfig();
        
        // Sort settlements first
        settlements.sort((a, b) => a.name.localeCompare(b.name));
        
        // Group settlements by region and sort
        const settlementsByRegion = {};
        settlements.forEach(settlement => {
            const region = settlement.region || 'Unknown';
            if (!settlementsByRegion[region]) {
                settlementsByRegion[region] = [];
            }
            settlementsByRegion[region].push(settlement);
        });

        // Sort regions and settlements within each region
        const sortedRegions = Object.keys(settlementsByRegion).sort();
        sortedRegions.forEach(region => {
            settlementsByRegion[region].sort((a, b) => a.name.localeCompare(b.name));
        });

        // Sort cargo types
        const sortedCargo = [...cargoTypes].sort((a, b) => a.name.localeCompare(b.name));

        return {
            settlementsByRegion,
            sortedRegions,
            cargoTypes: sortedCargo,
            searchFilters: this.searchFilters,
            currentDataset: this.currentDataset,
            tradingConfig,
            config
        };
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        return context;
    }

    async _renderHTML(context, options) {
        const html = `
            <div class="trading-places-dm-container">
                <!-- Dataset Selector Sidebar -->
                <div class="trading-places-dm-sidebar">
                    <h3>Datasets</h3>
                    <div class="trading-places-dm-dataset-selector">
                        ${this._renderDatasetSelector(context)}
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="trading-places-dm-main">
                    <div class="trading-places-dm-tabs">
                        <button class="trading-places-dm-tab active" data-tab="settlements">
                            Settlements (${Object.values(context.settlementsByRegion).flat().length})
                        </button>
                        <button class="trading-places-dm-tab" data-tab="cargo">
                            Cargo Types (${context.cargoTypes.length})
                        </button>
                        <button class="trading-places-dm-tab" data-tab="trading-config">
                            Trading Config
                        </button>
                        <button class="trading-places-dm-tab" data-tab="config">
                            Config
                        </button>
                    </div>
                    
                    <div class="trading-places-dm-content">
                        <!-- Settlements Tab -->
                        <div class="trading-places-dm-tab-panel active" data-panel="settlements">
                            <div class="trading-places-dm-search">
                                <input type="text" placeholder="Search settlements and regions..." class="trading-places-dm-search-input" data-type="settlements">
                                <button class="trading-places-dm-add-btn" data-action="add-settlement">Add Settlement</button>
                                <button class="trading-places-dm-export-btn" data-action="export-settlements" title="Export settlements data">Export</button>
                                <button class="trading-places-dm-import-btn" data-action="import-settlements" title="Import settlements data">Import</button>
                                
                            </div>
                            <div class="trading-places-dm-list" id="settlements-list">
                                ${this._renderSettlementsList(context.settlementsByRegion, context.sortedRegions)}
                            </div>
                        </div>
                        
                        <!-- Cargo Tab -->
                        <div class="trading-places-dm-tab-panel" data-panel="cargo">
                            <div class="trading-places-dm-search">
                                <input type="text" placeholder="Search cargo types..." class="trading-places-dm-search-input" data-type="cargo">
                                <button class="trading-places-dm-export-btn" data-action="export-cargo" title="Export cargo data">Export</button>
                                <button class="trading-places-dm-import-btn" data-action="import-cargo" title="Import cargo data">Import</button>
                                <button class="trading-places-dm-add-btn" data-action="add-cargo">Add Cargo Type</button>
                            </div>
                            <div class="trading-places-dm-list" id="cargo-list">
                                ${this._renderCargoList(context.cargoTypes)}
                            </div>
                        </div>
                        
                        <!-- Trading Config Tab -->
                        <div class="trading-places-dm-tab-panel" data-panel="trading-config">
                            <pre>${JSON.stringify(context.tradingConfig, null, 2)}</pre>
                        </div>
                        
                        <!-- Config Tab -->
                        <div class="trading-places-dm-tab-panel" data-panel="config">
                            <div class="trading-places-dm-config-section">
                                <h3>Currency Configuration</h3>
                                <div class="trading-places-dm-config-group">
                                    <h4>Canonical Unit (Base Currency)</h4>
                                    <div class="trading-places-dm-config-row">
                                        <label>Name:</label>
                                        <input type="text" id="canonical-name" value="${context.config?.currency?.canonicalUnit?.name || 'Brass Penny'}" style="flex: 1;">
                                    </div>
                                    <div class="trading-places-dm-config-row">
                                        <label>Abbreviation:</label>
                                        <input type="text" id="canonical-abbrev" value="${context.config?.currency?.canonicalUnit?.abbreviation || 'BP'}" style="flex: 1;">
                                    </div>
                                </div>
                                
                                <div class="trading-places-dm-config-group">
                                    <h4>Currency Denominations</h4>
                                    <div id="denominations-list">
                                        ${(context.config?.currency?.denominations || []).map((denom, index) => `
                                            <div class="trading-places-dm-denomination" data-index="${index}">
                                                <div class="trading-places-dm-config-row">
                                                    <label>Name:</label>
                                                    <input type="text" class="denom-name" value="${denom.name}" style="flex: 1;">
                                                </div>
                                                <div class="trading-places-dm-config-row">
                                                    <label>Plural Name:</label>
                                                    <input type="text" class="denom-plural" value="${denom.pluralName}" style="flex: 1;">
                                                </div>
                                                <div class="trading-places-dm-config-row">
                                                    <label>Abbreviation:</label>
                                                    <input type="text" class="denom-abbrev" value="${denom.abbreviation}" style="flex: 1;">
                                                </div>
                                                <div class="trading-places-dm-config-row">
                                                    <label>Value (in ${context.config?.currency?.canonicalUnit?.abbreviation || 'BP'}):</label>
                                                    <input type="number" class="denom-value" value="${denom.value}" style="flex: 1;">
                                                </div>
                                                <div class="trading-places-dm-denomination-actions">
                                                    <button class="trading-places-dm-btn delete-denom" data-index="${index}">Remove</button>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <button class="trading-places-dm-add-btn" id="add-denomination">Add Denomination</button>
                                </div>
                                
                                <div class="trading-places-dm-config-group">
                                    <h4>Display Order</h4>
                                    <div class="trading-places-dm-config-row">
                                        <label>Order (comma-separated abbreviations):</label>
                                        <input type="text" id="display-order" value="${(context.config?.currency?.display?.order || []).join(', ')}" style="flex: 1;">
                                    </div>
                                    <div class="trading-places-dm-config-help">
                                        Enter currency abbreviations in the order you want them displayed, separated by commas.
                                        Available: ${(context.config?.currency?.canonicalUnit?.abbreviation || 'BP')}, ${((context.config?.currency?.denominations || []).map(d => d.abbreviation)).join(', ')}
                                    </div>
                                </div>
                                
                                <div class="trading-places-dm-config-actions">
                                    <button class="trading-places-dm-btn save" id="save-config">Save Configuration</button>
                                    <button class="trading-places-dm-btn reset" id="reset-config">Reset to Defaults</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return html;
    }

    async _replaceHTML(element, content, options) {
        try {
            const result = await super._replaceHTML(element, content, options);
            return result;
        } catch (error) {
            // Handle the parameter swap issue we've seen before
            if (typeof element === 'string' && content && content.innerHTML !== undefined) {
                content.innerHTML = element;
                this._attachFrameListeners();
                return content;
            }
            throw error;
        }
    }

    _renderSettlementsList(settlementsByRegion, sortedRegions) {
        let html = '';
        
        for (const region of sortedRegions) {
            const settlements = settlementsByRegion[region];
            const filteredSettlements = this._filterSettlements(settlements, this.searchFilters.settlements);
            
            // SORT the filtered settlements alphabetically!
            filteredSettlements.sort((a, b) => a.name.localeCompare(b.name));
            
            if (filteredSettlements.length === 0 && this.searchFilters.settlements) continue;
            
            html += `
                <div class="trading-places-dm-region" data-region="${region}">
                    <span>${region} (${filteredSettlements.length})</span>
                    <i class="fas fa-chevron-down trading-places-dm-expand-icon"></i>
                </div>
                <div class="trading-places-dm-settlements">
                    ${filteredSettlements.map(settlement => `
                        <div class="trading-places-dm-item">
                            <div class="trading-places-dm-item-info">
                                <div class="trading-places-dm-item-name">${settlement.name}</div>
                                <div class="trading-places-dm-item-details">
                                    Wealth ${settlement.wealth} • Size ${settlement.size} • Pop. ${settlement.population || 'Unknown'}
                                </div>
                            </div>
                            <div class="trading-places-dm-item-actions">
                                <button class="trading-places-dm-btn edit" data-action="edit-settlement" data-name="${settlement.name}">Edit</button>
                                <button class="trading-places-dm-btn delete" data-action="delete-settlement" data-name="${settlement.name}">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        return html;
    }

    _renderCargoList(cargoTypes) {
        const filteredCargo = this._filterCargo(cargoTypes, this.searchFilters.cargo);
        
        return filteredCargo.map(cargo => `
            <div class="trading-places-dm-item">
                <div class="trading-places-dm-item-info">
                    <div class="trading-places-dm-item-name">${cargo.name}</div>
                    <div class="trading-places-dm-item-details">
                        ${cargo.category || 'No category'} • Base Price: ${cargo.basePrice} BP
                    </div>
                </div>
                <div class="trading-places-dm-item-actions">
                    <button class="trading-places-dm-btn edit" data-action="edit-cargo" data-name="${cargo.name}">Edit</button>
                    <button class="trading-places-dm-btn delete" data-action="delete-cargo" data-name="${cargo.name}">Delete</button>
                </div>
            </div>
        `).join('');
    }

    _renderDatasetSelector(context) {
        // Get available datasets from the dataManager
        const datasets = this._getAvailableDatasets();
        
        // Create dropdown options
        const options = datasets.map(dataset => 
            `<option value="${dataset.id}" ${dataset.id === this.currentDataset ? 'selected' : ''}>${dataset.label} (${dataset.type})</option>`
        ).join('');
        
        return `
            <div class="trading-places-dm-dataset-header">
                <div>
                    <select id="trading-places-dataset-selector" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                        ${options}
                    </select>
                </div>
                <div>
                    <button class="trading-places-dm-dataset-add" 
                            data-action="add-dataset"
                            title="Add new dataset">
                        add
                    </button>
                    <button class="trading-places-dm-dataset-delete" 
                            data-action="delete-dataset"
                            title="Delete selected dataset">
                        delete
                    </button>
                </div>
            </div>
        `;
    }

    _getAvailableDatasets() {
        const datasets = [];
        
        // Get built-in datasets from the dataManager's dataset pointer
        if (this.dataManager.datasetPointer && this.dataManager.datasetPointer.systems) {
            this.dataManager.datasetPointer.systems.forEach(system => {
                datasets.push({
                    id: system.id,
                    label: system.label || system.id,
                    type: 'built-in'
                });
            });
        }
        
        // If no built-in datasets found, add a default one
        if (datasets.length === 0) {
            datasets.push({
                id: 'wfrp4e',
                label: 'Warhammer Fantasy Roleplay 4th Edition',
                type: 'built-in'
            });
        }
        
        // Get user datasets from Foundry settings
        try {
            if (typeof game !== 'undefined' && game.settings) {
                const userDatasets = game.settings.get(MODULE_ID, 'userDatasets') || [];
                userDatasets.forEach(datasetName => {
                    datasets.push({
                        id: datasetName,
                        label: datasetName,
                        type: 'user'
                    });
                });
            }
        } catch (error) {
            console.warn('Failed to load user datasets:', error);
        }
        
        return datasets;
    }

    _filterSettlements(settlements, searchTerm) {
        if (!searchTerm) return settlements;
        const term = searchTerm.toLowerCase();
        return settlements.filter(s => 
            s.name.toLowerCase().includes(term) ||
            s.region.toLowerCase().includes(term)
        );
    }

    _filterCargo(cargoTypes, searchTerm) {
        if (!searchTerm) return cargoTypes;
        const term = searchTerm.toLowerCase();
        return cargoTypes.filter(c => 
            c.name.toLowerCase().includes(term) ||
            (c.category && c.category.toLowerCase().includes(term))
        );
    }

    _attachFrameListeners() {
        super._attachFrameListeners();
        
        const html = $(this.element);
        
        // Tab switching
        html.find('.trading-places-dm-tab').click((e) => {
            const tab = $(e.currentTarget).data('tab');
            this._switchTab(tab);
        });
        
        // Dataset selection
        html.find('#trading-places-dataset-selector').change((e) => {
            const datasetId = $(e.currentTarget).val();
            this._switchDataset(datasetId);
        });
        
        // Search functionality
        html.find('.trading-places-dm-search-input').on('input', (e) => {
            const type = $(e.currentTarget).data('type');
            const value = e.target.value;
            this.searchFilters[type] = value;
            this._updateSearch(type);
        });
        
        // Region collapse/expand
        html.find('.trading-places-dm-region').click((e) => {
            $(e.currentTarget).toggleClass('collapsed');
        });
        
        // Action buttons
        html.find('[data-action]').click((e) => {
            const action = $(e.currentTarget).data('action');
            const name = $(e.currentTarget).data('name');
            this._handleAction(action, name);
        });
        
        // Config tab event handlers
        html.find('#add-denomination').click(() => {
            this._addDenomination();
        });
        
        html.find('.delete-denom').click((e) => {
            const index = $(e.currentTarget).data('index');
            this._deleteDenomination(index);
        });
        
        html.find('#save-config').click(() => {
            this._saveConfig();
        });
        
        html.find('#reset-config').click(() => {
            this._resetConfig();
        });
    }

    _switchTab(tabName) {
        const html = $(this.element);
        
        // Update tab buttons
        html.find('.trading-places-dm-tab').removeClass('active');
        html.find(`[data-tab="${tabName}"]`).addClass('active');
        
        // Update tab panels
        html.find('.trading-places-dm-tab-panel').removeClass('active');
        html.find(`[data-panel="${tabName}"]`).addClass('active');
    }

    async _switchDataset(datasetId) {
        try {
            // Validate that the dataset exists
            const availableDatasets = this._getAvailableDatasets();
            const datasetExists = availableDatasets.some(d => d.id === datasetId);
            
            if (!datasetExists) {
                console.warn(`Dataset '${datasetId}' does not exist, cannot switch`);
                ui.notifications.error(`Dataset '${datasetId}' does not exist`);
                return;
            }

            // Switch the dataset in the dataManager
            await this.dataManager.switchDataset(datasetId);
            
            // Update current dataset
            this.currentDataset = datasetId;
            
            // Update the UI to reflect the new dataset
            await this.render();
            
            // Update dataset selector selected option
            const html = $(this.element);
            html.find('#trading-places-dataset-selector').val(datasetId);
            
            // Notification is handled by the settings change handler to avoid duplicates
        } catch (error) {
            console.error('Failed to switch dataset:', error);
            ui.notifications.error(`Failed to switch dataset: ${error.message}`);
            
            // If switching failed, try to reset to a valid dataset
            try {
                const availableDatasets = this._getAvailableDatasets();
                if (availableDatasets.length > 0) {
                    const defaultDataset = availableDatasets.find(d => d.id === 'wfrp4e') || availableDatasets[0];
                    console.log(`Attempting to reset to default dataset: ${defaultDataset.id}`);
                    await this._switchDataset(defaultDataset.id);
                }
            } catch (resetError) {
                console.error('Failed to reset to default dataset:', resetError);
            }
        }
    }

    _updateSearch(type) {
        if (type === 'settlements') {
            this._updateSettlementsList();
        } else if (type === 'cargo') {
            this._updateCargoList();
        }
    }

    async _updateSettlementsList() {
        const context = await this._prepareContext();
        const html = this._renderSettlementsList(context.settlementsByRegion, context.sortedRegions);
        $(this.element).find('#settlements-list').html(html);
        
        // Reattach region click handlers
        $(this.element).find('.trading-places-dm-region').click((e) => {
            $(e.currentTarget).toggleClass('collapsed');
        });
        
        // Reattach action handlers
        $(this.element).find('[data-action]').click((e) => {
            const action = $(e.currentTarget).data('action');
            const name = $(e.currentTarget).data('name');
            this._handleAction(action, name);
        });
    }

    async _updateCargoList() {
        const context = await this._prepareContext();
        const html = this._renderCargoList(context.cargoTypes);
        $(this.element).find('#cargo-list').html(html);
        
        // Reattach action handlers
        $(this.element).find('[data-action]').click((e) => {
            const action = $(e.currentTarget).data('action');
            const name = $(e.currentTarget).data('name');
            this._handleAction(action, name);
        });
    }

    _handleAction(action, name) {
        switch (action) {
            case 'add-settlement':
                this._addSettlement();
                break;
            case 'edit-settlement':
                this._editSettlement(name);
                break;
            case 'delete-settlement':
                this._deleteSettlement(name);
                break;
            case 'export-settlements':
                this._exportSettlements();
                break;
            case 'import-settlements':
                this._importSettlements();
                break;
            case 'add-cargo':
                this._addCargo();
                break;
            case 'edit-cargo':
                this._editCargo(name);
                break;
            case 'delete-cargo':
                this._deleteCargo(name);
                break;
            case 'export-cargo':
                this._exportCargo();
                break;
            case 'import-cargo':
                this._importCargo();
                break;
            case 'add-dataset':
                this._addDataset();
                break;
            case 'delete-dataset':
                // Get selected dataset from dropdown - scope to this application
                const selectedDataset = $(this.element).find('#trading-places-dataset-selector').val();
                console.log('DELETE DATASET: selected dataset =', selectedDataset);
                this._deleteDataset(selectedDataset);
                break;
        }
    }

    // Settlement CRUD methods
    _addSettlement() {
        const content = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
                    <input type="text" id="settlement-name" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Region:</label>
                    <input type="text" id="settlement-region" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Wealth:</label>
                        <select id="settlement-wealth" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                            <option value="1">1 - Poor</option>
                            <option value="2">2 - Common</option>
                            <option value="3" selected>3 - Prosperous</option>
                            <option value="4">4 - Wealthy</option>
                            <option value="5">5 - Rich</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Size:</label>
                        <select id="settlement-size" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                            <option value="1">1 - Small Settlement</option>
                            <option value="2">2 - Village</option>
                            <option value="3" selected>3 - Town</option>
                            <option value="4">4 - Large Town</option>
                            <option value="5">5 - City</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Population:</label>
                    <input type="number" id="settlement-population" value="1000" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ruler:</label>
                    <input type="text" id="settlement-ruler" value="Local Authority" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Notes:</label>
                    <textarea id="settlement-notes" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; height: 80px;" placeholder="Optional notes about this settlement"></textarea>
                </div>
            </div>
        `;

        new foundry.applications.api.DialogV2({
            window: { title: "Add New Settlement" },
            content: content,
            buttons: [{
                action: "save",
                label: "Save",
                callback: async (event, button, dialog) => {
                    console.log('REGION DROPDOWN - ADD SETTLEMENT CALLBACK CALLED!');
                    const element = dialog.element;
                    const newSettlement = {
                        name: element.querySelector('#settlement-name').value,
                        region: element.querySelector('#settlement-region').value,
                        wealth: parseInt(element.querySelector('#settlement-wealth').value),
                        size: parseInt(element.querySelector('#settlement-size').value),
                        population: parseInt(element.querySelector('#settlement-population').value),
                        ruler: element.querySelector('#settlement-ruler').value,
                        notes: element.querySelector('#settlement-notes').value,
                        garrison: {},
                        produces: [],
                        demands: [],
                        flags: []
                    };
                    
                    try {
                        await this.dataManager.updateSettlement(newSettlement);
                        ui.notifications.info(`Settlement "${newSettlement.name}" added successfully`);
                        
                        // Debug: Check if fixes are working
                        console.log('NEW SETTLEMENT ADDED:', newSettlement.name, 'in region:', newSettlement.region);
                        console.log('TradingPlacesApplication.currentInstance exists:', !!window.TradingPlacesApplication?.currentInstance);
                        
                        // Refresh the main trading interface region dropdown directly
                        const regionDropdown = document.querySelector('#region-select');
                        if (regionDropdown) {
                            console.log('FOUND REGION DROPDOWN - UPDATING DIRECTLY');
                            const settlements = this.dataManager.getAllSettlements();
                            const regions = [...new Set(settlements.map(s => s.region))].sort();
                            
                            // Clear and repopulate
                            regionDropdown.innerHTML = '<option value="">Select a region...</option>';
                            regions.forEach(region => {
                                const option = document.createElement('option');
                                option.value = region;
                                option.textContent = region;
                                regionDropdown.appendChild(option);
                            });
                            console.log('REGION DROPDOWN UPDATED WITH REGIONS:', regions);
                        } else {
                            console.log('REGION DROPDOWN ELEMENT NOT FOUND');
                        }
                        
                        // For user datasets, persistence is handled by dataManager.updateSettlement()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to add settlement: ${error.message}`);
                    }
                }
            }, {
                action: "cancel",
                label: "Cancel"
            }]
        }).render(true);
    }

    _editSettlement(name) {
        const settlement = this.dataManager.getAllSettlements().find(s => s.name === name);
        if (!settlement) {
            ui.notifications.error(`Settlement "${name}" not found`);
            return;
        }

        const content = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
                    <input type="text" id="settlement-name" value="${settlement.name}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Region:</label>
                    <input type="text" id="settlement-region" value="${settlement.region}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Wealth:</label>
                        <select id="settlement-wealth" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                            <option value="1" ${settlement.wealth === 1 ? 'selected' : ''}>1 - Poor</option>
                            <option value="2" ${settlement.wealth === 2 ? 'selected' : ''}>2 - Common</option>
                            <option value="3" ${settlement.wealth === 3 ? 'selected' : ''}>3 - Prosperous</option>
                            <option value="4" ${settlement.wealth === 4 ? 'selected' : ''}>4 - Wealthy</option>
                            <option value="5" ${settlement.wealth === 5 ? 'selected' : ''}>5 - Rich</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Size:</label>
                        <select id="settlement-size" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                            <option value="1" ${settlement.size === 1 ? 'selected' : ''}>1 - Small Settlement</option>
                            <option value="2" ${settlement.size === 2 ? 'selected' : ''}>2 - Village</option>
                            <option value="3" ${settlement.size === 3 ? 'selected' : ''}>3 - Town</option>
                            <option value="4" ${settlement.size === 4 ? 'selected' : ''}>4 - Large Town</option>
                            <option value="5" ${settlement.size === 5 ? 'selected' : ''}>5 - City</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Population:</label>
                    <input type="number" id="settlement-population" value="${settlement.population || 1000}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Ruler:</label>
                    <input type="text" id="settlement-ruler" value="${settlement.ruler || 'Local Authority'}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Notes:</label>
                    <textarea id="settlement-notes" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; height: 80px;">${settlement.notes || ''}</textarea>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Produces (comma-separated):</label>
                    <input type="text" id="settlement-produces" value="${(settlement.produces || []).join(', ')}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
            </div>
        `;

        new foundry.applications.api.DialogV2({
            window: { title: `Edit Settlement: ${name}` },
            content: content,
            buttons: [{
                action: "save",
                label: "Save",
                callback: async (event, button, dialog) => {
                    console.log('REGION DROPDOWN - EDIT SETTLEMENT CALLBACK CALLED!');
                    const element = dialog.element;
                    const updatedSettlement = {
                        ...settlement,
                        name: element.querySelector('#settlement-name').value,
                        region: element.querySelector('#settlement-region').value,
                        wealth: parseInt(element.querySelector('#settlement-wealth').value),
                        size: parseInt(element.querySelector('#settlement-size').value),
                        population: parseInt(element.querySelector('#settlement-population').value),
                        ruler: element.querySelector('#settlement-ruler').value,
                        notes: element.querySelector('#settlement-notes').value,
                        produces: element.querySelector('#settlement-produces').value.split(',').map(s => s.trim()).filter(s => s)
                    };
                    
                    try {
                        await this.dataManager.updateSettlement(updatedSettlement);
                        ui.notifications.info(`Settlement "${updatedSettlement.name}" updated successfully`);
                        
                        // Refresh the main trading interface region dropdown directly
                        const regionDropdown = document.querySelector('#region-select');
                        if (regionDropdown) {
                            console.log('FOUND REGION DROPDOWN - UPDATING DIRECTLY (EDIT)');
                            const settlements = this.dataManager.getAllSettlements();
                            const regions = [...new Set(settlements.map(s => s.region))].sort();
                            
                            // Clear and repopulate
                            regionDropdown.innerHTML = '<option value="">Select a region...</option>';
                            regions.forEach(region => {
                                const option = document.createElement('option');
                                option.value = region;
                                option.textContent = region;
                                regionDropdown.appendChild(option);
                            });
                            console.log('REGION DROPDOWN UPDATED WITH REGIONS (EDIT):', regions);
                        }
                        
                        // For user datasets, persistence is handled by dataManager.updateSettlement()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to update settlement: ${error.message}`);
                    }
                }
            }, {
                action: "cancel",
                label: "Cancel"
            }]
        }).render(true);
    }

    _deleteSettlement(name) {
        const dialog = new foundry.applications.api.DialogV2({
            window: { title: "Delete Settlement" },
            content: `<p>Are you sure you want to delete the settlement "${name}"?</p>`,
            buttons: [{
                action: "yes",
                label: "Delete",
                default: true,
                callback: async (event, button, dialogInstance) => {
                    try {
                        await this.dataManager.deleteSettlement(name);
                        ui.notifications.info(`Settlement "${name}" deleted successfully`);
                        
                        // Refresh the main trading interface region dropdown directly
                        const regionDropdown = document.querySelector('#region-select');
                        if (regionDropdown) {
                            const settlements = this.dataManager.getAllSettlements();
                            const regions = [...new Set(settlements.map(s => s.region))].sort();
                            
                            regionDropdown.innerHTML = '<option value="">Select a region...</option>';
                            regions.forEach(region => {
                                const option = document.createElement('option');
                                option.value = region;
                                option.textContent = region;
                                regionDropdown.appendChild(option);
                            });
                        }
                        
                        // For user datasets, persistence is handled by dataManager.deleteSettlement()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to delete settlement: ${error.message}`);
                    }
                }
            }, {
                action: "no",
                label: "Cancel",
                default: false
            }]
        });
        dialog.render(true);
    }

    _addCargo() {
        const content = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
                    <input type="text" id="cargo-name" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Category:</label>
                    <input type="text" id="cargo-category" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Base Price (BP):</label>
                    <input type="number" id="cargo-price" value="100" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description:</label>
                    <textarea id="cargo-description" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; height: 80px;" placeholder="Description of this cargo type"></textarea>
                </div>
            </div>
        `;

        new foundry.applications.api.DialogV2({
            window: { title: "Add New Cargo Type" },
            content: content,
            buttons: [{
                action: "save",
                label: "Save",
                callback: async (event, button, dialog) => {
                    const element = dialog.element;
                    const newCargo = {
                        name: element.querySelector('#cargo-name').value,
                        category: element.querySelector('#cargo-category').value,
                        description: element.querySelector('#cargo-description').value,
                        basePrice: parseInt(element.querySelector('#cargo-price').value),
                        seasonalModifiers: {
                            spring: 1,
                            summer: 1,
                            autumn: 1,
                            winter: 1
                        }
                    };
                    
                    try {
                        await this.dataManager.updateCargoType(newCargo);
                        ui.notifications.info(`Cargo type "${newCargo.name}" added successfully`);
                        
                        // For user datasets, persistence is handled by dataManager.updateCargoType()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to add cargo type: ${error.message}`);
                    }
                }
            }, {
                action: "cancel",
                label: "Cancel"
            }]
        }).render(true);
    }

    _editCargo(name) {
        const cargo = this.dataManager.getCargoTypes().find(c => c.name === name);
        if (!cargo) {
            ui.notifications.error(`Cargo type "${name}" not found`);
            return;
        }

        const content = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
                    <input type="text" id="cargo-name" value="${cargo.name}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Category:</label>
                    <input type="text" id="cargo-category" value="${cargo.category || ''}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Base Price (BP):</label>
                    <input type="number" id="cargo-price" value="${cargo.basePrice}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;">
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description:</label>
                    <textarea id="cargo-description" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px; height: 80px;">${cargo.description || ''}</textarea>
                </div>
            </div>
        `;

        new foundry.applications.api.DialogV2({
            window: { title: `Edit Cargo Type: ${name}` },
            content: content,
            buttons: [{
                action: "save",
                label: "Save",
                callback: async (event, button, dialog) => {
                    const element = dialog.element;
                    const updatedCargo = {
                        ...cargo,
                        name: element.querySelector('#cargo-name').value,
                        category: element.querySelector('#cargo-category').value,
                        description: element.querySelector('#cargo-description').value,
                        basePrice: parseInt(element.querySelector('#cargo-price').value),
                        seasonalModifiers: cargo.seasonalModifiers || {
                            spring: 1,
                            summer: 1,
                            autumn: 1,
                            winter: 1
                        }
                    };
                    
                    try {
                        await this.dataManager.updateCargoType(updatedCargo);
                        ui.notifications.info(`Cargo type "${updatedCargo.name}" updated successfully`);
                        
                        // For user datasets, persistence is handled by dataManager.updateCargoType()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to update cargo type: ${error.message}`);
                    }
                }
            }, {
                action: "cancel",
                label: "Cancel"
            }]
        }).render(true);
    }

    _deleteCargo(name) {
        foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Cargo Type" },
            content: `<p>Are you sure you want to delete the cargo type "${name}"?</p>`,
            yes: async () => {
                try {
                    await this.dataManager.deleteCargoType(name);
                    ui.notifications.info(`Cargo type "${name}" deleted successfully`);
                    
                    // For user datasets, persistence is handled by dataManager.deleteCargoType()
                    // For built-in datasets, save to custom settings
                    const datasets = this._getAvailableDatasets();
                    const currentDataset = datasets.find(d => d.id === this.currentDataset);
                    if (currentDataset && currentDataset.type === 'built-in') {
                        await this._saveDataPersistently();
                    }
                    
                    this.render(); // Refresh the dialog
                } catch (error) {
                    ui.notifications.error(`Failed to delete cargo type: ${error.message}`);
                }
            }
        });
    }

    // Import/Export methods
    _exportSettlements() {
        try {
            const settlements = this.dataManager.getAllSettlements();
            const dataStr = JSON.stringify(settlements, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'settlements-export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            ui.notifications.info('Settlements data exported successfully');
        } catch (error) {
            ui.notifications.error(`Failed to export settlements: ${error.message}`);
        }
    }

    _importSettlements() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Show confirmation dialog
            foundry.applications.api.DialogV2.confirm({
                window: { title: "Import Settlements" },
                content: `<p>This will import settlements from the selected file. Existing settlements with the same name will be updated. Continue?</p>`,
                yes: async () => {
                    try {
                        const text = await file.text();
                        const settlements = JSON.parse(text);
                        
                        if (!Array.isArray(settlements)) {
                            throw new Error('Invalid settlements data format');
                        }
                        
                        // Validate each settlement has required fields
                        for (const settlement of settlements) {
                            if (!settlement.name || !settlement.region) {
                                throw new Error(`Invalid settlement data: missing name or region for "${settlement.name || 'unknown'}"`);
                            }
                            if (!settlement.hasOwnProperty('garrison')) {
                                throw new Error(`Invalid settlement data: missing garrison for "${settlement.name || 'unknown'}"`);
                            }
                        }
                        
                        // Import settlements
                        for (const settlement of settlements) {
                            await this.dataManager.updateSettlement(settlement);
                        }
                        
                        ui.notifications.info(`Successfully imported ${settlements.length} settlements`);
                        
                        // For user datasets, persistence is handled by dataManager.updateSettlement()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        this.render();
                        
                    } catch (error) {
                        ui.notifications.error(`Failed to import settlements: ${error.message}`);
                    }
                }
            });
        };
        input.click();
    }

    _exportCargo() {
        try {
            const cargoTypes = this.dataManager.getCargoTypes();
            const dataStr = JSON.stringify(cargoTypes, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'cargo-types-export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            ui.notifications.info('Cargo types data exported successfully');
        } catch (error) {
            ui.notifications.error(`Failed to export cargo types: ${error.message}`);
        }
    }

    _importCargo() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Show confirmation dialog
            foundry.applications.api.DialogV2.confirm({
                window: { title: "Import Cargo Types" },
                content: `<p>This will import cargo types from the selected file. Existing cargo types with the same name will be updated. Continue?</p>`,
                yes: async () => {
                    try {
                        const text = await file.text();
                        const cargoTypes = JSON.parse(text);
                        
                        if (!Array.isArray(cargoTypes)) {
                            throw new Error('Invalid cargo types data format');
                        }
                        
                        // Validate each cargo type has required fields
                        for (const cargo of cargoTypes) {
                            if (!cargo.name) {
                                throw new Error(`Invalid cargo data: missing name for "${cargo.name || 'unknown'}"`);
                            }
                        }
                        
                        // Import cargo types
                        for (const cargo of cargoTypes) {
                            await this.dataManager.updateCargoType(cargo);
                        }
                        
                        ui.notifications.info(`Successfully imported ${cargoTypes.length} cargo types`);
                        
                        // For user datasets, persistence is handled by dataManager.updateCargoType()
                        // For built-in datasets, save to custom settings
                        const datasets = this._getAvailableDatasets();
                        const currentDataset = datasets.find(d => d.id === this.currentDataset);
                        if (currentDataset && currentDataset.type === 'built-in') {
                            await this._saveDataPersistently();
                        }
                        this.render();
                        
                    } catch (error) {
                        ui.notifications.error(`Failed to import cargo types: ${error.message}`);
                    }
                }
            });
        };
        input.click();
    }

    /**
     * Save data persistently to Foundry settings
     */
    async _saveDataPersistently() {
        try {
            // Save settlements
            const settlements = this.dataManager.getAllSettlements();
            await game.settings.set(MODULE_ID, 'customSettlements', settlements);
            
            // Save cargo types
            const cargoTypes = this.dataManager.getCargoTypes();
            await game.settings.set(MODULE_ID, 'customCargoTypes', cargoTypes);
            
            console.log('Trading Places | Data saved persistently');
        } catch (error) {
            console.error('Trading Places | Failed to save data persistently:', error);
            ui.notifications.error('Failed to save data persistently');
        }
    }

    _addDataset() {
        const content = `
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Dataset Name:</label>
                    <input type="text" id="dataset-name" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 3px;" placeholder="Enter a unique name for the dataset">
                </div>
                <div style="margin-bottom: 10px;">
                    <p style="font-size: 0.9em; color: #666;">
                        This will create a new user dataset based on the currently active dataset. 
                        You can then modify settlements and cargo types in this dataset.
                    </p>
                </div>
            </div>
        `;

        new foundry.applications.api.DialogV2({
            window: { title: "Add New Dataset" },
            content: content,
            buttons: [{
                action: "save",
                label: "Create",
                callback: async (event, button, dialog) => {
                    const element = dialog.element;
                    const datasetName = element.querySelector('#dataset-name').value.trim();
                    
                    if (!datasetName) {
                        ui.notifications.error('Dataset name is required');
                        return;
                    }
                    
                    try {
                        await this.dataManager.createUserDataset(datasetName);
                        ui.notifications.info(`Dataset "${datasetName}" created successfully`);
                        
                        // Switch to the new dataset
                        await this._switchDataset(datasetName);
                        
                        this.render(); // Refresh the dialog
                    } catch (error) {
                        ui.notifications.error(`Failed to create dataset: ${error.message}`);
                    }
                }
            }, {
                action: "cancel",
                label: "Cancel"
            }]
        }).render(true);
    }

    _deleteDataset(datasetName) {
        console.log('DELETE DATASET: _deleteDataset called with datasetName =', datasetName);
        if (!datasetName) {
            ui.notifications.error('Dataset name is required');
            return;
        }

        // Check if it's a built-in dataset
        const datasets = this._getAvailableDatasets();
        console.log('DELETE DATASET: available datasets =', datasets);
        const dataset = datasets.find(d => d.id === datasetName);
        console.log('DELETE DATASET: found dataset =', dataset);

        if (dataset && dataset.type === 'built-in') {
            ui.notifications.error('Cannot delete built-in datasets');
            return;
        }

        foundry.applications.api.DialogV2.confirm({
            window: {
                title: "Delete Dataset",
                resizable: false
            },
            position: {
                width: 400,
                height: 'auto'
            },
            content: `<p>Are you sure you want to delete the dataset "${datasetName}"?</p><p style="color: #ff6b6b; font-weight: bold;">This action cannot be undone.</p>`,
            buttons: [{
                action: "yes",
                label: "Delete",
                default: false,
                callback: async (event, button, dialog) => {
                    console.log('DELETE DATASET: confirmation callback called');
                    try {
                        console.log('DELETE DATASET: calling dataManager.deleteUserDataset');
                        await this.dataManager.deleteUserDataset(datasetName);
                        console.log('DELETE DATASET: deleteUserDataset completed successfully');
                        ui.notifications.info(`Dataset "${datasetName}" deleted successfully`);

                        // If we deleted the current dataset, switch to the default one
                        if (this.currentDataset === datasetName) {
                            console.log('DELETE DATASET: switching to default dataset');
                            await this._switchDataset('wfrp4e');
                        } else {
                            console.log('DELETE DATASET: refreshing dialog');
                            this.render(); // Refresh the dialog
                        }
                    } catch (error) {
                        console.error('DELETE DATASET: error during deletion:', error);
                        ui.notifications.error(`Failed to delete dataset: ${error.message}`);
                    }
                }
            }, {
                action: "no",
                label: "Cancel",
                default: true
            }]
        });
    }
}

// Config management methods
DataManagementV2.prototype._addDenomination = function() {
    const html = $(this.element);
    const denominationsList = html.find('#denominations-list');
    
    const newIndex = denominationsList.children().length;
    const canonicalAbbrev = html.find('#canonical-abbrev').val() || 'BP';
    
    const newDenomHtml = `
        <div class="trading-places-dm-denomination" data-index="${newIndex}">
            <div class="trading-places-dm-config-row">
                <label>Name:</label>
                <input type="text" class="denom-name" value="" style="flex: 1;">
            </div>
            <div class="trading-places-dm-config-row">
                <label>Plural Name:</label>
                <input type="text" class="denom-plural" value="" style="flex: 1;">
            </div>
            <div class="trading-places-dm-config-row">
                <label>Abbreviation:</label>
                <input type="text" class="denom-abbrev" value="" style="flex: 1;">
            </div>
            <div class="trading-places-dm-config-row">
                <label>Value (in ${canonicalAbbrev}):</label>
                <input type="number" class="denom-value" value="1" style="flex: 1;">
            </div>
            <div class="trading-places-dm-denomination-actions">
                <button class="trading-places-dm-btn delete-denom" data-index="${newIndex}">Remove</button>
            </div>
        </div>
    `;
    
    denominationsList.append(newDenomHtml);
    
    // Reattach event handlers for the new element
    denominationsList.find('.delete-denom').last().click((e) => {
        const index = $(e.currentTarget).data('index');
        this._deleteDenomination(index);
    });
};

DataManagementV2.prototype._deleteDenomination = function(index) {
    const html = $(this.element);
    html.find(`.trading-places-dm-denomination[data-index="${index}"]`).remove();
    
    // Re-index remaining denominations
    html.find('.trading-places-dm-denomination').each((i, elem) => {
        $(elem).attr('data-index', i);
        $(elem).find('.delete-denom').attr('data-index', i);
    });
};

DataManagementV2.prototype._saveConfig = async function() {
    try {
        const html = $(this.element);
        
        // Get current config
        const currentConfig = this.dataManager.getConfig();
        
        // Build updated config
        const updatedConfig = {
            ...currentConfig,
            currency: {
                ...currentConfig.currency,
                canonicalUnit: {
                    name: html.find('#canonical-name').val(),
                    abbreviation: html.find('#canonical-abbrev').val(),
                    value: 1 // Always 1
                },
                denominations: [],
                rounding: "nearest", // Always nearest
                display: {
                    order: html.find('#display-order').val().split(',').map(s => s.trim()).filter(s => s),
                    includeZeroDenominations: false, // Always false
                    separator: " " // Always space
                }
            }
        };
        
        // Collect denominations
        html.find('.trading-places-dm-denomination').each((i, elem) => {
            const $elem = $(elem);
            updatedConfig.currency.denominations.push({
                name: $elem.find('.denom-name').val(),
                pluralName: $elem.find('.denom-plural').val(),
                abbreviation: $elem.find('.denom-abbrev').val(),
                value: parseInt($elem.find('.denom-value').val()) || 1
            });
        });
        
        // Validate the config
        if (!updatedConfig.currency.canonicalUnit.name || !updatedConfig.currency.canonicalUnit.abbreviation) {
            ui.notifications.error('Canonical unit name and abbreviation are required');
            return;
        }
        
        // Check for duplicate abbreviations
        const abbrevs = updatedConfig.currency.denominations.map(d => d.abbreviation);
        if (new Set(abbrevs).size !== abbrevs.length) {
            ui.notifications.error('Currency abbreviations must be unique');
            return;
        }
        
        // Save the config
        await this.dataManager.updateConfig(updatedConfig);
        
        ui.notifications.info('Configuration saved successfully');
        
        // Refresh the UI
        this.render();
        
    } catch (error) {
        console.error('Failed to save config:', error);
        ui.notifications.error(`Failed to save configuration: ${error.message}`);
    }
};

DataManagementV2.prototype._resetConfig = async function() {
    foundry.applications.api.DialogV2.confirm({
        window: { title: "Reset Configuration" },
        content: `<p>Are you sure you want to reset the currency configuration to defaults?</p><p>This will restore the original WFRP4e currency settings.</p>`,
        yes: async () => {
            try {
                // Reset to default WFRP4e config
                const defaultConfig = {
                    systemName: "wfrp4e",
                    minimumSystemVersion: "7.0.0",
                    currency: {
                        canonicalUnit: {
                            name: "Brass Penny",
                            abbreviation: "BP",
                            value: 1
                        },
                        denominations: [
                            {
                                name: "Gold Crown",
                                pluralName: "Gold Crowns",
                                abbreviation: "GC",
                                value: 240
                            },
                            {
                                name: "Silver Shilling",
                                pluralName: "Silver Shillings",
                                abbreviation: "SS",
                                value: 12
                            }
                        ],
                        rounding: "nearest",
                        display: {
                            order: ["GC", "SS", "BP"],
                            includeZeroDenominations: false,
                            separator: " "
                        }
                    },
                    inventory: {
                        field: "items",
                        addMethod: "createEmbeddedDocuments"
                    },
                    skills: {
                        haggle: "system.skills.haggle.total",
                        gossip: "system.skills.gossip.total"
                    },
                    talents: {
                        dealmaker: "system.talents.dealmaker"
                    }
                };
                
                await this.dataManager.updateConfig(defaultConfig);
                ui.notifications.info('Configuration reset to defaults');
                
                // Refresh the UI
                this.render();
                
            } catch (error) {
                console.error('Failed to reset config:', error);
                ui.notifications.error(`Failed to reset configuration: ${error.message}`);
            }
        }
    });
};

// Export for global access
window.DataManagementV2 = DataManagementV2;
console.log('DataManagementV2 (ApplicationV2) loaded successfully');