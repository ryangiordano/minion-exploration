# Minion Exploration

A Pikmin-inspired game built with Phaser 3, TypeScript, and Vite.

## Features

- RTS-style unit selection and command system
- Multi-select minions with Shift+Click
- Command pattern architecture for scalable unit control
- Comprehensive test suite with Vitest
- Pre-commit hooks to ensure code quality

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Controls

- **WASD/Arrow Keys** - Move player
- **Shift** - Sprint (consumes stamina)
- **Left Click** - Select minion
- **Shift + Left Click** - Multi-select minions
- **Right Click** - Command selected minions to move

## Project Structure

This project uses a **feature-oriented architecture** where code is organized by features rather than by technical layers.

```
src/
├── core/              # Core game systems and utilities
│   ├── commands/      # Command pattern implementation
│   ├── components/    # Reusable game components
│   ├── config/        # Game configuration
│   └── types/         # Shared TypeScript interfaces
├── features/          # Feature modules (self-contained)
│   ├── level/         # Main gameplay scene
│   ├── minions/       # Minion AI and behaviors
│   └── player/        # Player character
└── main.ts            # Application entry point
```

See [CLAUDE.md](CLAUDE.md) for detailed architectural guidelines.

## Technology Stack

- **Phaser 3** - Game engine
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Vitest** - Unit testing
- **Husky** - Git hooks for quality checks
