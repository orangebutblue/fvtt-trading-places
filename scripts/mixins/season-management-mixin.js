/**
 * Season Management Mixin
 * Handles season selection, persistence, and seasonal price updates
 */

const SeasonManagementMixin = {
    /**
     * Get current trading season
     * @returns {string|null} - Current season or null if not set
     */
    getCurrentSeason() {
        return this.currentSeason || this.tradingEngine?.getCurrentSeason();
    },

    /**
     * Set current trading season
     * @param {string} season - Season name
     */
    async setCurrentSeason(season) {
        const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
        if (!validSeasons.includes(season)) {
            throw new Error(`Invalid season: ${season}`);
        }

        this._logInfo('Season Management', `Setting current season to: ${season}`);

        this.currentSeason = season;

        // Update trading engine
        if (this.tradingEngine) {
            this.tradingEngine.setCurrentSeason(season);
        }

        // Update FoundryVTT setting
        await game.settings.set("trading-places", "currentSeason", season);

        // Update pricing for any selected cargo
        if (this.selectedCargo) {
            await this._updateCargoPricing();
        }

        // Update button states
        this._updateTransactionButtons();

        // Notify season change
        this._notifySeasonChange(season);

        this._logInfo('Season Management', `Season successfully changed to: ${season}`);
    },

    /**
     * Load current season from settings
     * @private
     */
    async _loadCurrentSeason() {
        try {
            this.currentSeason = await game.settings.get("trading-places", "currentSeason");

            if (this.tradingEngine && this.currentSeason) {
                this.tradingEngine.setCurrentSeason(this.currentSeason);
            }

            this._logDebug('Season Management', 'Current season loaded from settings', { season: this.currentSeason });
        } catch (error) {
            this._logError('Season Management', 'Failed to load current season from settings', { error: error.message });
            this.currentSeason = null;
        }
    },

    /**
     * Update seasonal pricing for all displayed cargo
     * @private
     */
    async _updateCargoPricing() {
        const tradableCargo = this.availableCargo.filter(cargo => cargo?.isSlotAvailable);
        if (!this.currentSeason || tradableCargo.length === 0) {
            return;
        }

        try {
            this._logDebug('Pricing Update', 'Updating cargo pricing for season change');

            // Recalculate prices for all available cargo
            this.availableCargo = this.availableCargo.map(cargo => {
                if (!cargo?.isSlotAvailable) {
                    return cargo;
                }
                try {
                    const basePrice = this.tradingEngine.calculateBasePrice(
                        cargo.name,
                        this.currentSeason,
                        cargo.quality || 'average'
                    );

                    return {
                        ...cargo,
                        currentPrice: basePrice,
                        season: this.currentSeason
                    };
                } catch (error) {
                    this._logError('Pricing Update', `Failed to update price for ${cargo.name}`, { error: error.message });
                    return cargo;
                }
            });

            if (Array.isArray(this.successfulCargo)) {
                this.successfulCargo = this.availableCargo.filter(cargo => cargo?.isSlotAvailable);
            }

            // Re-render content to show updated prices
            await this.render(false);

            this._logInfo('Pricing Update', 'Cargo pricing updated successfully');

        } catch (error) {
            this._logError('Pricing Update', 'Failed to update cargo pricing', { error: error.message });
        }
    },

    /**
     * Prompt user to select season if not set
     * @private
     */
    async _promptForSeasonSelection() {
        this._logDebug('Season Management', 'Prompting user for season selection');

        if (typeof WFRPSeasonSelectionDialog !== 'undefined') {
            await WFRPSeasonSelectionDialog.show(async (selectedSeason) => {
                await this.setCurrentSeason(selectedSeason);
                await this.render(false); // Re-render main application
            });
        } else {
            // Fallback to notification
            ui.notifications.warn('Please set the season in module settings.');
        }
    },

    /**
     * Notify users of season change
     * @param {string} season - New season
     * @private
     */
    _notifySeasonChange(season) {
        ui.notifications.info(`Trading season changed to ${season}. All prices updated.`);

        // Post to chat if enabled
        this._postSeasonChangeToChat(season);

        this._logInfo('Season Management', 'Season change notification sent', { season });
    },

    /**
     * Post season change notification to chat
     * @param {string} season - New season
     * @private
     */
    async _postSeasonChangeToChat(season) {
        try {
            const content = `
                <div class="season-change">
                    <h3>Season Changed</h3>
                    <p>Trading season is now <strong>${season}</strong>. All cargo prices have been updated accordingly.</p>
                </div>
            `;

            const chatVisibility = game.settings.get("trading-places", "chatVisibility");
            const whisperTargets = chatVisibility === "gm" ? [game.user.id] : null;

            await ChatMessage.create({
                content: content,
                whisper: whisperTargets
            });

            this._logDebug('Chat Integration', 'Season change posted to chat', { season, visibility: chatVisibility });

        } catch (error) {
            this._logError('Chat Integration', 'Failed to post season change to chat', { error: error.message });
        }
    }
};

// Export the mixin
window.SeasonManagementMixin = SeasonManagementMixin;