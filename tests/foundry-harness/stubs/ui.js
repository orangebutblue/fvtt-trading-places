/**
 * UI system stub for Foundry harness
 * Provides minimal UI notifications and dialog handling
 */

class HarnessNotifications {
    static info(message, options = {}) {
        console.log(`Foundry Harness | INFO: ${message}`);
    }

    static warn(message, options = {}) {
        console.log(`Foundry Harness | WARN: ${message}`);
    }

    static error(message, options = {}) {
        console.log(`Foundry Harness | ERROR: ${message}`);
    }

    static notify(message, type = 'info', options = {}) {
        console.log(`Foundry Harness | ${type.toUpperCase()}: ${message}`);
    }
}

class HarnessDialog {
    constructor(data, options = {}) {
        this.data = data;
        this.options = options;
        this.rendered = false;
    }

    async render(force = false) {
        this.rendered = true;
        console.log(`Foundry Harness | Dialog rendered: ${this.data.title || 'Untitled'}`);
        return this;
    }

    close() {
        this.rendered = false;
        console.log(`Foundry Harness | Dialog closed: ${this.data.title || 'Untitled'}`);
    }

    static async confirm(options = {}) {
        console.log(`Foundry Harness | Confirm dialog: ${options.title || 'Confirm'} - ${options.content || ''}`);
        // Always return true for harness testing
        return true;
    }

    static async prompt(options = {}) {
        console.log(`Foundry Harness | Prompt dialog: ${options.title || 'Prompt'} - ${options.content || ''}`);
        // Return default value or empty string
        return options.default || '';
    }
}

class HarnessWindows {
    constructor() {
        this.apps = new Map();
    }

    render(app, force = false) {
        this.apps.set(app.id || app.constructor.name, app);
        console.log(`Foundry Harness | Window rendered: ${app.title || app.constructor.name}`);
    }

    close(appId) {
        if (this.apps.has(appId)) {
            this.apps.delete(appId);
            console.log(`Foundry Harness | Window closed: ${appId}`);
        }
    }

    get(appId) {
        return this.apps.get(appId);
    }
}

export function createUIStub() {
    return {
        notifications: HarnessNotifications,
        windows: new HarnessWindows(),
        controls: {
            tool: null,
            layer: null
        }
    };
}

export { HarnessNotifications, HarnessDialog, HarnessWindows };