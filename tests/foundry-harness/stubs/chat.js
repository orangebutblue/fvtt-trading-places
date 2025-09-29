/**
 * Chat system stub for Foundry harness
 * Captures and logs chat messages for testing
 */

const chatLog = [];

class HarnessChatMessage {
    constructor(data = {}) {
        this.id = data.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.content = data.content || '';
        this.type = data.type || 'other';
        this.user = data.user || 'harness-user';
        this.speaker = data.speaker || { alias: 'System' };
        this.timestamp = Date.now();
        this.roll = data.roll || null;
        
        // Store in chat log
        chatLog.push(this);
        
        console.log(`Foundry Harness | Chat Message [${this.type}]: ${this.content}`);
    }

    // Static methods
    static async create(data, options = {}) {
        return new HarnessChatMessage(data);
    }

    static getSpeaker(actor) {
        if (!actor) {
            return { alias: 'GM', actor: null };
        }
        
        return {
            alias: actor.name || 'Unknown',
            actor: actor.id
        };
    }
}

export function createChatStub() {
    return HarnessChatMessage;
}

// Chat log utilities
export function getChatLog() {
    return [...chatLog];
}

export function clearChatLog() {
    chatLog.length = 0;
    console.log('Foundry Harness | Chat log cleared');
}

export function getMessagesOfType(type) {
    return chatLog.filter(msg => msg.type === type);
}

export function getLastMessage() {
    return chatLog[chatLog.length - 1] || null;
}

export function findMessageContaining(text) {
    return chatLog.find(msg => msg.content.includes(text));
}

// Assertion helpers for tests
export function assertChatContains(text) {
    const found = findMessageContaining(text);
    if (!found) {
        throw new Error(`Expected chat to contain "${text}", but no matching message found. Messages: ${chatLog.map(m => m.content).join(', ')}`);
    }
    return found;
}

export function assertChatMessageCount(expectedCount) {
    if (chatLog.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} chat messages, but found ${chatLog.length}`);
    }
}

export function assertLastMessageContains(text) {
    const lastMsg = getLastMessage();
    if (!lastMsg) {
        throw new Error('No chat messages found');
    }
    if (!lastMsg.content.includes(text)) {
        throw new Error(`Expected last message to contain "${text}", but got: "${lastMsg.content}"`);
    }
    return lastMsg;
}