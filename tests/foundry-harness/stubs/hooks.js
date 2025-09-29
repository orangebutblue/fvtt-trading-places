/**
 * Hooks system stub for Foundry harness
 * Provides event management for module initialization
 */

class HarnessHooks {
    constructor() {
        this.hooks = new Map();
        this.onceHooks = new Map();
    }

    /**
     * Register a hook that fires multiple times
     */
    on(event, callback) {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event).push(callback);
        console.log(`Foundry Harness | Registered hook: ${event}`);
    }

    /**
     * Register a hook that fires only once
     */
    once(event, callback) {
        if (!this.onceHooks.has(event)) {
            this.onceHooks.set(event, []);
        }
        this.onceHooks.get(event).push(callback);
        console.log(`Foundry Harness | Registered once hook: ${event}`);
    }

    /**
     * Remove a specific hook callback
     */
    off(event, callback) {
        if (this.hooks.has(event)) {
            const hooks = this.hooks.get(event);
            const index = hooks.indexOf(callback);
            if (index >= 0) {
                hooks.splice(index, 1);
                console.log(`Foundry Harness | Removed hook: ${event}`);
            }
        }
    }

    /**
     * Call all registered hooks for an event
     */
    async call(event, ...args) {
        console.log(`Foundry Harness | Calling hooks for: ${event}`);
        
        const results = [];
        
        // Call once hooks first (and remove them)
        if (this.onceHooks.has(event)) {
            const onceCallbacks = this.onceHooks.get(event);
            this.onceHooks.delete(event);
            
            for (const callback of onceCallbacks) {
                try {
                    const result = await callback(...args);
                    if (result !== undefined) results.push(result);
                } catch (error) {
                    console.error(`Foundry Harness | Hook error in ${event}:`, error);
                }
            }
        }
        
        // Call regular hooks
        if (this.hooks.has(event)) {
            const callbacks = this.hooks.get(event);
            
            for (const callback of callbacks) {
                try {
                    const result = await callback(...args);
                    if (result !== undefined) results.push(result);
                } catch (error) {
                    console.error(`Foundry Harness | Hook error in ${event}:`, error);
                }
            }
        }
        
        console.log(`Foundry Harness | Called ${event} hooks, ${results.length} results`);
        return results.length === 1 ? results[0] : results;
    }

    /**
     * Call hooks until one returns a non-undefined result
     */
    async callSome(event, ...args) {
        console.log(`Foundry Harness | Calling some hooks for: ${event}`);
        
        // Call once hooks first
        if (this.onceHooks.has(event)) {
            const onceCallbacks = this.onceHooks.get(event);
            this.onceHooks.delete(event);
            
            for (const callback of onceCallbacks) {
                try {
                    const result = await callback(...args);
                    if (result !== undefined) {
                        console.log(`Foundry Harness | Hook ${event} returned early result`);
                        return result;
                    }
                } catch (error) {
                    console.error(`Foundry Harness | Hook error in ${event}:`, error);
                }
            }
        }
        
        // Call regular hooks
        if (this.hooks.has(event)) {
            const callbacks = this.hooks.get(event);
            
            for (const callback of callbacks) {
                try {
                    const result = await callback(...args);
                    if (result !== undefined) {
                        console.log(`Foundry Harness | Hook ${event} returned early result`);
                        return result;
                    }
                } catch (error) {
                    console.error(`Foundry Harness | Hook error in ${event}:`, error);
                }
            }
        }
        
        return undefined;
    }

    /**
     * Get list of registered hooks for debugging
     */
    getRegisteredHooks() {
        const regular = Array.from(this.hooks.keys());
        const once = Array.from(this.onceHooks.keys());
        return { regular, once };
    }
}

export function createHooksStub() {
    return new HarnessHooks();
}

export { HarnessHooks };