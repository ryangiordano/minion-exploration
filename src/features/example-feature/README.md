# Example Feature

This is an example feature module demonstrating the feature-oriented architecture.

## Structure

- `scenes/` - Scenes specific to this feature
- `objects/` - Game objects and entities for this feature
- `assets/` - Assets (images, sounds, etc.) used by this feature
- `index.ts` - Public API exports for this feature

## Usage

Import the feature's public API:

```typescript
import { ExampleScene, InteractiveCircle } from '@/features/example-feature';
```

## Creating New Features

When creating a new feature, follow this structure:
1. Create a folder under `src/features/your-feature-name/`
2. Add subdirectories: `scenes/`, `objects/`, `assets/`
3. Create an `index.ts` to export the public API
4. Register your scenes in `main.ts`
