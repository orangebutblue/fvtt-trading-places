/**
 * Trading Places Module - Configuration Validator
 * Comprehensive validation system for startup configuration and system compatibility
 */

/**
 * Configuration Validator class for validating module setup and system compatibility
 */
class ConfigValidator {
    constructor() {
        this.validationResults = {
            startup: null,
            system: null,
            dataset: null,
            runtime: null
        };
        this.isFoundryEnvironment = typeof game !== 'undefined';
        this.moduleId = "trading-places";
    }

    /**
     * Perform complete startup validation
     * @returns {Promise<Object>} - Comprehensive validation result
     */
    async performStartupValidation() {
        console.log('ConfigValidator | Starting comprehensive startup validation');
        
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            validationResults: {},
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Validate FoundryVTT environment
            const foundryValidation = this.validateFoundryEnvironment();
            result.validationResults.foundry = foundryValidation;
            if (!foundryValidation.valid) {
                result.valid = false;
                result.errors.push(...foundryValidation.errors);
            }
            result.warnings.push(...foundryValidation.warnings);

            // 2. Validate required configuration files
            const configValidation = await this.validateRequiredConfigFiles();
            result.validationResults.config = configValidation;
            if (!configValidation.valid) {
                result.valid = false;
                result.errors.push(...configValidation.errors);
            }
            result.warnings.push(...configValidation.warnings);

            // 3. Validate system compatibility
            const systemValidation = this.validateSystemCompatibility();
            result.validationResults.system = systemValidation;
            if (!systemValidation.valid) {
                result.valid = false;
                result.errors.push(...systemValidation.errors);
            }
            result.warnings.push(...systemValidation.warnings);

            // 4. Validate dataset structure
            const datasetValidation = await this.validateDatasetStructure();
            result.validationResults.dataset = datasetValidation;
            if (!datasetValidation.valid) {
                result.valid = false;
                result.errors.push(...datasetValidation.errors);
            }
            result.warnings.push(...datasetValidation.warnings);

            // 5. Validate module dependencies
            const dependencyValidation = this.validateModuleDependencies();
            result.validationResults.dependencies = dependencyValidation;
            if (!dependencyValidation.valid) {
                result.valid = false;
                result.errors.push(...dependencyValidation.errors);
            }
            result.warnings.push(...dependencyValidation.warnings);

            // Store validation results
            this.validationResults.startup = result;

            if (result.valid) {
                console.log('ConfigValidator | Startup validation completed successfully');
            } else {
                console.error('ConfigValidator | Startup validation failed:', result.errors);
            }

            return result;

        } catch (error) {
            result.valid = false;
            result.errors.push(`Startup validation failed: ${error.message}`);
            console.error('ConfigValidator | Startup validation error:', error);
            return result;
        }
    }

    /**
     * Validate FoundryVTT environment and version
     * @returns {Object} - Validation result
     */
    validateFoundryEnvironment() {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            environment: 'unknown',
            version: 'unknown'
        };

        // Check if we're in FoundryVTT environment
        if (!this.isFoundryEnvironment) {
            result.valid = false;
            result.errors.push('Module requires FoundryVTT environment');
            return result;
        }

        result.environment = 'foundry';

        // Check FoundryVTT version
        try {
            const foundryVersion = game.version || game.data?.version || 'unknown';
            result.version = foundryVersion;

            const minFoundryVersion = "10.0.0";
            if (foundryVersion !== 'unknown' && this.compareVersions(foundryVersion, minFoundryVersion) < 0) {
                result.valid = false;
                result.errors.push(`FoundryVTT version ${minFoundryVersion} or higher required. Current version: ${foundryVersion}`);
            }

            // Check for required FoundryVTT APIs
            const requiredAPIs = [
                { name: 'game.settings', object: game.settings },
                { name: 'game.system', object: game.system },
                { name: 'ui.notifications', object: ui?.notifications },
                { name: 'Dialog', object: window.Dialog },
                { name: 'ChatMessage', object: window.ChatMessage }
            ];

            for (const api of requiredAPIs) {
                if (!api.object) {
                    result.valid = false;
                    result.errors.push(`Required FoundryVTT API not available: ${api.name}`);
                }
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`Failed to validate FoundryVTT environment: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate required configuration files exist and are accessible
     * @returns {Promise<Object>} - Validation result
     */
    async validateRequiredConfigFiles() {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            files: {}
        };

        const requiredFiles = [
            {
                path: 'modules/trading-places/datasets/active/config.json',
                name: 'Active Dataset Config',
                required: true
            },
            {
                path: 'modules/trading-places/datasets/active/settlements.json',
                name: 'Active Dataset Settlements',
                required: true
            },
            {
                path: 'modules/trading-places/datasets/active/cargo-types.json',
                name: 'Active Dataset Cargo Types',
                required: true
            },
            {
                path: 'modules/trading-places/datasets/wfrp4e-default/config.json',
                name: 'Default Dataset Config',
                required: false
            },
            {
                path: 'modules/trading-places/lang/en.json',
                name: 'Language File',
                required: false
            }
        ];

        for (const file of requiredFiles) {
            try {
                const fileResult = await this.validateConfigFile(file.path, file.name);
                result.files[file.name] = fileResult;

                if (!fileResult.accessible && file.required) {
                    result.valid = false;
                    result.errors.push(`Required configuration file not accessible: ${file.name} (${file.path})`);
                } else if (!fileResult.accessible && !file.required) {
                    result.warnings.push(`Optional configuration file not accessible: ${file.name} (${file.path})`);
                }

                if (fileResult.parseError) {
                    if (file.required) {
                        result.valid = false;
                        result.errors.push(`Configuration file parse error: ${file.name} - ${fileResult.parseError}`);
                    } else {
                        result.warnings.push(`Configuration file parse error: ${file.name} - ${fileResult.parseError}`);
                    }
                }

            } catch (error) {
                if (file.required) {
                    result.valid = false;
                    result.errors.push(`Failed to validate required file ${file.name}: ${error.message}`);
                } else {
                    result.warnings.push(`Failed to validate optional file ${file.name}: ${error.message}`);
                }
            }
        }

        return result;
    }

    /**
     * Validate a single configuration file
     * @param {string} filePath - Path to the configuration file
     * @param {string} fileName - Human-readable file name
     * @returns {Promise<Object>} - File validation result
     */
    async validateConfigFile(filePath, fileName) {
        const result = {
            accessible: false,
            validJSON: false,
            parseError: null,
            content: null,
            size: 0
        };

        try {
            if (typeof fetch !== 'undefined') {
                const response = await fetch(filePath);
                
                if (response.ok) {
                    result.accessible = true;
                    result.size = parseInt(response.headers.get('content-length') || '0');
                    
                    const text = await response.text();
                    
                    try {
                        result.content = JSON.parse(text);
                        result.validJSON = true;
                    } catch (parseError) {
                        result.parseError = parseError.message;
                    }
                } else {
                    result.parseError = `HTTP ${response.status}: ${response.statusText}`;
                }
            } else {
                result.parseError = 'Fetch API not available';
            }
        } catch (error) {
            result.parseError = error.message;
        }

        return result;
    }

    /**
     * Validate system compatibility with clear error messages
     * @returns {Object} - Validation result
     */
    validateSystemCompatibility() {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            systemInfo: {},
            compatibility: {}
        };

        try {
            // Get system information
            result.systemInfo = {
                id: game.system?.id || 'unknown',
                title: game.system?.title || 'Unknown System',
                version: game.system?.version || 'unknown',
                foundryVersion: game.version || game.data?.version || 'unknown'
            };

            // Check system compatibility
            const systemId = result.systemInfo.id;
            const supportedSystems = {
                'wfrp4e': {
                    name: 'Warhammer Fantasy Roleplay 4e',
                    fullSupport: true,
                    currencyField: 'system.money.gc',
                    inventoryField: 'items'
                },
                'dnd5e': {
                    name: 'D&D 5th Edition',
                    fullSupport: false,
                    currencyField: 'system.currency.gp',
                    inventoryField: 'items',
                    notes: 'Partial support - may require configuration adjustments'
                },
                'pf2e': {
                    name: 'Pathfinder 2nd Edition',
                    fullSupport: false,
                    currencyField: 'system.money.gp',
                    inventoryField: 'items',
                    notes: 'Partial support - may require configuration adjustments'
                }
            };

            if (supportedSystems[systemId]) {
                const systemSupport = supportedSystems[systemId];
                result.compatibility = systemSupport;

                if (!systemSupport.fullSupport) {
                    result.warnings.push(`System '${systemSupport.name}' has partial support. ${systemSupport.notes || 'Configuration may need adjustment.'}`);
                }
            } else {
                result.warnings.push(`System '${systemId}' is not officially supported. Manual configuration will be required.`);
                result.compatibility = {
                    name: result.systemInfo.title,
                    fullSupport: false,
                    notes: 'Unsupported system - manual configuration required'
                };
            }

            // Validate system-specific requirements
            if (systemId === 'wfrp4e') {
                // WFRP4e specific validation
                const wfrpValidation = this.validateWFRP4eCompatibility();
                if (!wfrpValidation.valid) {
                    result.errors.push(...wfrpValidation.errors);
                    result.valid = false;
                }
                result.warnings.push(...wfrpValidation.warnings);
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`System compatibility validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate WFRP4e specific compatibility
     * @returns {Object} - WFRP4e validation result
     */
    validateWFRP4eCompatibility() {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            // Check WFRP4e version if available
            const wfrpVersion = game.system?.version;
            if (wfrpVersion) {
                const minWfrpVersion = "7.0.0";
                if (this.compareVersions(wfrpVersion, minWfrpVersion) < 0) {
                    result.warnings.push(`WFRP4e version ${minWfrpVersion} or higher recommended. Current version: ${wfrpVersion}`);
                }
            }

            // Check for WFRP4e specific APIs
            const wfrpAPIs = [
                { name: 'game.wfrp4e', object: game.wfrp4e },
                { name: 'game.wfrp4e.config', object: game.wfrp4e?.config }
            ];

            for (const api of wfrpAPIs) {
                if (!api.object) {
                    result.warnings.push(`WFRP4e API not available: ${api.name}. Some features may not work optimally.`);
                }
            }

        } catch (error) {
            result.warnings.push(`WFRP4e compatibility check failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate dataset structure with detailed diagnostic reporting
     * @returns {Promise<Object>} - Dataset validation result
     */
    async validateDatasetStructure() {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            datasets: {}
        };

        try {
            // Get active dataset name
            const activeDataset = this.isFoundryEnvironment ? 
                game.settings.get(this.moduleId, "activeDataset") : 
                "wfrp4e-default";

            // Validate active dataset
            const activeValidation = await this.validateSingleDataset(activeDataset);
            result.datasets[activeDataset] = activeValidation;

            if (!activeValidation.valid) {
                result.valid = false;
                result.errors.push(`Active dataset '${activeDataset}' validation failed:`);
                result.errors.push(...activeValidation.errors.map(err => `  - ${err}`));
            }
            result.warnings.push(...activeValidation.warnings);

            // Validate default dataset if different from active
            if (activeDataset !== "wfrp4e-default") {
                const defaultValidation = await this.validateSingleDataset("wfrp4e-default");
                result.datasets["wfrp4e-default"] = defaultValidation;

                if (!defaultValidation.valid) {
                    result.warnings.push(`Default dataset 'wfrp4e-default' validation failed:`);
                    result.warnings.push(...defaultValidation.errors.map(err => `  - ${err}`));
                }
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`Dataset structure validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate a single dataset
     * @param {string} datasetName - Name of the dataset to validate
     * @returns {Promise<Object>} - Dataset validation result
     */
    async validateSingleDataset(datasetName) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            files: {},
            statistics: {}
        };

        try {
            const basePath = `modules/trading-places/datasets/${datasetName}`;
            
            // Load dataset files
            const files = {
                config: await this.validateConfigFile(`${basePath}/config.json`, 'config'),
                settlements: await this.validateConfigFile(`${basePath}/settlements.json`, 'settlements'),
                cargoTypes: await this.validateConfigFile(`${basePath}/cargo-types.json`, 'cargo-types')
            };

            result.files = files;

            // Check file accessibility
            for (const [fileName, fileResult] of Object.entries(files)) {
                if (!fileResult.accessible) {
                    result.valid = false;
                    result.errors.push(`Dataset file not accessible: ${fileName}.json`);
                } else if (!fileResult.validJSON) {
                    result.valid = false;
                    result.errors.push(`Dataset file invalid JSON: ${fileName}.json - ${fileResult.parseError}`);
                }
            }

            // If files are accessible, validate content structure
            if (files.config.validJSON && files.settlements.validJSON && files.cargoTypes.validJSON) {
                const contentValidation = this.validateDatasetContent(
                    files.config.content,
                    files.settlements.content,
                    files.cargoTypes.content
                );

                if (!contentValidation.valid) {
                    result.valid = false;
                    result.errors.push(...contentValidation.errors);
                }
                result.warnings.push(...contentValidation.warnings);
                result.statistics = contentValidation.statistics;
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`Dataset validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate dataset content structure
     * @param {Object} config - Config data
     * @param {Object} settlements - Settlements data
     * @param {Object} cargoTypes - Cargo types data
     * @returns {Object} - Content validation result
     */
    validateDatasetContent(config, settlements, cargoTypes) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            statistics: {
                settlements: 0,
                cargoTypes: 0,
                regions: 0,
                categories: 0
            }
        };

        try {
            // Validate config structure
            const configValidation = this.validateConfigStructure(config);
            if (!configValidation.valid) {
                result.valid = false;
                result.errors.push('Config validation failed:');
                result.errors.push(...configValidation.errors.map(err => `  - ${err}`));
            }

            // Validate settlements structure
            const settlementsValidation = this.validateSettlementsStructure(settlements);
            if (!settlementsValidation.valid) {
                result.valid = false;
                result.errors.push('Settlements validation failed:');
                result.errors.push(...settlementsValidation.errors.map(err => `  - ${err}`));
            }
            result.statistics.settlements = settlementsValidation.count;
            result.statistics.regions = settlementsValidation.regions;

            // Validate cargo types structure
            const cargoValidation = this.validateCargoTypesStructure(cargoTypes);
            if (!cargoValidation.valid) {
                result.valid = false;
                result.errors.push('Cargo types validation failed:');
                result.errors.push(...cargoValidation.errors.map(err => `  - ${err}`));
            }
            result.statistics.cargoTypes = cargoValidation.count;
            result.statistics.categories = cargoValidation.categories;

        } catch (error) {
            result.valid = false;
            result.errors.push(`Content validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate config structure
     * @param {Object} config - Config object
     * @returns {Object} - Validation result
     */
    validateConfigStructure(config) {
        const result = {
            valid: true,
            errors: []
        };

        if (!config || typeof config !== 'object') {
            result.valid = false;
            result.errors.push('Config must be an object');
            return result;
        }

        // Required sections
        const requiredSections = ['currency', 'inventory'];
        for (const section of requiredSections) {
            if (!config[section]) {
                result.valid = false;
                result.errors.push(`Missing required config section: ${section}`);
            }
        }

        // Validate currency config
        if (config.currency) {
            if (!config.currency.field || typeof config.currency.field !== 'string') {
                result.valid = false;
                result.errors.push('Config currency.field must be a non-empty string');
            }
        }

        // Validate inventory config
        if (config.inventory) {
            if (!config.inventory.field || typeof config.inventory.field !== 'string') {
                result.valid = false;
                result.errors.push('Config inventory.field must be a non-empty string');
            }
        }

        return result;
    }

    /**
     * Validate settlements structure
     * @param {Object} settlements - Settlements data
     * @returns {Object} - Validation result
     */
    validateSettlementsStructure(settlements) {
        const result = {
            valid: true,
            errors: [],
            count: 0,
            regions: 0
        };

        if (!settlements || !Array.isArray(settlements.settlements)) {
            result.valid = false;
            result.errors.push('Settlements data must contain a settlements array');
            return result;
        }

        const regionSet = new Set();
        const requiredFields = ['region', 'name', 'size', 'ruler', 'population', 'wealth', 'source', 'garrison', 'notes'];

        settlements.settlements.forEach((settlement, index) => {
            // Check required fields
            const missingFields = requiredFields.filter(field => 
                !settlement.hasOwnProperty(field) || settlement[field] === null || settlement[field] === undefined
            );

            if (missingFields.length > 0) {
                result.valid = false;
                result.errors.push(`Settlement ${index} (${settlement.name || 'unnamed'}): Missing fields: ${missingFields.join(', ')}`);
            }

            // Track regions
            if (settlement.region) {
                regionSet.add(settlement.region);
            }

            // Validate field types
            if (settlement.population !== undefined && (typeof settlement.population !== 'number' || settlement.population < 0)) {
                result.valid = false;
                result.errors.push(`Settlement ${index} (${settlement.name || 'unnamed'}): Population must be a positive number`);
            }

            if (settlement.wealth !== undefined && (typeof settlement.wealth !== 'number' || settlement.wealth < 1 || settlement.wealth > 5)) {
                result.valid = false;
                result.errors.push(`Settlement ${index} (${settlement.name || 'unnamed'}): Wealth must be a number between 1-5`);
            }

            if (settlement.source !== undefined && !Array.isArray(settlement.source)) {
                result.valid = false;
                result.errors.push(`Settlement ${index} (${settlement.name || 'unnamed'}): Source must be an array`);
            }
        });

        result.count = settlements.settlements.length;
        result.regions = regionSet.size;

        return result;
    }

    /**
     * Validate cargo types structure
     * @param {Object} cargoTypes - Cargo types data
     * @returns {Object} - Validation result
     */
    validateCargoTypesStructure(cargoTypes) {
        const result = {
            valid: true,
            errors: [],
            count: 0,
            categories: 0
        };

        if (!cargoTypes || !Array.isArray(cargoTypes.cargoTypes)) {
            result.valid = false;
            result.errors.push('Cargo types data must contain a cargoTypes array');
            return result;
        }

        const categorySet = new Set();
        const requiredFields = ['name', 'category', 'basePrices', 'encumbrancePerUnit'];
        const requiredSeasons = ['spring', 'summer', 'autumn', 'winter'];

        cargoTypes.cargoTypes.forEach((cargo, index) => {
            // Check required fields
            const missingFields = requiredFields.filter(field => 
                !cargo.hasOwnProperty(field) || cargo[field] === null || cargo[field] === undefined
            );

            if (missingFields.length > 0) {
                result.valid = false;
                result.errors.push(`Cargo ${index} (${cargo.name || 'unnamed'}): Missing fields: ${missingFields.join(', ')}`);
            }

            // Track categories
            if (cargo.category) {
                categorySet.add(cargo.category);
            }

            // Validate base prices
            if (cargo.basePrices && typeof cargo.basePrices === 'object') {
                const missingSeasons = requiredSeasons.filter(season => 
                    !cargo.basePrices.hasOwnProperty(season) || typeof cargo.basePrices[season] !== 'number'
                );

                if (missingSeasons.length > 0) {
                    result.valid = false;
                    result.errors.push(`Cargo ${index} (${cargo.name || 'unnamed'}): Missing or invalid seasonal prices: ${missingSeasons.join(', ')}`);
                }
            }

            // Validate encumbrance
            if (cargo.encumbrancePerUnit !== undefined && (typeof cargo.encumbrancePerUnit !== 'number' || cargo.encumbrancePerUnit <= 0)) {
                result.valid = false;
                result.errors.push(`Cargo ${index} (${cargo.name || 'unnamed'}): EncumbrancePerUnit must be a positive number`);
            }
        });

        result.count = cargoTypes.cargoTypes.length;
        result.categories = categorySet.size;

        return result;
    }

    /**
     * Validate module dependencies
     * @returns {Object} - Validation result
     */
    validateModuleDependencies() {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            dependencies: {}
        };

        try {
            // Check for required classes
            const requiredClasses = [
                { name: 'DataManager', class: window.DataManager },
                { name: 'SystemAdapter', class: window.SystemAdapter },
                { name: 'TradingEngine', class: window.TradingEngine }
            ];

            // Optional UI classes (not critical for core functionality)
            const optionalClasses = [
                { name: 'WFRPTradingApplication', class: window.WFRPTradingApplication },
                { name: 'WFRPFallbackDialog', class: window.WFRPFallbackDialog }
            ];

            for (const dep of requiredClasses) {
                result.dependencies[dep.name] = {
                    available: !!dep.class,
                    type: typeof dep.class,
                    required: true
                };

                if (!dep.class) {
                    result.valid = false;
                    result.errors.push(`Required class not available: ${dep.name}`);
                }
            }

            // Check optional classes (warnings only)
            for (const dep of optionalClasses) {
                result.dependencies[dep.name] = {
                    available: !!dep.class,
                    type: typeof dep.class,
                    required: false
                };

                if (!dep.class) {
                    result.warnings.push(`Optional UI class not available: ${dep.name}`);
                }
            }

            // Check for optional dependencies
            const optionalDependencies = [
                { name: 'game.wfrp4e', object: game.wfrp4e, description: 'WFRP4e system integration' }
            ];

            for (const dep of optionalDependencies) {
                if (!dep.object) {
                    result.warnings.push(`Optional dependency not available: ${dep.name} (${dep.description})`);
                }
            }

        } catch (error) {
            result.valid = false;
            result.errors.push(`Dependency validation failed: ${error.message}`);
        }

        return result;
    }

    /**
     * Generate detailed diagnostic report
     * @param {Object} validationResult - Complete validation result
     * @returns {string} - Formatted diagnostic report
     */
    generateDiagnosticReport(validationResult) {
        let report = 'Trading Places - Configuration Validation Report\n';
        report += '=' .repeat(60) + '\n\n';
        
        report += `Validation Date: ${validationResult.timestamp}\n`;
        report += `Overall Status: ${validationResult.valid ? 'PASSED' : 'FAILED'}\n\n`;

        // Summary
        report += 'SUMMARY:\n';
        report += '-' .repeat(20) + '\n';
        report += `Errors: ${validationResult.errors.length}\n`;
        report += `Warnings: ${validationResult.warnings.length}\n\n`;

        // Errors
        if (validationResult.errors.length > 0) {
            report += 'ERRORS (Must be fixed):\n';
            report += '-' .repeat(30) + '\n';
            validationResult.errors.forEach((error, index) => {
                report += `${index + 1}. ${error}\n`;
            });
            report += '\n';
        }

        // Warnings
        if (validationResult.warnings.length > 0) {
            report += 'WARNINGS (Recommended to address):\n';
            report += '-' .repeat(40) + '\n';
            validationResult.warnings.forEach((warning, index) => {
                report += `${index + 1}. ${warning}\n`;
            });
            report += '\n';
        }

        // Detailed results
        report += 'DETAILED VALIDATION RESULTS:\n';
        report += '-' .repeat(35) + '\n';

        for (const [category, categoryResult] of Object.entries(validationResult.validationResults)) {
            report += `\n${category.toUpperCase()}:\n`;
            report += `  Status: ${categoryResult.valid ? 'PASSED' : 'FAILED'}\n`;
            
            if (categoryResult.errors && categoryResult.errors.length > 0) {
                report += `  Errors: ${categoryResult.errors.length}\n`;
            }
            
            if (categoryResult.warnings && categoryResult.warnings.length > 0) {
                report += `  Warnings: ${categoryResult.warnings.length}\n`;
            }

            // Add category-specific details
            if (category === 'system' && categoryResult.systemInfo) {
                report += `  System: ${categoryResult.systemInfo.title} (${categoryResult.systemInfo.id})\n`;
                report += `  Version: ${categoryResult.systemInfo.version}\n`;
            }

            if (category === 'dataset' && categoryResult.datasets) {
                for (const [datasetName, datasetResult] of Object.entries(categoryResult.datasets)) {
                    report += `  Dataset '${datasetName}': ${datasetResult.valid ? 'VALID' : 'INVALID'}\n`;
                    if (datasetResult.statistics) {
                        report += `    Settlements: ${datasetResult.statistics.settlements}\n`;
                        report += `    Cargo Types: ${datasetResult.statistics.cargoTypes}\n`;
                    }
                }
            }
        }

        report += '\n' + '=' .repeat(60) + '\n';
        
        if (!validationResult.valid) {
            report += 'RESOLUTION STEPS:\n';
            report += '1. Address all errors listed above\n';
            report += '2. Check file paths and permissions\n';
            report += '3. Validate JSON syntax in configuration files\n';
            report += '4. Ensure all required dependencies are loaded\n';
            report += '5. Restart FoundryVTT after making changes\n';
        } else {
            report += 'Configuration validation completed successfully!\n';
            if (validationResult.warnings.length > 0) {
                report += 'Consider addressing warnings for optimal performance.\n';
            }
        }

        return report;
    }

    /**
     * Write error recovery procedures for common issues
     * @param {Array} errors - Array of error messages
     * @returns {Object} - Recovery procedures
     */
    generateErrorRecoveryProcedures(errors) {
        const procedures = {
            general: [],
            specific: {},
            priority: 'high'
        };

        // General recovery steps
        procedures.general = [
            'Restart FoundryVTT to reload all modules',
            'Check browser console for additional error details',
            'Verify all module files are present and not corrupted',
            'Ensure proper file permissions for module directory',
            'Clear browser cache and reload'
        ];

        // Specific error recovery procedures
        const errorPatterns = {
            'configuration file not accessible': {
                steps: [
                    'Check if the file exists in the correct location',
                    'Verify file permissions allow reading',
                    'Ensure the file path is correct',
                    'Try re-downloading the module'
                ],
                priority: 'critical'
            },
            'invalid JSON': {
                steps: [
                    'Validate JSON syntax using an online JSON validator',
                    'Check for missing commas, brackets, or quotes',
                    'Ensure no trailing commas in JSON objects',
                    'Restore from backup if available'
                ],
                priority: 'high'
            },
            'FoundryVTT version': {
                steps: [
                    'Update FoundryVTT to the minimum required version',
                    'Check module compatibility with your FoundryVTT version',
                    'Consider using an older version of the module if needed'
                ],
                priority: 'critical'
            },
            'system compatibility': {
                steps: [
                    'Check if your game system is supported',
                    'Review system-specific configuration requirements',
                    'Consider creating custom configuration for your system',
                    'Contact module developer for system support'
                ],
                priority: 'medium'
            },
            'missing required fields': {
                steps: [
                    'Review dataset structure requirements',
                    'Add missing fields to settlement or cargo data',
                    'Use the default dataset as a reference',
                    'Validate dataset structure after making changes'
                ],
                priority: 'high'
            }
        };

        // Match errors to specific procedures
        errors.forEach(error => {
            const errorLower = error.toLowerCase();
            
            for (const [pattern, procedure] of Object.entries(errorPatterns)) {
                if (errorLower.includes(pattern)) {
                    procedures.specific[error] = procedure;
                    
                    // Update overall priority
                    if (procedure.priority === 'critical') {
                        procedures.priority = 'critical';
                    } else if (procedure.priority === 'high' && procedures.priority !== 'critical') {
                        procedures.priority = 'high';
                    }
                }
            }
        });

        return procedures;
    }

    /**
     * Compare version strings
     * @param {string} version1 - First version
     * @param {string} version2 - Second version
     * @returns {number} - -1 if version1 < version2, 0 if equal, 1 if version1 > version2
     */
    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        const maxLength = Math.max(v1parts.length, v2parts.length);

        for (let i = 0; i < maxLength; i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;

            if (v1part < v2part) return -1;
            if (v1part > v2part) return 1;
        }

        return 0;
    }

    /**
     * Get last validation results
     * @returns {Object} - Last validation results
     */
    getLastValidationResults() {
        return this.validationResults;
    }

    /**
     * Clear validation results
     */
    clearValidationResults() {
        this.validationResults = {
            startup: null,
            system: null,
            dataset: null,
            runtime: null
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidator;
}

// Global registration for FoundryVTT
if (typeof window !== 'undefined') {
    window.ConfigValidator = ConfigValidator;
}