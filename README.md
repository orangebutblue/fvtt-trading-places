# Trading Places Module


## Features

- Complete implementation of the official WFRP 4E trading algorithm (pages 71-78)
- System-agnostic design with dataset swapping capability
- Full FoundryVTT integration with native dice rolling and chat messages
- Seasonal price variations and market dynamics
- Haggling mechanics with skill tests
- Settlement-based cargo availability and buyer mechanics
- GM-configurable settings for chat visibility and season management

## Installation

1. In FoundryVTT, go to the Add-on Modules tab
2. Click "Install Module"
3. Paste the manifest URL: `https://github.com/foundry-modules/trading-places/releases/latest/download/module.json`
4. Click "Install"

## Usage

1. Enable the module in your world
2. Set the current season in module settings
3. Use the trading dialog to conduct Trading Places transactions
4. All dice rolls and results are posted to chat with configurable visibility

## Configuration

The module supports system-agnostic configuration through dataset files:
- `datasets/active/` - Currently active trading dataset
- `datasets/wfrp4e-default/` - Default WFRP 4E dataset

## Requirements

- FoundryVTT v10 or higher
- Compatible with WFRP4e system (optional)

## License

This module is licensed under the MIT License.