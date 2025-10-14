// Manual region dropdown refresh - temporary fix
console.log('REGION DROPDOWN - Manual refresh script loaded');

// Add a refresh button to the trading interface
setTimeout(() => {
    const regionSelect = document.querySelector('#region-select');
    if (regionSelect && !document.querySelector('#manual-region-refresh')) {
        const button = document.createElement('button');
        button.id = 'manual-region-refresh';
        button.textContent = 'Refresh Regions';
        button.style.cssText = 'margin-left: 10px; padding: 5px 10px; background: #007acc; color: white; border: none; border-radius: 3px; cursor: pointer;';
        
        button.onclick = () => {
            console.log('REGION DROPDOWN - Manual refresh button clicked');
            
            // Get all settlements from the data manager
            const tradingApp = window.TradingPlacesApplication?.currentInstance;
            if (tradingApp?.dataManager) {
                const settlements = tradingApp.dataManager.getAllSettlements();
                const regions = [...new Set(settlements.map(s => s.region))].sort();
                
                console.log('REGION DROPDOWN - Found settlements:', settlements.length);
                console.log('REGION DROPDOWN - Found regions:', regions);
                
                // Update dropdown
                regionSelect.innerHTML = '<option value="">Select a region...</option>';
                regions.forEach(region => {
                    const option = document.createElement('option');
                    option.value = region;
                    option.textContent = region;
                    regionSelect.appendChild(option);
                });
                
                console.log('REGION DROPDOWN - Updated with all regions including custom ones');
                ui.notifications.info(`Region dropdown updated with ${regions.length} regions`);
            }
        };
        
        regionSelect.parentNode.appendChild(button);
        console.log('REGION DROPDOWN - Manual refresh button added to trading interface');
    }
}, 1000);