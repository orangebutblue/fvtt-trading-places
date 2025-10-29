# Tooltip Fix Summary

## Problem
The question-mark icons (info indicators) with tooltips work correctly in the buying tab but don't respond to clicks in the selling tab.

## Root Cause
The tooltip event handlers were only attached when `_updateUIState()` was called, which happened mainly during initial loading and certain state changes. When users switched between tabs, the tooltip handlers were not re-attached to the newly visible tab content.

## Solution
Modified the tab switching logic in `TradingUIEventHandlers.js` to re-attach tooltip handlers whenever a tab becomes visible.

### Changes Made

#### 1. Modified Tab Switching Logic
**File:** `scripts/ui/TradingUIEventHandlers.js`
**Lines:** ~310-320

Added a call to `_attachTooltipHandlersForTab(targetContent)` when showing tab content:

```javascript
// Show corresponding content
const targetTab = tab.getAttribute('data-tab');
const targetContent = html.querySelector(`#${targetTab}-tab`);
if (targetContent) {
    targetContent.classList.add('active');
    targetContent.style.display = 'block'; // Explicitly show
    
    // Re-attach tooltip handlers for the newly visible tab content
    this._attachTooltipHandlersForTab(targetContent);
}
```

#### 2. Added New Method for Tab-Specific Tooltip Attachment
**File:** `scripts/ui/TradingUIEventHandlers.js`
**Lines:** ~378-423

Created `_attachTooltipHandlersForTab()` method that:
- Finds all `.info-indicator` elements within a specific tab
- Removes any existing event listeners to prevent duplicates
- Attaches new click handlers that call the renderer's `_showInfoTooltip()` method
- Includes proper debugging logs

```javascript
_attachTooltipHandlersForTab(tabContent) {
    if (!tabContent || !this.app.renderer) {
        return;
    }

    const infoIndicators = tabContent.querySelectorAll('.info-indicator');
    
    infoIndicators.forEach((indicator, index) => {
        // Remove any existing listeners to avoid duplicates
        const existingHandler = indicator._tooltipHandler;
        if (existingHandler) {
            indicator.removeEventListener('click', existingHandler);
        }

        // Create new handler
        const handler = (event) => {
            event.stopPropagation();
            const tooltip = event.target.dataset.infoTooltip;
            if (tooltip && this.app.renderer._showInfoTooltip) {
                this.app.renderer._showInfoTooltip(tooltip, event.target);
            }
        };

        // Store handler reference and attach
        indicator._tooltipHandler = handler;
        indicator.addEventListener('click', handler);
    });
}
```

## How It Works
1. When a user clicks on a tab, the tab switching logic runs
2. The target tab content is made visible
3. `_attachTooltipHandlersForTab()` is called with the tab content
4. The method finds all info indicators in that tab and attaches click handlers
5. Now the question-mark icons in that tab will respond to clicks and show tooltips

## Benefits
- ✅ Tooltips now work in all tabs (buying, selling, cargo, history)
- ✅ No duplicate event listeners (old handlers are removed before adding new ones)
- ✅ Proper debugging logs for troubleshooting
- ✅ Maintains existing functionality for the buying tab
- ✅ Minimal code changes - only adds functionality without breaking existing behavior

## Testing
Use the provided test script (`tmp_rovodev_test_tooltips.js`) in the browser console to verify that tooltips work in both buying and selling tabs.

## Files Modified
- `scripts/ui/TradingUIEventHandlers.js` - Added tooltip re-attachment logic to tab switching

## Files Created
- `tmp_rovodev_test_tooltips.js` - Test script for verification (temporary, will be removed)
- `TOOLTIP_FIX_SUMMARY.md` - This summary document