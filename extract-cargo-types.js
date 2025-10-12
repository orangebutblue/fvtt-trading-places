#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, 'source-files');
const empireDir = path.join(sourceDir, 'Empire');
const nonEmpireDir = path.join(sourceDir, 'Non-Empire');

function extractTextFromPDF(pdfPath) {
    try {
        const output = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf8' });
        return output;
    } catch (error) {
        console.error(`Error extracting text from ${pdfPath}:`, error.message);
        return '';
    }
}

function extractCargoTypes(text) {
    const lines = text.split('\n');
    const cargoTypes = new Set();

    // Strict list of known cargo types (only legitimate ones)
    const knownCargoTypes = [
        'agriculture', 'trade', 'timber', 'fish', 'ore', 'metalworking', 'wine', 'cattle', 'sheep',
        'mining', 'coal', 'iron', 'copper', 'fishing', 'cheese', 'brandy', 'subsistence', 'transport',
        'government', 'goats', 'metal', 'weapons', 'armour', 'leather', 'cloth', 'textiles', 'grain',
        'wheat', 'barley', 'oats', 'flour', 'bread', 'meat', 'poultry', 'eggs', 'milk', 'butter',
        'honey', 'fruit', 'vegetables', 'herbs', 'spices', 'salt', 'sugar', 'beer', 'ale', 'spirits',
        'tobacco', 'pipes', 'books', 'paper', 'ink', 'pottery', 'glass', 'jewelry', 'gems', 'precious',
        'gold', 'silver', 'tin', 'lead', 'steel', 'tools', 'furniture', 'wood', 'lumber', 'stone',
        'marble', 'clay', 'bricks', 'tiles', 'fur', 'furs', 'livestock', 'pigs', 'hogs', 'horses',
        'quarry', 'quartz', 'slate', 'tourmaline', 'malachite', 'amber', 'rope', 'porcelain',
        'tableware', 'woodcarving', 'woodcarvings', 'woodcraft', 'stonework', 'stonecutting',
        'boatbuilding', 'boat-building', 'forestry', 'trapping', 'smelting', 'brick-making',
        'tile', 'wool', 'silk', 'linen', 'cotton', 'leatherwork', 'tannery', 'dyeing',
        'weaving', 'spinning', 'brewing', 'distilling', 'baking', 'milling', 'smithing', 'blacksmith',
        'weaponsmith', 'armourer', 'jeweler', 'goldsmith', 'silversmith', 'potter', 'glassblower',
        'carpenter', 'mason', 'miner', 'farmer', 'fisher', 'hunter', 'trader', 'merchant', 'craftsman',
        'artisan', 'antiques', 'clothing', 'services', 'piracy', 'slavery', 'smuggling', 'salvaging'
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip if line is too long - Source column entries are concise
        if (line.length > 40) continue;

        // Skip lines with numbers
        if (/\d/.test(line)) continue;

        // Skip lines with parentheses
        if (line.includes('(') || line.includes(')')) continue;

        // Skip lines that look like sentences (contain multiple spaces or sentence fragments)
        if (line.includes('  ') || line.match(/\b(the|and|or|in|on|at|by|for|with|from|to)\b/i)) continue;

        // Only process lines that are either:
        // 1. Single words that match known cargo types
        // 2. Short comma-separated lists (max 3 items, each < 15 chars)

        if (line.includes(',')) {
            // Handle comma-separated lists
            const parts = line.split(',').map(p => p.trim().toLowerCase());

            // Must have 2-3 parts, each part must be short and match known types
            if (parts.length >= 2 && parts.length <= 3) {
                const allValid = parts.every(part =>
                    part.length <= 15 &&
                    knownCargoTypes.some(cargo => part === cargo || cargo === part)
                );

                if (allValid) {
                    parts.forEach(part => cargoTypes.add(part));
                }
            }
        } else {
            // Handle single words
            const lowerLine = line.toLowerCase();

            // Must be a known cargo type and not contain spaces
            if (!line.includes(' ') && knownCargoTypes.includes(lowerLine)) {
                cargoTypes.add(lowerLine);
            }
        }
    }

    return cargoTypes;
}

function processDirectory(dirPath, regionName) {
    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.pdf'));
    const allCargoTypes = new Set();

    console.log(`Processing ${regionName} (${files.length} files)...`);

    files.forEach(file => {
        const pdfPath = path.join(dirPath, file);
        console.log(`  Processing ${file}...`);

        const text = extractTextFromPDF(pdfPath);
        const cargoTypes = extractCargoTypes(text);

        cargoTypes.forEach(type => allCargoTypes.add(type));
    });

    return allCargoTypes;
}

function main() {
    const empireTypes = processDirectory(empireDir, 'Empire');
    const nonEmpireTypes = processDirectory(nonEmpireDir, 'Non-Empire');

    const allTypes = new Set([...empireTypes, ...nonEmpireTypes]);

    // Sort alphabetically
    const sortedTypes = Array.from(allTypes).sort();

    // Create markdown document
    const docContent = `# Cargo Types from Source Files

This document contains all unique cargo types extracted from the "Source" column of settlement data in the Warhammer Fantasy Roleplay source PDFs.

## Summary
- **Total unique cargo types**: ${sortedTypes.length}
- **Empire regions**: ${empireTypes.size} types
- **Non-Empire regions**: ${nonEmpireTypes.size} types

## All Cargo Types

${sortedTypes.map(type => `- ${type}`).join('\n')}

## Empire Region Types (${empireTypes.size})

${Array.from(empireTypes).sort().map(type => `- ${type}`).join('\n')}

## Non-Empire Region Types (${nonEmpireTypes.size})

${Array.from(nonEmpireTypes).sort().map(type => `- ${type}`).join('\n')}

---
*Generated on ${new Date().toISOString().split('T')[0]} from PDF source files*
`;

    const outputPath = path.join(__dirname, 'CARGO_TYPES.md');
    fs.writeFileSync(outputPath, docContent, 'utf8');

    console.log(`\nCargo types document generated: ${outputPath}`);
    console.log(`Total unique cargo types found: ${sortedTypes.length}`);
}

main();