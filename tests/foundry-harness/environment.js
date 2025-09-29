/**
 * Foundry Harness Environment Bootstrap
 * Provides minimal Foundry VTT globals and lifecycle management for testing
 */

import { createDiceStub } from './stubs/dice.js';
import { createActorStub, createItemStub } from './stubs/actors.js';
import { createChatStub } from './stubs/chat.js';
import { createUIStub } from './stubs/ui.js';
import { createHooksStub } from './stubs/hooks.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FoundryHarness {
    constructor(options = {}) {
        this.options = {
            seed: options.seed || process.env.HARNESS_SEED || 12345,
            uiMode: options.uiMode || process.env.HARNESS_UI === '1',
            autoOpen: options.autoOpen !== false && process.env.HARNESS_NO_OPEN !== '1',
            ...options
        };
        
        this.initialized = false;
        this.modules = {};
        this.server = null;
    }

    /**
     * Initialize the Foundry environment with mocked globals
     */
    async bootstrap() {
        console.log('Foundry Harness | Bootstrapping environment...');
        
        // Set up global Foundry namespaces
        this._setupFoundryGlobals();
        
        // Load module entry points
        await this._loadModuleCode();
        
        // Set up rendered mode if requested
        if (this.options.uiMode) {
            await this._setupRenderedMode();
        }
        
        this.initialized = true;
        console.log('Foundry Harness | Environment ready');
    }

    /**
     * Set up Foundry VTT global objects with stubs
     */
    _setupFoundryGlobals() {
        console.log('Foundry Harness | Setting up Foundry globals...');
        
        // Core Foundry globals
        globalThis.game = {
            user: { isGM: true, id: 'harness-user' },
            settings: new Map(),
            modules: new Map([
                ['trading-places', { active: true, id: 'trading-places' }]
            ]),
            system: { id: 'wfrp4e', version: '7.0.0' },
            world: { id: 'harness-world' },
            actors: new Map(),
            items: new Map(),
            scenes: new Map(),
            ready: true
        };

        globalThis.CONFIG = {
            debug: {
                hooks: false
            }
        };

        globalThis.ui = createUIStub();
        globalThis.Hooks = createHooksStub();
        
        // Foundry classes
        globalThis.Actor = createActorStub();
        globalThis.Item = createItemStub();
        
        // Add dice rolling
        globalThis.Roll = createDiceStub(this.options.seed);
        
        // Chat system
        globalThis.ChatMessage = createChatStub();
        
        // Module-specific setup
        globalThis.game.settings.register = (module, key, options) => {
            const settingKey = `${module}.${key}`;
            globalThis.game.settings.set(settingKey, options.default);
            console.log(`Foundry Harness | Registered setting: ${settingKey} = ${options.default}`);
        };
        
        globalThis.game.settings.get = (module, key) => {
            const settingKey = `${module}.${key}`;
            return globalThis.game.settings.get(settingKey) || null;
        };
        
        globalThis.game.settings.set = (module, key, value) => {
            const settingKey = `${module}.${key}`;
            globalThis.game.settings.set(settingKey, value);
        };

        console.log('Foundry Harness | Foundry globals initialized');
    }

    /**
     * Load the actual module code
     */
    async _loadModuleCode() {
        console.log('Foundry Harness | Loading module code...');
        
        try {
            // Resolve module root path correctly
            const currentDir = path.dirname(__filename);
            const moduleRoot = path.resolve(currentDir, '../../..');
            
            // Import main module file
            const mainPath = path.resolve(moduleRoot, 'scripts/main.js');
            console.log(`Foundry Harness | Loading main module from: ${mainPath}`);
            
            // Check if file exists first
            const fsModule = await import('fs');
            if (!fsModule.existsSync(mainPath)) {
                console.log('Foundry Harness | Main module file not found, skipping module load');
                console.log('Foundry Harness | This is expected during early development');
                return;
            }
            
            // Use dynamic import to load the module
            this.modules.main = await import(`file://${mainPath}`);
            
            // Trigger Foundry hooks to initialize the module
            await globalThis.Hooks.call('init');
            await globalThis.Hooks.call('ready');
            
            console.log('Foundry Harness | Module code loaded and initialized');
        } catch (error) {
            console.log('Foundry Harness | Module loading failed (expected during development):', error.message);
            console.log('Foundry Harness | Continuing with mock-only mode...');
            
            // Still trigger hooks for scenario compatibility
            await globalThis.Hooks.call('init');
            await globalThis.Hooks.call('ready');
        }
    }

    /**
     * Set up rendered mode server for UI inspection
     */
    async _setupRenderedMode() {
        console.log('Foundry Harness | Setting up rendered mode...');
        
        const express = await import('express');
        const app = express.default;
        const server = app();
        
        const moduleRoot = path.resolve(__dirname, '../../..');
        
        // Serve static assets
        server.use('/templates', express.static(path.join(moduleRoot, 'templates')));
        server.use('/styles', express.static(path.join(moduleRoot, 'styles')));
        server.use('/lang', express.static(path.join(moduleRoot, 'lang')));
        
        // Handlebars helper for rendering templates
        server.get('/render/:template', async (req, res) => {
            try {
                const { renderTemplate } = await this._getTemplateRenderer();
                const templatePath = `modules/trading-places/templates/${req.params.template}`;
                const data = req.query.data ? JSON.parse(req.query.data) : {};
                
                const html = await renderTemplate(templatePath, data);
                res.send(html);
            } catch (error) {
                res.status(500).send(`Template render error: ${error.message}`);
            }
        });
        
        // Start server
        const port = 3000;
        this.server = server.listen(port, async () => {
            console.log(`Foundry Harness | Rendered mode server running at http://localhost:${port}`);
            
            if (this.options.autoOpen) {
                try {
                    const openModule = await import('open');
                    const openFunc = openModule.default;
                    await openFunc(`http://localhost:${port}/templates/trading-dialog.hbs`);
                } catch (error) {
                    console.log('Foundry Harness | Could not auto-open browser:', error.message);
                }
            }
        });
    }

    /**
     * Get a template renderer (simplified Handlebars)
     */
    async _getTemplateRenderer() {
        const handlebarsModule = await import('handlebars');
        const handlebars = handlebarsModule.default;
        const fsModule = await import('fs');
        const utilModule = await import('util');
        const readFile = utilModule.promisify(fsModule.readFile);
        
        return {
            renderTemplate: async (templatePath, data) => {
                const fullPath = path.resolve(__dirname, '../../..', templatePath.replace('modules/trading-places/', ''));
                const templateSource = await readFile(fullPath, 'utf8');
                const template = handlebars.compile(templateSource);
                return template(data);
            }
        };
    }

    /**
     * Wait for harness to be ready
     */
    async ready() {
        if (!this.initialized) {
            await this.bootstrap();
        }
        return this;
    }

    /**
     * Clean up resources
     */
    async teardown() {
        console.log('Foundry Harness | Tearing down...');
        
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        
        // Reset globals
        delete globalThis.game;
        delete globalThis.CONFIG;
        delete globalThis.ui;
        delete globalThis.Hooks;
        delete globalThis.Actor;
        delete globalThis.Item;
        delete globalThis.Roll;
        delete globalThis.ChatMessage;
        
        this.initialized = false;
        console.log('Foundry Harness | Teardown complete');
    }

    /**
     * Render a template with data (for scenarios)
     */
    async renderTemplate(templateName, data = {}) {
        if (!this.options.uiMode) {
            console.log(`Foundry Harness | Template render skipped (headless mode): ${templateName}`);
            return null;
        }
        
        try {
            const { renderTemplate } = await this._getTemplateRenderer();
            const templatePath = `templates/${templateName}`;
            return await renderTemplate(templatePath, data);
        } catch (error) {
            console.error(`Foundry Harness | Template render failed: ${error.message}`);
            return null;
        }
    }
}

// Export singleton instance
let harnessInstance = null;

export function getHarness(options = {}) {
    if (!harnessInstance) {
        harnessInstance = new FoundryHarness(options);
    }
    return harnessInstance;
}

export async function resetHarness() {
    if (harnessInstance) {
        await harnessInstance.teardown();
        harnessInstance = null;
    }
}

export { FoundryHarness };