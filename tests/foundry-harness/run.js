#!/usr/bin/env node

/**
 * Foundry Harness Scenario Runner
 * CLI entry point for running scenarios against the trading module
 */

import { getHarness, resetHarness } from './environment.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ScenarioRunner {
    constructor() {
        this.harness = null;
        this.scenarios = [];
        this.results = [];
    }

    async parseArguments() {
        const args = process.argv.slice(2);
        const options = {
            uiMode: false,
            seed: null,
            scenarios: [],
            help: false
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '--ui':
                case '-u':
                    options.uiMode = true;
                    break;
                    
                case '--seed':
                case '-s':
                    i++;
                    if (i < args.length) {
                        options.seed = parseInt(args[i]);
                    }
                    break;
                    
                case '--scenario':
                case '-c':
                    i++;
                    if (i < args.length) {
                        options.scenarios.push(args[i]);
                    }
                    break;
                    
                case '--help':
                case '-h':
                    options.help = true;
                    break;
                    
                default:
                    // Treat unknown args as scenario files
                    if (!arg.startsWith('-')) {
                        options.scenarios.push(arg);
                    }
                    break;
            }
        }

        // Override with environment variables
        if (process.env.HARNESS_UI === '1') {
            options.uiMode = true;
        }
        
        if (process.env.HARNESS_SEED) {
            options.seed = parseInt(process.env.HARNESS_SEED);
        }

        return options;
    }

    showHelp() {
        console.log(`
Foundry Harness Scenario Runner

Usage: node run.js [options] [scenario-files...]

Options:
  --ui, -u              Enable rendered mode (serve templates in browser)
  --seed, -s <number>   Set random seed for deterministic results
  --scenario, -c <file> Specify scenario file to run
  --help, -h            Show this help message

Environment Variables:
  HARNESS_UI=1          Enable rendered mode
  HARNESS_SEED=<number> Set random seed
  HARNESS_NO_OPEN=1     Don't auto-open browser in UI mode

Examples:
  node run.js scenarios/buying-flow.js
  node run.js --ui scenarios/availability-only.js
  node run.js --seed 42 scenarios/*.js
  HARNESS_UI=1 node run.js scenarios/buying-flow.js
        `);
    }

    async loadScenario(scenarioPath) {
        try {
            // Resolve path relative to current working directory or harness directory
            let fullPath;
            if (path.isAbsolute(scenarioPath)) {
                fullPath = scenarioPath;
            } else if (scenarioPath.startsWith('./') || scenarioPath.startsWith('../')) {
                fullPath = path.resolve(process.cwd(), scenarioPath);
            } else {
                // Try relative to harness scenarios directory first
                const harnessScenarioPath = path.resolve(__dirname, 'scenarios', scenarioPath);
                const cwdScenarioPath = path.resolve(process.cwd(), scenarioPath);
                
                try {
                    await import(`file://${harnessScenarioPath}`);
                    fullPath = harnessScenarioPath;
                } catch {
                    fullPath = cwdScenarioPath;
                }
            }

            console.log(`Foundry Harness | Loading scenario: ${fullPath}`);
            const scenarioModule = await import(`file://${fullPath}`);
            
            if (!scenarioModule.default && !scenarioModule.runScenario) {
                throw new Error('Scenario must export default function or runScenario function');
            }

            return {
                path: fullPath,
                name: path.basename(scenarioPath, '.js'),
                runner: scenarioModule.default || scenarioModule.runScenario,
                module: scenarioModule
            };
        } catch (error) {
            console.error(`Foundry Harness | Failed to load scenario ${scenarioPath}:`, error.message);
            throw error;
        }
    }

    async runScenario(scenario) {
        console.log(`\n=== Running Scenario: ${scenario.name} ===`);
        
        const startTime = Date.now();
        let error = null;
        let result = null;

        try {
            // Pass harness instance to scenario
            result = await scenario.runner(this.harness);
            console.log(`Foundry Harness | Scenario '${scenario.name}' completed successfully`);
        } catch (err) {
            error = err;
            console.error(`Foundry Harness | Scenario '${scenario.name}' failed:`, err.message);
        }

        const duration = Date.now() - startTime;
        
        const scenarioResult = {
            name: scenario.name,
            path: scenario.path,
            success: !error,
            error: error ? error.message : null,
            duration,
            result
        };

        this.results.push(scenarioResult);
        return scenarioResult;
    }

    async run() {
        try {
            const options = await this.parseArguments();

            if (options.help) {
                this.showHelp();
                return;
            }

            // Use default scenarios if none specified
            if (options.scenarios.length === 0) {
                options.scenarios = ['tests/foundry-harness/scenarios/buying-flow.js', 'tests/foundry-harness/scenarios/availability-only.js'];
                console.log('Foundry Harness | No scenarios specified, using defaults');
            }

            console.log('Foundry Harness | Starting scenario runner...');
            console.log(`Foundry Harness | UI Mode: ${options.uiMode}`);
            console.log(`Foundry Harness | Seed: ${options.seed || 'default'}`);
            console.log(`Foundry Harness | Scenarios: ${options.scenarios.join(', ')}`);

            // Initialize harness
            this.harness = getHarness({
                uiMode: options.uiMode,
                seed: options.seed
            });

            await this.harness.ready();

            // Load scenarios
            for (const scenarioPath of options.scenarios) {
                try {
                    const scenario = await this.loadScenario(scenarioPath);
                    this.scenarios.push(scenario);
                } catch (error) {
                    console.error(`Foundry Harness | Failed to load scenario ${scenarioPath}: ${error.message}`);
                    this.results.push({
                        name: path.basename(scenarioPath, '.js'),
                        path: scenarioPath,
                        success: false,
                        error: `Load failed: ${error.message}`,
                        duration: 0,
                        result: null
                    });
                }
            }

            // Check if any scenarios loaded successfully
            if (this.scenarios.length === 0) {
                console.error('Foundry Harness | No scenarios loaded successfully');
                this.printSummary();
                throw new Error('No valid scenarios found to run');
            }

            // Check if some scenarios failed to load
            const loadFailures = this.results.filter(r => !r.success).length;
            if (loadFailures > 0) {
                console.warn(`Foundry Harness | ${loadFailures} scenario(s) failed to load`);
            }

            // Run scenarios
            for (const scenario of this.scenarios) {
                await this.runScenario(scenario);
            }

            // Print results summary
            this.printSummary();

            // Determine exit code
            const failedCount = this.results.filter(r => !r.success).length;
            if (failedCount > 0) {
                console.error(`\nFoundry Harness | ${failedCount} scenario(s) failed`);
                process.exit(1);
            } else {
                console.log(`\nFoundry Harness | All ${this.results.length} scenario(s) passed`);
                process.exit(0);
            }

        } catch (error) {
            console.error('Foundry Harness | Runner failed:', error.message);
            process.exit(1);
        } finally {
            // Clean up
            if (this.harness) {
                await resetHarness();
            }
        }
    }

    printSummary() {
        console.log('\n=== Scenario Results Summary ===');
        
        let totalDuration = 0;
        
        for (const result of this.results) {
            const status = result.success ? '✓ PASS' : '✗ FAIL';
            const duration = `${result.duration}ms`;
            
            console.log(`${status} ${result.name.padEnd(30)} ${duration}`);
            if (result.error) {
                console.log(`     Error: ${result.error}`);
            }
            
            totalDuration += result.duration;
        }
        
        console.log(`\nTotal scenarios: ${this.results.length}`);
        console.log(`Passed: ${this.results.filter(r => r.success).length}`);
        console.log(`Failed: ${this.results.filter(r => !r.success).length}`);
        console.log(`Total time: ${totalDuration}ms`);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new ScenarioRunner();
    runner.run().catch(error => {
        console.error('Foundry Harness | Unhandled error:', error);
        process.exit(1);
    });
}

export { ScenarioRunner };