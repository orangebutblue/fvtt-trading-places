/**
 * Dice rolling stub for Foundry harness
 * Provides pseudo-random rolls with optional seeding for deterministic tests
 */

class SeededRandom {
    constructor(seed = 12345) {
        this.seed = seed;
        this.current = seed;
    }

    random() {
        // Simple linear congruential generator
        this.current = (this.current * 1664525 + 1013904223) % Math.pow(2, 32);
        return this.current / Math.pow(2, 32);
    }

    roll(sides) {
        return Math.floor(this.random() * sides) + 1;
    }
}

let rng = new SeededRandom();

export function createDiceStub(seed = 12345) {
    rng = new SeededRandom(seed);
    
    class Roll {
        constructor(formula, data = {}) {
            this.formula = formula;
            this.data = data;
            this.terms = [];
            this.total = null;
            this._evaluated = false;
        }

        async evaluate(options = {}) {
            if (this._evaluated) return this;
            
            // Simple dice formula parsing
            const result = this._parseAndRoll(this.formula);
            this.total = result;
            this._evaluated = true;
            
            console.log(`Foundry Harness | Dice Roll: ${this.formula} = ${this.total}`);
            return this;
        }

        _parseAndRoll(formula) {
            // Handle simple dice formulas like "1d100", "2d6+3", etc.
            const diceRegex = /(\d+)d(\d+)([+\-]\d+)?/g;
            let match;
            let total = 0;

            while ((match = diceRegex.exec(formula)) !== null) {
                const numDice = parseInt(match[1]);
                const sides = parseInt(match[2]);
                const modifier = match[3] ? parseInt(match[3]) : 0;

                let rollTotal = 0;
                for (let i = 0; i < numDice; i++) {
                    rollTotal += rng.roll(sides);
                }
                total += rollTotal + modifier;
            }

            // If no dice found, try to parse as a simple number
            if (total === 0) {
                const num = parseInt(formula);
                if (!isNaN(num)) {
                    total = num;
                }
            }

            return total;
        }

        // Static methods for creating rolls
        static async create(formula, data = {}) {
            const roll = new Roll(formula, data);
            return await roll.evaluate();
        }
    }

    // Add convenience methods
    Roll.prototype.toMessage = function(messageData = {}) {
        return {
            content: `${this.formula} = ${this.total}`,
            type: 'roll',
            roll: this,
            ...messageData
        };
    };

    return Roll;
}

export function setSeed(seed) {
    rng = new SeededRandom(seed);
}

export function rollDice(sides) {
    return rng.roll(sides);
}