console.log('Trading Places | Loading fallback-dialogs-v2.js');

/**
 * Trading Places Module - V2 Fallback Dialogs
 * Simple V2 ApplicationV2 dialogs to replace deprecated V1 Dialog usage
 */

/**
 * Simple fallback dialog for when main trading interface fails
 */
// Check if ApplicationV2 is available before defining the class
if (typeof foundry?.applications?.api?.ApplicationV2 === 'undefined' ||
    typeof foundry?.applications?.api?.HandlebarsApplicationMixin === 'undefined') {
    console.warn('Trading Places | ApplicationV2 Handlebars mixin not available, fallback dialogs will not be loaded');
} else {
    console.log('Trading Places | ApplicationV2 available, defining WFRPFallbackDialog');

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

class WFRPFallbackDialog extends HandlebarsApplication {
    
    static DEFAULT_OPTIONS = {
        id: "wfrp-fallback-dialog",
        tag: "div",
        window: {
            title: "Trading Places (Fallback)",
            icon: "fas fa-exclamation-triangle",
            resizable: false,
            minimizable: false,
            maximizable: false
        },
        position: {
            width: 400,
            height: 200
        },
        classes: ["wfrp-fallback", "application-v2"]
    };

    static PARTS = {
        content: { 
            template: "modules/trading-places/templates/fallback-dialog.hbs"
        }
    };

    constructor(options = {}) {
        super(options);
        this.settlementsCount = options.settlementsCount || 0;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.settlementsCount = this.settlementsCount;
        return context;
    }

    static async show(settlementsCount = 0) {
        const dialog = new WFRPFallbackDialog({ settlementsCount });
        await dialog.render(true);
        return dialog;
    }
}

/**
 * Configuration error dialog for startup validation failures
 */
class WFRPConfigErrorDialog extends HandlebarsApplication {
    
    static DEFAULT_OPTIONS = {
        id: "wfrp-config-error-dialog",
        tag: "div",
        window: {
            title: "Trading Places - Configuration Error",
            icon: "fas fa-exclamation-circle",
            resizable: true,
            minimizable: false,
            maximizable: false
        },
        position: {
            width: 600,
            height: 500
        },
        classes: ["wfrp-config-error", "application-v2"]
    };

    static PARTS = {
        content: { 
            template: "modules/trading-places/templates/config-error-dialog.hbs"
        }
    };

    constructor(validationResult, recoveryProcedures, options = {}) {
        super(options);
        this.validationResult = validationResult;
        this.recoveryProcedures = recoveryProcedures;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.validationResult = this.validationResult;
        context.recoveryProcedures = this.recoveryProcedures;
        return context;
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        
        const consoleBtn = htmlElement.querySelector('.view-console-btn');
        if (consoleBtn) {
            consoleBtn.addEventListener('click', () => {
                const report = this.validationResult ? 
                    `Validation Errors: ${this.validationResult.errors.join(', ')}` : 
                    'No detailed report available';
                console.log('Trading Places | Diagnostic Report:', report);
                ui.notifications.info("Diagnostic report printed to console");
            });
        }

        const closeBtn = htmlElement.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
    }

    static async show(validationResult, recoveryProcedures) {
        const dialog = new WFRPConfigErrorDialog(validationResult, recoveryProcedures);
        await dialog.render(true);
        return dialog;
    }
}

/**
 * Simple season selection dialog
 */
class WFRPSeasonSelectionDialog extends HandlebarsApplication {
    
    static DEFAULT_OPTIONS = {
        id: "wfrp-season-selection-dialog",
        tag: "div",
        window: {
            title: "Select Trading Season",
            icon: "fas fa-calendar-alt",
            resizable: false,
            minimizable: false,
            maximizable: false
        },
        position: {
            width: 300,
            height: 200
        },
        classes: ["wfrp-season-selection", "application-v2"]
    };

    static PARTS = {
        content: { 
            template: "modules/trading-places/templates/season-selection-dialog.hbs"
        }
    };

    constructor(callback, options = {}) {
        super(options);
        this.callback = callback;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.seasons = [
            { value: 'spring', label: 'Spring' },
            { value: 'summer', label: 'Summer' },
            { value: 'autumn', label: 'Autumn' },
            { value: 'winter', label: 'Winter' }
        ];
        return context;
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);
        
        const confirmBtn = htmlElement.querySelector('.confirm-season-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const seasonSelect = htmlElement.querySelector('#season-choice');
                if (seasonSelect && this.callback) {
                    const selectedSeason = seasonSelect.value;
                    await this.callback(selectedSeason);
                    this.close();
                }
            });
        }
    }

    static async show(callback) {
        const dialog = new WFRPSeasonSelectionDialog(callback);
        await dialog.render(true);
        return dialog;
    }
}

/**
 * Simple test dialog for development
 */
class WFRPTestDialog extends HandlebarsApplication {
    
    static DEFAULT_OPTIONS = {
        id: "wfrp-test-dialog",
        tag: "div",
        window: {
            title: "Trading Test",
            icon: "fas fa-vial",
            resizable: true,
            minimizable: false,
            maximizable: false
        },
        position: {
            width: 400,
            height: 300
        },
        classes: ["wfrp-test", "application-v2"]
    };

    static PARTS = {
        content: { 
            template: "modules/trading-places/templates/trading-test.hbs"
        }
    };

    constructor(data, options = {}) {
        super(options);
        this.testData = data;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.testData = this.testData;
        return context;
    }

    static async show(data = {}) {
        const dialog = new WFRPTestDialog(data);
        await dialog.render(true);
        return dialog;
    }
}

// Export classes globally
window.WFRPFallbackDialog = WFRPFallbackDialog;
window.WFRPConfigErrorDialog = WFRPConfigErrorDialog;
window.WFRPSeasonSelectionDialog = WFRPSeasonSelectionDialog;
window.WFRPTestDialog = WFRPTestDialog;
console.log('Trading Places | V2 Fallback Dialog classes registered globally');

} // End of ApplicationV2 availability check