# Phaser 3 TypeScript Game

A Phaser 3 game template with TypeScript and Vite.

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run development server:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   ```

## Project Structure

This project uses a **feature-oriented architecture** where code is organized by features rather than by technical layers.

```
src/
├── core/              # Core game configuration and shared utilities
│   ├── config/        # Game configuration
│   └── types/         # Shared TypeScript types
├── features/          # Feature modules (self-contained)
│   └── example-feature/
│       ├── scenes/    # Feature-specific scenes
│       ├── objects/   # Feature-specific game objects
│       └── assets/    # Feature-specific assets
└── main.ts            # Application entry point
```

See [src/README.md](src/README.md) for detailed information on creating new features.

## Note

This project uses Phaser 3 (v3.90.0), as Phaser 4 has not been officially released yet.
