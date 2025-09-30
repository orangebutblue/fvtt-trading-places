/**
 * Validation Mixin
 * Provides validation and user feedback functionality
 */

const ValidationMixin = {
    /**
     * Show validation error with detailed user feedback using FoundryVTT notifications
     * @param {Object} validationResult - Result from validateSettlement function
     * @param {string} context - Context where validation failed (e.g., 'buying', 'selling')
     */
    showValidationError(validationResult, context = 'trading') {
        this._logDebug('Validation Feedback', 'Showing validation error', { 
            context, 
            errorType: validationResult.errorType,
            errorCount: validationResult.errors?.length || 0
        });
        
        if (validationResult.valid) {
            this._logDebug('Validation Feedback', 'No validation errors to show');
            return;
        }
        
        // Create user-friendly error message with warning symbols
        let errorText = '';
        let notificationType = 'error';
        
        if (validationResult.errorType === 'missing_settlement') {
            errorText = '⚠️ No settlement selected. Please select a settlement first.';
            notificationType = 'warn';
        } else if (validationResult.errorType === 'validation_failed') {
            if (validationResult.errors.length === 1) {
                errorText = `⚠️ Settlement data invalid: ${validationResult.errors[0]}`;
            } else {
                errorText = `⚠️ Settlement data has ${validationResult.errors.length} validation errors. Check data validity.`;
            }
        } else {
            errorText = `⚠️ ${validationResult.error || 'Unknown validation error'}`;
        }
        
        // Show FoundryVTT notification
        if (ui.notifications) {
            ui.notifications[notificationType](errorText, { permanent: false });
        }
        
        // Log detailed errors for debugging
        if (validationResult.errors && validationResult.errors.length > 1) {
            this._logError('Validation Details', 'Multiple validation errors found', {
                errors: validationResult.errors,
                settlement: validationResult.settlement?.name || 'Unknown'
            });
        }
        
        this._logInfo('Validation Feedback', 'Validation error displayed to user', { 
            context, 
            message: errorText 
        });
    },

    /**
     * Validate settlement and show user feedback if validation fails
     * @param {Object} settlement - Settlement data to validate
     * @param {string} context - Context for error display (e.g., 'buying', 'selling')
     * @returns {Object} Validation result
     */
    validateSettlementWithFeedback(settlement, context = 'trading') {
        this._logDebug('Validation Feedback', 'Validating settlement with user feedback', { 
            context,
            settlementName: settlement?.name || 'None'
        });
        
        // Run comprehensive validation using enhanced data manager function
        const validation = this.dataManager.validateSettlement(settlement);
        
        // Show user feedback if validation failed
        if (!validation.valid) {
            this.showValidationError(validation, context);
            this._logError('Settlement Validation', 'Settlement validation failed', {
                context,
                settlement: settlement?.name || 'None',
                errors: validation.errors
            });
        } else {
            this._logDebug('Settlement Validation', 'Settlement validation passed', {
                context,
                settlement: settlement.name
            });
        }
        
        return validation;
    },

    /**
     * Clear any existing validation error notifications
     * @param {string} context - Context to clear errors for
     */
    clearValidationErrors(context = 'trading') {
        this._logDebug('Validation Feedback', 'Clearing validation errors', { context });
        // FoundryVTT notifications auto-dismiss, but we can log the clear action
        // In a future enhancement, we could track notification IDs to dismiss them manually
    }
};

// Export the mixin
window.ValidationMixin = ValidationMixin;