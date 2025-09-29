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
        
        // Module-specific setup with proper backing store
        globalThis.game.settingsStorage = new Map();
        
        globalThis.game.settings.register = (module, key, options) => {
            const settingKey = `${module}.${key}`;
            globalThis.game.settingsStorage.set(settingKey, options.default);
            console.log(`Foundry Harness | Registered setting: ${settingKey} = ${options.default}`);
        };
        
        globalThis.game.settings.get = (module, key) => {
            const settingKey = `${module}.${key}`;
            return globalThis.game.settingsStorage.get(settingKey) || null;
        };
        
        globalThis.game.settings.set = (module, key, value) => {
            const settingKey = `${module}.${key}`;
            globalThis.game.settingsStorage.set(settingKey, value);
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
            // Go up from harness directory to project root
            const moduleRoot = path.resolve(currentDir, '../..');
            
            // Import main module file
            const mainPath = path.resolve(moduleRoot, 'scripts/main.js');
            console.log(`Foundry Harness | Loading main module from: ${mainPath}`);
            
            // Check if file exists first
            const fsModule = await import('fs');
            const moduleExists = fsModule.existsSync(mainPath);
            const allowModuleFailure = process.env.HARNESS_ALLOW_MODULE_FAILURE === '1';
            
            if (!moduleExists) {
                if (allowModuleFailure) {
                    console.log('Foundry Harness | Main module file not found, skipping module load');
                    console.log('Foundry Harness | This is expected during early development');
                } else {
                    throw new Error('Main module file not found and HARNESS_ALLOW_MODULE_FAILURE is not set');
                }
            } else {
                // File exists, attempt to load it
                try {
                    this.modules.main = await import(`file://${mainPath}`);
                    console.log('Foundry Harness | Module code loaded successfully');
                } catch (importError) {
                    if (allowModuleFailure) {
                        console.log('Foundry Harness | Module loading failed (allowed):', importError.message);
                        console.log('Foundry Harness | Continuing with mock-only mode...');
                    } else {
                        console.error('Foundry Harness | Module loading failed:', importError.message);
                        throw new Error(`Failed to load existing module: ${importError.message}`);
                    }
                }
            }
            
            // Trigger Foundry hooks to initialize the module
            await globalThis.Hooks.call('init');
            await globalThis.Hooks.call('ready');
            
            if (this.modules.main) {
                console.log('Foundry Harness | Module code loaded and initialized');
            } else {
                console.log('Foundry Harness | Running in mock-only mode');
            }
        } catch (error) {
            console.error('Foundry Harness | Critical module loading error:', error.message);
            throw error;
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
        
        // Serve templates with proper Foundry CSS
        server.get('/render/:template', async (req, res) => {
            try {
                const { renderTemplate } = await this._getTemplateRenderer();
                const templatePath = `modules/trading-places/templates/${req.params.template}`;
                const data = req.query.data ? JSON.parse(req.query.data) : {};
                
                const html = await renderTemplate(templatePath, data);
                
                // Wrap in proper HTML with Foundry CSS variables
                const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Trading Places - ${req.params.template}</title>
    <style>
        :root {
            --color-bg: #f8f9fa;
            --color-bg-alt: #e9ecef;
            --color-bg-option: #dee2e6;
            --color-border: #ced4da;
            --color-border-dark: #adb5bd;
            --color-border-highlight: #007bff;
            --color-text-dark-primary: #212529;
            --color-text-dark-secondary: #6c757d;
            --color-green: #28a745;
            --color-green-dark: #1e7e34;
            --color-green-light: #d4edda;
            --color-red: #dc3545;
            --color-red-dark: #c82333;
            --color-red-light: #f8d7da;
            --color-blue: #007bff;
            --color-blue-dark: #0056b3;
            --color-blue-light: #cce7ff;
            --color-yellow: #ffc107;
            --color-yellow-dark: #d39e00;
            --color-yellow-light: #fff3cd;
            --color-gray: #6c757d;
        }
        body {
            margin: 0;
            padding: 20px;
            font-family: "Signika", sans-serif;
            background: var(--color-bg);
            color: var(--color-text-dark-primary);
        }
    </style>
    <link rel="stylesheet" href="/styles/data-management.css">
    <link rel="stylesheet" href="/styles/trading-dialog-enhanced.css">
    <link rel="stylesheet" href="/styles/trading.css">
</head>
<body>
${html}
</body>
</html>`;
                
                res.send(fullHtml);
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
                // Handle both full paths and relative paths
                let fullPath;
                if (templatePath.startsWith('modules/trading-places/')) {
                    fullPath = path.resolve(__dirname, '../../..', templatePath.replace('modules/trading-places/', ''));
                } else if (templatePath.startsWith('templates/')) {
                    fullPath = path.resolve(__dirname, '../../..', templatePath);
                } else {
                    fullPath = path.resolve(__dirname, '../../..', 'templates', templatePath);
                }
                
                console.log(`Foundry Harness | Rendering template: ${fullPath}`);
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