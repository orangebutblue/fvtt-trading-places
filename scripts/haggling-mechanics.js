/**
 * Trading Places Module - Haggling Mechanics
 * Implements the complete haggling and skill test system
 */

console.log('Trading Places | Loading haggling-mechanics.js');

/**
 * Haggling Mechanics class for orange-realism system
 */
class HagglingMechanics {
    constructor(dataManager, tradingConfig) {
        this.dataManager = dataManager;
        this.config = tradingConfig;
        this.logger = null;
    }

    /**
     * Set the debug logger instance
     * @param {Object} logger - Debug logger instance
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Get logger or create a no-op logger if none set
     * @returns {Object} - Logger instance
     */
    getLogger() {
        if (this.logger) {
            return this.logger;
        }
        
        return {
            logDiceRoll: () => {},
            logCalculation: () => {},
            logDecision: () => {},
            logAlgorithmStep: () => {}
        };
    }

    /**
     * Perform a generic skill test
     * @param {number} baseSkill - Base skill level (0-100)
     * @param {Array} modifiers - Array of modifier objects
     * @param {string} testName - Name of the test for logging
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Skill test result
     */
    async performSkillTest(baseSkill, modifiers = [], testName = 'Skill Test', rollFunction = null) {
        const logger = this.getLogger();
        
        // Validate input
        if (typeof baseSkill !== 'number' || baseSkill < 0 || baseSkill > 100) {
            throw new Error('Player skill must be a number between 0 and 100');
        }
        
        // Calculate total modifier
        const totalModifier = modifiers.reduce((sum, mod) => sum + mod.value, 0);
        const modifiedSkill = Math.max(0, Math.min(100, baseSkill + totalModifier));
        
        // Roll dice
        const roll = rollFunction ? await rollFunction() : Math.floor(Math.random() * 100) + 1;
        
        // Determine success and degrees
        const success = roll <= modifiedSkill;
        const degrees = success ? 
            Math.floor((modifiedSkill - roll) / 10) + 1 :
            Math.floor((roll - modifiedSkill - 1) / 10) + 1;
        
        const resultDescription = `${testName} ${success ? 'Success' : 'Failure'} (${degrees} degrees)`;
        
        const result = {
            testName,
            baseSkill,
            modifiers,
            totalModifier,
            modifiedSkill,
            roll,
            success,
            degrees,
            resultDescription
        };

        logger.logDiceRoll(testName, '1d100', modifiers, roll, modifiedSkill, success, resultDescription);
        
        return result;
    }

    /**
     * Perform a haggle test between player and merchant
     * @param {number} playerSkill - Player's haggle skill
     * @param {number} merchantSkill - Merchant's haggle skill
     * @param {boolean} hasDealmakerTalent - Whether player has Dealmaker talent
     * @param {Object} options - Additional options
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Haggle test result
     */
    async performHaggleTest(playerSkill, merchantSkill, hasDealmakerTalent = false, options = {}, rollFunction = null) {
        const logger = this.getLogger();
        
        // Validate inputs
        if (typeof playerSkill !== 'number' || playerSkill < 0 || playerSkill > 100) {
            throw new Error('Player skill must be a number between 0 and 100');
        }
        if (typeof merchantSkill !== 'number' || merchantSkill < 0 || merchantSkill > 100) {
            throw new Error('Merchant skill must be a number between 0 and 100');
        }
        
        // Perform skill tests for both parties
        const playerTest = await this.performSkillTest(playerSkill, [], 'Player Haggle', rollFunction);
        const merchantTest = await this.performSkillTest(merchantSkill, [], 'Merchant Haggle', rollFunction);
        
        let success = false;
        let resultDescription = '';
        
        // Determine outcome
        if (playerTest.success && !merchantTest.success) {
            success = true;
            resultDescription = 'Player wins - merchant failed their test';
        } else if (!playerTest.success && merchantTest.success) {
            success = false;
            resultDescription = 'Merchant wins - player failed their test';
        } else if (playerTest.success && merchantTest.success) {
            // Both succeed, compare degrees
            if (playerTest.degrees > merchantTest.degrees) {
                success = true;
                resultDescription = `Player wins - ${playerTest.degrees} vs ${merchantTest.degrees} degrees of success`;
            } else {
                success = false;
                resultDescription = `Merchant wins - ${merchantTest.degrees} vs ${playerTest.degrees} degrees of success`;
            }
        } else {
            // Both fail, compare degrees
            if (playerTest.degrees < merchantTest.degrees) {
                success = true;
                resultDescription = `Player wins - ${playerTest.degrees} vs ${merchantTest.degrees} degrees of failure`;
            } else {
                success = false;
                resultDescription = `Merchant wins - ${merchantTest.degrees} vs ${playerTest.degrees} degrees of failure`;
            }
        }
        
        // Handle ties
        if (playerTest.degrees === merchantTest.degrees) {
            success = false;
            resultDescription = 'Tie - no price change';
        }
        
        const result = {
            success,
            hasDealmakertTalent: hasDealmakerTalent,
            player: playerTest,
            merchant: merchantTest,
            resultDescription
        };

        logger.logAlgorithmStep('Haggling', 'Haggle test complete', result);
        
        return result;
    }

    /**
     * Perform a gossip test to find rumors
     * @param {number} playerSkill - Player's gossip skill
     * @param {Object} options - Additional options
     * @param {Function} rollFunction - Custom roll function for testing
     * @returns {Object} - Gossip test result
     */
    async performGossipTest(playerSkill, options = {}, rollFunction = null) {
        const modifiers = [{
            name: 'Gossip Difficulty',
            value: options.difficulty || -10,
            description: 'Standard difficulty for finding rumors'
        }];
        
        return this.performSkillTest(playerSkill, modifiers, 'Gossip Test', rollFunction);
    }

    /**
     * Generate a formatted chat message for a skill test
     * @param {Object} testResult - Result from performSkillTest
     * @returns {string} - Formatted HTML message
     */
    generateSkillTestMessage(testResult) {
        const successClass = testResult.success ? 'success' : 'failure';
        
        let modifierHtml = 'No modifiers';
        if (testResult.modifiers && testResult.modifiers.length > 0) {
            modifierHtml = testResult.modifiers.map(mod => 
                `<li>${mod.name}: ${mod.value > 0 ? '+' : ''}${mod.value}</li>`
            ).join('');
            modifierHtml = `<ul>${modifierHtml}</ul>`;
        }
        
        return `
            <div class="skill-test-result ${successClass}">
                <h3>${testResult.testName}</h3>
                <p><strong>Base Skill:</strong> ${testResult.baseSkill}</p>
                <p><strong>Modified Skill:</strong> ${testResult.modifiedSkill}</p>
                <p><strong>Roll:</strong> ${testResult.roll}</p>
                <p><strong>Result:</strong> ${testResult.resultDescription}</p>
                <p><strong>Degrees:</strong> ${testResult.degrees}</p>
                <p><strong>Modifiers:</strong></p>
                ${modifierHtml}
            </div>
        `;
    }

    /**
     * Generate a formatted chat message for a haggle test
     * @param {Object} haggleResult - Result from performHaggleTest
     * @returns {string} - Formatted HTML message
     */
    generateHaggleTestMessage(haggleResult) {
        const successClass = haggleResult.success ? 'success' : 'failure';
        const talentText = haggleResult.hasDealmakertTalent ? ' (with Dealmaker talent)' : '';
        
        const priceEffect = haggleResult.success ? 
            (haggleResult.hasDealmakertTalent ? '±20%' : '±10%') : 
            'No change';
        
        return `
            <div class="haggle-test-result ${successClass}">
                <h3>Haggle Test${talentText}</h3>
                <div class="haggle-party">
                    <h4>Player</h4>
                    <p><strong>Skill:</strong> ${haggleResult.player.skill}</p>
                    <p><strong>Roll:</strong> ${haggleResult.player.roll}</p>
                    <p><strong>Success:</strong> ${haggleResult.player.success ? 'Yes' : 'No'}</p>
                    <p><strong>Degrees:</strong> ${haggleResult.player.degrees}</p>
                </div>
                <div class="haggle-party">
                    <h4>Merchant</h4>
                    <p><strong>Skill:</strong> ${haggleResult.merchant.skill}</p>
                    <p><strong>Roll:</strong> ${haggleResult.merchant.roll}</p>
                    <p><strong>Success:</strong> ${haggleResult.merchant.success ? 'Yes' : 'No'}</p>
                    <p><strong>Degrees:</strong> ${haggleResult.merchant.degrees}</p>
                </div>
                <div class="haggle-outcome">
                    <p><strong>Result:</strong> ${haggleResult.resultDescription}</p>
                    <p><strong>Price Effect:</strong> ${priceEffect}</p>
                </div>
            </div>
        `;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.HagglingMechanics = HagglingMechanics;
    window.WFRPHaggling = HagglingMechanics; // Legacy name
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HagglingMechanics;
}

console.log('Trading Places | HagglingMechanics class loaded');
