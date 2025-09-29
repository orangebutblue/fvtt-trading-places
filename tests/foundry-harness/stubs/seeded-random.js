/**
 * Seeded random helper for deterministic testing
 * Provides easy access to seeded randomness without Roll syntax
 */

import { rollDice } from './dice.js';

/**
 * Get a seeded random number between 0 and 1
 * @returns {number} Random number between 0 and 1
 */
export function random() {
    // Use the dice system's seeded RNG
    return rollDice(100) / 100;
}

/**
 * Get a seeded random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    const range = max - min + 1;
    return min + Math.floor(random() * range);
}

/**
 * Get a seeded random number with variance around a base value
 * @param {number} base - Base value
 * @param {number} variance - Maximum variance (±)
 * @returns {number} Random number with variance
 */
export function randomVariance(base, variance) {
    const offset = (random() - 0.5) * 2 * variance; // -variance to +variance
    return base + offset;
}

/**
 * Choose a random element from an array
 * @param {Array} array - Array to choose from
 * @returns {*} Random element
 */
export function randomChoice(array) {
    if (!array || array.length === 0) return null;
    const index = randomInt(0, array.length - 1);
    return array[index];
}

/**
 * Shuffle an array in place using seeded randomness
 * @param {Array} array - Array to shuffle
 * @returns {Array} The same array, shuffled
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Get a random boolean with optional probability
 * @param {number} probability - Probability of true (0-1, default 0.5)
 * @returns {boolean} Random boolean
 */
export function randomBool(probability = 0.5) {
    return random() < probability;
}

/**
 * Helper for Foundry-style percentage rolls
 * @param {number} target - Target percentage (0-100)
 * @returns {object} Roll result with total and success
 */
export function percentRoll(target) {
    const roll = randomInt(1, 100);
    return {
        total: roll,
        success: roll <= target,
        margin: target - roll
    };
}