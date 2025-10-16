/**
 * Data Management using ApplicationV2 - No more deprecation warnings!
 */

const MODULE_ID = "fvtt-trading-places";

class DataManagementV2 extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    constructor(dataManager, options = {}) {
        super(options);
        this.dataManager = dataManager;
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
                width: 900,
                height: 700
            },
            window: {
                resizable: true,
                minimizable: false
            }
        });
    }

    async _prepareContext(options) {
        const settlements = this.dataManager.getAllSettlements();
        const cargoTypes = this.dataManager.getCargoTypes();
        
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
            searchFilters: this.searchFilters
        };
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        return context;
    }

    async _renderHTML(context, options) {
        const html = `
            <style>
                .trading-places-dm-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    font-family: var(--font-primary);
                    background: var(--color-bg);
                    color: white;
                }
                .trading-places-dm-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-bg-alt);
                    margin: 0;
                    padding: 0;
                }
                .trading-places-dm-tab {
                    padding: 12px 20px;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    font-weight: bold;
                    border-bottom: 2px solid transparent;
                    color: #cccccc;
                    transition: all 0.2s;
                }
                .trading-places-dm-tab.active {
                    background: var(--color-bg);
                    border-bottom-color: var(--color-border-highlight);
                    color: white;
                }
                .trading-places-dm-tab:hover:not(.active) {
                    background: var(--color-bg-option);
                    color: white;
                }
                .trading-places-dm-content {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    background: var(--color-bg);
                }
                .trading-places-dm-tab-panel {
                    display: none;
                    flex: 1;
                    flex-direction: column;
                    padding: 15px;
                    overflow: hidden;
                }
                .trading-places-dm-tab-panel.active {
                    display: flex;
                }
                .trading-places-dm-search {
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .trading-places-dm-search input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid var(--color-border);
                    border-radius: 3px;
                    font-size: 14px;
                    background: var(--color-bg);
                    color: white;
                }
                .trading-places-dm-search input:focus {
                    border-color: var(--color-border-highlight);
                    outline: none;
                    box-shadow: 0 0 5px var(--color-shadow-highlight);
                }
                .trading-places-dm-add-btn {
                    background: var(--color-bg-option);
                    color: white;
                    border: 1px solid var(--color-border);
                    padding: 8px 16px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .trading-places-dm-add-btn:hover {
                    background: var(--color-border-highlight);
                    border-color: var(--color-border-highlight);
                    color: white;
                }
                .trading-places-dm-import-btn {
                    background: var(--color-bg);
                    color: white;
                    border: 1px solid var(--color-border);
                    padding: 8px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .trading-places-dm-import-btn:hover {
                    background: var(--color-bg-option);
                    border-color: var(--color-border-highlight);
                }
                .trading-places-dm-export-btn {
                    background: var(--color-bg);
                    color: white;
                    border: 1px solid var(--color-border);
                    padding: 8px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .trading-places-dm-export-btn:hover {
                    background: var(--color-bg-option);
                    border-color: var(--color-border-highlight);
                }
                .trading-places-dm-list {
                    flex: 1;
                    overflow-y: auto;
                    border: 1px solid var(--color-border);
                    border-radius: 3px;
                    background: var(--color-bg);
                }
                .trading-places-dm-region {
                    background: var(--color-bg-alt);
                    padding: 10px 15px;
                    font-weight: bold;
                    border-bottom: 1px solid var(--color-border);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: white;
                }
                .trading-places-dm-region:hover {
                    background: var(--color-bg-option);
                }
                .trading-places-dm-region.collapsed + .trading-places-dm-settlements {
                    display: none;
                }
                .trading-places-dm-settlements {
                    border-bottom: 1px solid var(--color-border);
                }
                .trading-places-dm-item {
                    padding: 12px 15px;
                    border-bottom: 1px solid var(--color-border-light);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--color-bg);
                    margin-left: 20px;
                    border-left: 3px solid var(--color-border-light);
                }
                .trading-places-dm-item:hover {
                    background: var(--color-bg-option);
                    border-left-color: var(--color-border-highlight);
                }
                .trading-places-dm-item:last-child {
                    border-bottom: none;
                }
                .trading-places-dm-item-info {
                    flex: 1;
                }
                .trading-places-dm-item-name {
                    font-weight: bold;
                    color: white;
                    font-size: 14px;
                }
                .trading-places-dm-item-details {
                    font-size: 12px;
                    color: #cccccc;
                    margin-top: 3px;
                }
                .trading-places-dm-item-actions {
                    display: flex;
                    gap: 6px;
                }
                .trading-places-dm-btn {
                    padding: 6px 12px;
                    border: 1px solid var(--color-border);
                    background: var(--color-bg);
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 12px;
                    transition: all 0.2s;
                    color: white;
                }
                .trading-places-dm-btn:hover {
                    background: var(--color-bg-option);
                }
                .trading-places-dm-btn.edit:hover {
                    border-color: var(--color-border-highlight);
                    background: var(--color-border-highlight);
                    color: white;
                }
                .trading-places-dm-btn.delete:hover {
                    border-color: #dc3545;
                    background: #dc3545;
                    color: white;
                }
                .trading-places-dm-expand-icon {
                    transition: transform 0.2s;
                    color: #cccccc;
                }
                .collapsed .trading-places-dm-expand-icon {
                    transform: rotate(-90deg);
                }
                
                /* Cargo items without indentation */
                .trading-places-dm-tab-panel[data-panel="cargo"] .trading-places-dm-item {
                    margin-left: 0;
                    border-left: none;
                }
            </style>
            
            <div class="trading-places-dm-container">
                <div class="trading-places-dm-tabs">
                    <button class="trading-places-dm-tab active" data-tab="settlements">
                        Settlements (${Object.values(context.settlementsByRegion).flat().length})
                    </button>
                    <button class="trading-places-dm-tab" data-tab="cargo">
                        Cargo Types (${context.cargoTypes.length})
                    </button>
                </div>
                
                <div class="trading-places-dm-content">
                    <!-- Settlements Tab -->
                    <div class="trading-places-dm-tab-panel active" data-panel="settlements">
                        <div class="trading-places-dm-search">
                            <input type="text" placeholder="Search settlements and regions..." class="trading-places-dm-search-input" data-type="settlements">
                            <button class="trading-places-dm-export-btn" data-action="export-settlements" title="Export settlements data">Export</button>
                            <button class="trading-places-dm-import-btn" data-action="import-settlements" title="Import settlements data">Import</button>
                            <button class="trading-places-dm-add-btn" data-action="add-settlement">Add Settlement</button>
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
                        
                        // Save data persistently
                        await this._saveDataPersistently();
                        
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
                        
                        // Save data persistently
                        await this._saveDataPersistently();
                        
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
        foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Settlement" },
            content: `<p>Are you sure you want to delete the settlement "${name}"?</p>`,
            yes: async () => {
                try {
                    await this.dataManager.deleteSettlement(name);
                    ui.notifications.info(`Settlement "${name}" deleted successfully`);
                    
                    // Refresh the main trading interface region dropdown directly
                    const regionDropdown = document.querySelector('#region-select');
                    if (regionDropdown) {
                        console.log('FOUND REGION DROPDOWN - UPDATING DIRECTLY (DELETE)');
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
                        console.log('REGION DROPDOWN UPDATED WITH REGIONS (DELETE):', regions);
                    }
                    
                    // Save data persistently
                    await this._saveDataPersistently();
                    
                    this.render(); // Refresh the dialog
                } catch (error) {
                    ui.notifications.error(`Failed to delete settlement: ${error.message}`);
                }
            }
        });
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
                        
                        // Save data persistently
                        await this._saveDataPersistently();
                        
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
                        
                        // Save data persistently
                        await this._saveDataPersistently();
                        
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
                    
                    // Save data persistently
                    await this._saveDataPersistently();
                    
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
                        }
                        
                        // Import settlements
                        for (const settlement of settlements) {
                            await this.dataManager.updateSettlement(settlement);
                        }
                        
                        ui.notifications.info(`Successfully imported ${settlements.length} settlements`);
                        
                        // Save data persistently and refresh
                        await this._saveDataPersistently();
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
                        
                        // Save data persistently and refresh
                        await this._saveDataPersistently();
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
}

// Export for global access
window.DataManagementV2 = DataManagementV2;
console.log('DataManagementV2 (ApplicationV2) loaded successfully');