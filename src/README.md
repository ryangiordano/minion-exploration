# Source Structure

This project uses a feature-oriented architecture where code is organized by features rather than by technical layers.

## Directory Structure

```
src/
├── core/              # Core game configuration and shared utilities
│   ├── config/        # Game configuration
│   └── types/         # Shared TypeScript types and interfaces
│
├── features/          # Feature modules (self-contained game features)
│   └── example-feature/
│       ├── scenes/    # Scenes for this feature
│       ├── objects/   # Game objects for this feature
│       ├── assets/    # Assets for this feature
│       └── index.ts   # Public API exports
│
└── main.ts           # Application entry point
```

## Creating a New Feature

1. Create a new directory under `features/`:
   ```
   src/features/my-feature/
   ```

2. Add the standard subdirectories:
   - `scenes/` - Phaser scenes
   - `objects/` - Game objects, sprites, entities
   - `assets/` - Images, sounds, etc. specific to this feature

3. Create an `index.ts` to export your public API:
   ```typescript
   export { MyScene } from './scenes/MyScene';
   export { MyGameObject } from './objects/MyGameObject';
   ```

4. Register your scenes in `main.ts`:
   ```typescript
   import { MyScene } from './features/my-feature';

   const config = {
     ...gameConfig,
     scene: [MyScene, ...]
   };
   ```

## Benefits of Feature-Oriented Architecture

- **Encapsulation**: Each feature is self-contained with its own scenes, objects, and assets
- **Scalability**: Easy to add, remove, or modify features without affecting others
- **Maintainability**: Related code stays together, making it easier to understand and maintain
- **Reusability**: Features can be easily ported to other projects
- **Team collaboration**: Multiple developers can work on different features with minimal conflicts
