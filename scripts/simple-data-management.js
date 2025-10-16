/**
 * Simple Data Management Dialog - No fancy frameworks, just working code
 */

class SimpleDataManagement {
    static show(dataManager) {
        const settlements = dataManager.getAllSettlements();
        const cargoTypes = dataManager.getCargoTypes();
        
        const content = `
            <style>
                .trading-places-simple-tabs {
                    display: flex;
                    border-bottom: 1px solid #ccc;
                    margin-bottom: 10px;
                }
                .trading-places-simple-tab {
                    padding: 8px 16px;
                    cursor: pointer;
                    border: 1px solid #ccc;
                    border-bottom: none;
                    background: #f5f5f5;
                    margin-right: 2px;
                }
                .trading-places-simple-tab.active {
                    background: white;
                    border-bottom: 1px solid white;
                    position: relative;
                    top: 1px;
                }
                .trading-places-simple-content {
                    max-height: 500px;
                    overflow-y: auto;
                    padding: 10px;
                }
                .trading-places-simple-list {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #ccc;
                    padding: 10px;
                }
                .trading-places-simple-item {
                    padding: 5px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                }
                .trading-places-simple-item:hover {
                    background: #f0f0f0;
                }
            </style>
            
            <div class="trading-places-simple-tabs">
                <div class="trading-places-simple-tab active" data-tab="settlements">Settlements (${settlements.length})</div>
                <div class="trading-places-simple-tab" data-tab="cargo">Cargo Types (${cargoTypes.length})</div>
            </div>
            
            <div class="trading-places-simple-content">
                <div id="settlements-content" class="tab-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3>Settlements</h3>
                        <button id="add-settlement">Add New Settlement</button>
                    </div>
                    <div class="trading-places-simple-list">
                        ${settlements.map(s => `
                            <div class="trading-places-simple-item">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${s.name}</strong> (${s.region}) - Wealth ${s.wealth}
                                        <br><small>Produces: ${(s.produces || []).join(', ') || 'None'}</small>
                                    </div>
                                    <div>
                                        <button class="edit-settlement" data-name="${s.name}" style="margin-right: 5px;">Edit</button>
                                        <button class="delete-settlement" data-name="${s.name}">Delete</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div id="cargo-content" class="tab-content" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3>Cargo Types</h3>
                        <button id="add-cargo">Add New Cargo Type</button>
                    </div>
                    <div class="trading-places-simple-list">
                        ${cargoTypes.map(c => `
                            <div class="trading-places-simple-item">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${c.name}</strong> (${c.category || 'No category'})
                                        <br><small>Base Price: ${c.basePrice} BP</small>
                                    </div>
                                    <div>
                                        <button class="edit-cargo" data-name="${c.name}" style="margin-right: 5px;">Edit</button>
                                        <button class="delete-cargo" data-name="${c.name}">Delete</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: "Trading Data Management",
            content: content,
            buttons: {
                close: {
                    label: "Close",
                    callback: () => {}
                }
            },
            render: (html) => {
                // Simple tab switching
                html.find('.trading-places-simple-tab').click(function() {
                    const tabId = $(this).data('tab');
                    
                    // Update tab appearance
                    html.find('.trading-places-simple-tab').removeClass('active');
                    $(this).addClass('active');
                    
                    // Show/hide content
                    html.find('.trading-places-tab-content').hide();
                    html.find(`#${tabId}-content`).show();
                });
                
                // Settlement actions
                html.find('#add-settlement').click(() => {
                    SimpleDataManagement.addSettlement(dataManager);
                });
                
                html.find('.edit-settlement').click(function() {
                    const name = $(this).data('name');
                    SimpleDataManagement.editSettlement(dataManager, name);
                });
                
                html.find('.delete-settlement').click(function() {
                    const name = $(this).data('name');
                    SimpleDataManagement.deleteSettlement(dataManager, name);
                });
                
                // Cargo actions
                html.find('#add-cargo').click(() => {
                    SimpleDataManagement.addCargo(dataManager);
                });
                
                html.find('.edit-cargo').click(function() {
                    const name = $(this).data('name');
                    SimpleDataManagement.editCargo(dataManager, name);
                });
                
                html.find('.delete-cargo').click(function() {
                    const name = $(this).data('name');
                    SimpleDataManagement.deleteCargo(dataManager, name);
                });
                
                console.log('Simple data management dialog rendered successfully');
                console.log(`Showing ${settlements.length} settlements and ${cargoTypes.length} cargo types`);
            }
        }, {
            width: 800,
            height: 600,
            resizable: true
        });

        dialog.render(true);
    }

    static addSettlement(dataManager) {
        const content = `
            <div>
                <p><label>Name: <input type="text" id="settlement-name" style="width: 200px;"></label></p>
                <p><label>Region: <input type="text" id="settlement-region" style="width: 200px;"></label></p>
                <p><label>Wealth: <select id="settlement-wealth">
                    <option value="1">1 - Poor</option>
                    <option value="2">2 - Common</option>
                    <option value="3" selected>3 - Prosperous</option>
                    <option value="4">4 - Wealthy</option>
                    <option value="5">5 - Rich</option>
                </select></label></p>
                <p><label>Population: <input type="number" id="settlement-population" value="1000" style="width: 100px;"></label></p>
                <p><label>Size: <select id="settlement-size">
                    <option value="1">1 - Small Settlement</option>
                    <option value="2">2 - Village</option>
                    <option value="3" selected>3 - Town</option>
                    <option value="4">4 - Large Town</option>
                    <option value="5">5 - City</option>
                </select></label></p>
                <p><label>Ruler: <input type="text" id="settlement-ruler" value="Local Authority" style="width: 200px;"></label></p>
                <p><label>Notes: <textarea id="settlement-notes" style="width: 300px; height: 60px;" placeholder="Optional notes about this settlement"></textarea></label></p>
            </div>
        `;

        new Dialog({
            title: "Add New Settlement",
            content: content,
            buttons: {
                save: {
                    label: "Save",
                    callback: async (html) => {
                        const newSettlement = {
                            name: html.find('#settlement-name').val(),
                            region: html.find('#settlement-region').val(),
                            wealth: parseInt(html.find('#settlement-wealth').val()),
                            population: parseInt(html.find('#settlement-population').val()),
                            size: parseInt(html.find('#settlement-size').val()),
                            ruler: html.find('#settlement-ruler').val(),
                            notes: html.find('#settlement-notes').val(),
                            produces: [],
                            demands: [],
                            flags: []
                        };
                        
                        try {
                            await dataManager.updateSettlement(newSettlement);
                            ui.notifications.info(`Settlement "${newSettlement.name}" added successfully`);
                            // Close current dialog and reopen to refresh
                            setTimeout(() => {
                                SimpleDataManagement.show(dataManager);
                            }, 100);
                        } catch (error) {
                            ui.notifications.error(`Failed to add settlement: ${error.message}`);
                        }
                    }
                },
                cancel: { label: "Cancel" }
            }
        }).render(true);
    }

    static editSettlement(dataManager, name) {
        const settlement = dataManager.getAllSettlements().find(s => s.name === name);
        if (!settlement) {
            ui.notifications.error(`Settlement "${name}" not found`);
            return;
        }

        const content = `
            <div>
                <p><label>Name: <input type="text" id="settlement-name" value="${settlement.name}" style="width: 200px;"></label></p>
                <p><label>Region: <input type="text" id="settlement-region" value="${settlement.region}" style="width: 200px;"></label></p>
                <p><label>Wealth: <select id="settlement-wealth">
                    <option value="1" ${settlement.wealth === 1 ? 'selected' : ''}>1 - Poor</option>
                    <option value="2" ${settlement.wealth === 2 ? 'selected' : ''}>2 - Common</option>
                    <option value="3" ${settlement.wealth === 3 ? 'selected' : ''}>3 - Prosperous</option>
                    <option value="4" ${settlement.wealth === 4 ? 'selected' : ''}>4 - Wealthy</option>
                    <option value="5" ${settlement.wealth === 5 ? 'selected' : ''}>5 - Rich</option>
                </select></label></p>
                <p><label>Population: <input type="number" id="settlement-population" value="${settlement.population || 1000}" style="width: 100px;"></label></p>
                <p><label>Size: <select id="settlement-size">
                    <option value="1" ${settlement.size === 1 ? 'selected' : ''}>1 - Small Settlement</option>
                    <option value="2" ${settlement.size === 2 ? 'selected' : ''}>2 - Village</option>
                    <option value="3" ${settlement.size === 3 ? 'selected' : ''}>3 - Town</option>
                    <option value="4" ${settlement.size === 4 ? 'selected' : ''}>4 - Large Town</option>
                    <option value="5" ${settlement.size === 5 ? 'selected' : ''}>5 - City</option>
                </select></label></p>
                <p><label>Ruler: <input type="text" id="settlement-ruler" value="${settlement.ruler || 'Local Authority'}" style="width: 200px;"></label></p>
                <p><label>Notes: <textarea id="settlement-notes" style="width: 300px; height: 60px;">${settlement.notes || ''}</textarea></label></p>
                <p><label>Produces: <input type="text" id="settlement-produces" value="${(settlement.produces || []).join(', ')}" style="width: 300px;"></label></p>
                <p><small>Separate multiple items with commas</small></p>
            </div>
        `;

        new Dialog({
            title: `Edit Settlement: ${name}`,
            content: content,
            buttons: {
                save: {
                    label: "Save",
                    callback: async (html) => {
                        const updatedSettlement = {
                            ...settlement,
                            name: html.find('#settlement-name').val(),
                            region: html.find('#settlement-region').val(),
                            wealth: parseInt(html.find('#settlement-wealth').val()),
                            population: parseInt(html.find('#settlement-population').val()),
                            size: parseInt(html.find('#settlement-size').val()),
                            ruler: html.find('#settlement-ruler').val(),
                            notes: html.find('#settlement-notes').val(),
                            produces: html.find('#settlement-produces').val().split(',').map(s => s.trim()).filter(s => s)
                        };
                        
                        try {
                            await dataManager.updateSettlement(updatedSettlement);
                            ui.notifications.info(`Settlement "${updatedSettlement.name}" updated successfully`);
                            SimpleDataManagement.show(dataManager); // Refresh the dialog
                        } catch (error) {
                            ui.notifications.error(`Failed to update settlement: ${error.message}`);
                        }
                    }
                },
                cancel: { label: "Cancel" }
            }
        }).render(true);
    }

    static deleteSettlement(dataManager, name) {
        Dialog.confirm({
            title: "Delete Settlement",
            content: `<p>Are you sure you want to delete the settlement "${name}"?</p>`,
            yes: async () => {
                try {
                    await dataManager.deleteSettlement(name);
                    ui.notifications.info(`Settlement "${name}" deleted successfully`);
                    SimpleDataManagement.show(dataManager); // Refresh the dialog
                } catch (error) {
                    ui.notifications.error(`Failed to delete settlement: ${error.message}`);
                }
            }
        });
    }

    static addCargo(dataManager) {
        const content = `
            <div>
                <p><label>Name: <input type="text" id="cargo-name" style="width: 200px;"></label></p>
                <p><label>Category: <input type="text" id="cargo-category" style="width: 200px;"></label></p>
                <p><label>Base Price (BP): <input type="number" id="cargo-price" value="100" style="width: 100px;"></label></p>
                <p><label>Description: <textarea id="cargo-description" style="width: 300px; height: 60px;" placeholder="Description of this cargo type"></textarea></label></p>
            </div>
        `;

        new Dialog({
            title: "Add New Cargo Type",
            content: content,
            buttons: {
                save: {
                    label: "Save",
                    callback: async (html) => {
                        const newCargo = {
                            name: html.find('#cargo-name').val(),
                            category: html.find('#cargo-category').val(),
                            description: html.find('#cargo-description').val(),
                            basePrice: parseInt(html.find('#cargo-price').val()),
                            seasonalModifiers: {
                                spring: 1,
                                summer: 1,
                                autumn: 1,
                                winter: 1
                            }
                        };
                        
                        try {
                            await dataManager.updateCargoType(newCargo);
                            ui.notifications.info(`Cargo type "${newCargo.name}" added successfully`);
                            SimpleDataManagement.show(dataManager); // Refresh the dialog
                        } catch (error) {
                            ui.notifications.error(`Failed to add cargo type: ${error.message}`);
                        }
                    }
                },
                cancel: { label: "Cancel" }
            }
        }).render(true);
    }

    static editCargo(dataManager, name) {
        const cargo = dataManager.getCargoTypes().find(c => c.name === name);
        if (!cargo) {
            ui.notifications.error(`Cargo type "${name}" not found`);
            return;
        }

        const content = `
            <div>
                <p><label>Name: <input type="text" id="cargo-name" value="${cargo.name}" style="width: 200px;"></label></p>
                <p><label>Category: <input type="text" id="cargo-category" value="${cargo.category || ''}" style="width: 200px;"></label></p>
                <p><label>Base Price (BP): <input type="number" id="cargo-price" value="${cargo.basePrice}" style="width: 100px;"></label></p>
                <p><label>Description: <textarea id="cargo-description" style="width: 300px; height: 60px;">${cargo.description || ''}</textarea></label></p>
            </div>
        `;

        new Dialog({
            title: `Edit Cargo Type: ${name}`,
            content: content,
            buttons: {
                save: {
                    label: "Save",
                    callback: async (html) => {
                        const updatedCargo = {
                            ...cargo,
                            name: html.find('#cargo-name').val(),
                            category: html.find('#cargo-category').val(),
                            description: html.find('#cargo-description').val(),
                            basePrice: parseInt(html.find('#cargo-price').val()),
                            seasonalModifiers: cargo.seasonalModifiers || {
                                spring: 1,
                                summer: 1,
                                autumn: 1,
                                winter: 1
                            }
                        };
                        
                        try {
                            await dataManager.updateCargoType(updatedCargo);
                            ui.notifications.info(`Cargo type "${updatedCargo.name}" updated successfully`);
                            // Close current dialog and reopen to refresh
                            setTimeout(() => {
                                SimpleDataManagement.show(dataManager);
                            }, 100);
                        } catch (error) {
                            ui.notifications.error(`Failed to update cargo type: ${error.message}`);
                        }
                    }
                },
                cancel: { label: "Cancel" }
            }
        }).render(true);
    }

    static deleteCargo(dataManager, name) {
        Dialog.confirm({
            title: "Delete Cargo Type",
            content: `<p>Are you sure you want to delete the cargo type "${name}"?</p>`,
            yes: async () => {
                try {
                    await dataManager.deleteCargoType(name);
                    ui.notifications.info(`Cargo type "${name}" deleted successfully`);
                    SimpleDataManagement.show(dataManager); // Refresh the dialog
                } catch (error) {
                    ui.notifications.error(`Failed to delete cargo type: ${error.message}`);
                }
            }
        });
    }
}

// Export for global access
window.SimpleDataManagement = SimpleDataManagement;
console.log('SimpleDataManagement loaded successfully');