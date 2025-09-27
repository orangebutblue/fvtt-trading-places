# Requirements Document

## Introduction

This document outlines the requirements for a FoundryVTT module that implements the complete WFRP 4E Trading Places algorithm with full rule compliance. The module will provide a system-agnostic trading simulation with proper market dynamics, uncertainty, and economic restrictions as specified in the Death on the Reik Companion pages 71-78.

## Requirements

### Requirement 1

**User Story:** As a Game Master, I want to check cargo availability at settlements using the official WFRP algorithm, so that trading encounters follow the published rules exactly.

#### Acceptance Criteria

1. WHEN checking cargo availability THEN the system SHALL calculate base chance as (Size + Wealth) × 10%
2. WHEN rolling availability THEN the system SHALL use 1d100 against the calculated percentage
3. IF availability check succeeds THEN the system SHALL determine cargo type from settlement's production list
4. WHEN settlement produces "Trade" THEN the system SHALL roll on seasonal random cargo table
5. IF settlement has both specific goods AND "Trade" THEN the system SHALL make both types available
6. WHEN calculating cargo size THEN the system SHALL use (Size + Wealth) × (1d100 rounded up to nearest 10) EP
7. IF settlement wealth comes from "Trade" THEN the system SHALL roll 1d100 twice and use higher multiplier

### Requirement 2

**User Story:** As a player, I want to purchase cargo with accurate pricing including haggling mechanics, so that the economic simulation is realistic and follows official rules.

#### Acceptance Criteria

1. WHEN determining base price THEN the system SHALL use the official Base Price Table with seasonal variations
2. IF purchasing partial cargo THEN the system SHALL apply +10% price penalty
3. WHEN player attempts haggling THEN the system SHALL conduct comparative Haggle test vs merchant skill
4. IF haggle test succeeds THEN the system SHALL reduce price by 10% (or 20% with Dealmaker talent)
5. IF haggle test fails THEN the system SHALL maintain base price (or optionally add 10% penalty)
6. WHEN handling wine/brandy THEN the system SHALL apply quality tier pricing modifiers

### Requirement 3

**User Story:** As a player, I want to sell cargo with proper restrictions and buyer mechanics, so that the trading system maintains economic balance.

#### Acceptance Criteria

1. WHEN attempting to sell cargo THEN the system SHALL prevent sales in the same settlement where purchased
2. IF selling in same location THEN the system SHALL require minimum 1 week wait time
3. WHEN checking for buyers THEN the system SHALL calculate chance as Size × 10 (+30 if Trade settlement)
4. IF no buyer found THEN the system SHALL offer option to sell half cargo and re-roll
5. WHEN selling at villages (Size 1) THEN the system SHALL only allow Grain sales except in Spring (1d10 EP other goods)
6. WHEN calculating sale price THEN the system SHALL apply wealth-based modifiers (50%-110% of base price)
7. IF player haggles successfully THEN the system SHALL increase offer by 10% (or 20% with Dealmaker)

### Requirement 4

**User Story:** As a Game Master, I want access to desperate sale and rumor-based premium sale options, so that players have alternative trading strategies.

#### Acceptance Criteria

1. WHEN using desperate sale THEN the system SHALL only allow at settlements producing "Trade"
2. WHEN desperate sale occurs THEN the system SHALL set price at 50% base price with no haggling
3. WHEN player attempts Gossip test THEN the system SHALL use Difficult (-10) modifier
4. IF Gossip test succeeds THEN the system SHALL reveal settlement with 200% base price demand
5. WHEN selling at rumored location THEN the system SHALL allow sale at premium price

### Requirement 5

**User Story:** As a Game Master, I want to set and track the current season, so that seasonal price variations apply correctly.

#### Acceptance Criteria

1. WHEN module initializes THEN the system SHALL provide interface to set current season
2. WHEN season changes THEN the system SHALL update all cargo pricing accordingly
3. WHEN displaying prices THEN the system SHALL indicate current seasonal modifiers
4. IF season is not set THEN the system SHALL prompt for season selection before trading
5. WHEN saving game state THEN the system SHALL persist current season setting

### Requirement 6

**User Story:** As a Game Master, I want the module to integrate seamlessly with FoundryVTT's native systems, so that it works with existing character sheets and game mechanics.

#### Acceptance Criteria

1. WHEN module initializes THEN it SHALL integrate with FoundryVTT's dialog system
2. WHEN transactions occur THEN the system SHALL update actor currency using configured field paths
3. WHEN cargo is purchased THEN the system SHALL add items to actor inventory using configured methods
4. IF system configuration is invalid THEN the module SHALL display clear error messages
5. WHEN displaying results THEN the system SHALL post formatted messages to chat
6. WHEN players use macros THEN the system SHALL support automation of common trading actions
7. WHEN rolling dice THEN the system SHALL use FoundryVTT's native dice roller
8. WHEN displaying roll results THEN the system SHALL show dice outcomes in chat
9. WHEN dice rolls fail THEN the system SHALL display clear failure messages
10. WHEN invalid settlements are selected THEN the system SHALL prevent transaction attempts

### Requirement 7

**User Story:** As a Game Master, I want to configure the module for different game systems through dataset swapping, so that the trading engine can work beyond WFRP.

#### Acceptance Criteria

1. WHEN loading settlement data THEN the system SHALL read from active dataset directory
2. WHEN switching datasets THEN the system SHALL reload all settlement, cargo, and configuration data
3. IF custom dataset is provided THEN the system SHALL validate required data structure
4. WHEN scanning settlement data THEN the system SHALL automatically build available production categories
5. IF dataset contains novel categories THEN the system SHALL support them without code modification
6. WHEN configuring currency integration THEN the system SHALL use field paths from config.json

### Requirement 8

**User Story:** As a developer or community member, I want to create custom datasets for the trading system, so that the module can support different campaigns and rule variants.

#### Acceptance Criteria

1. WHEN creating settlement data THEN the system SHALL require 9 core fields (region, name, size, ruler, population, wealth, source, garrison, notes)
2. WHEN defining cargo types THEN the system SHALL support seasonal price variations and quality tiers
3. IF settlement size uses custom enumeration THEN the system SHALL map to numeric values for calculations
4. WHEN wealth ratings are defined THEN the system SHALL support 1-5 scale with price modifiers
5. IF production categories are novel THEN the system SHALL incorporate them into availability checks
6. WHEN validating data format THEN the system SHALL require JSON structure for all data files
7. WHEN dataset validation fails THEN the system SHALL specify which fields are missing/invalid
8. WHEN loading corrupted data THEN the system SHALL fail fast with diagnostic information