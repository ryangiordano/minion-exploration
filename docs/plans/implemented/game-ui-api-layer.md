# Game-UI API Layer

## The Idea

Create a generic, extensible API layer that bridges the Phaser game and the React UI. The UI can query game state and send commands without knowing Phaser internals.

## Why It's Interesting

- Clean separation of concerns: UI doesn't import Phaser types
- Testable: Can mock the API for UI testing
- Extensible: New game features expose new API endpoints
- Bidirectional: UI reads state AND sends commands
- Potentially reusable: Same API could power debug tools, replays, etc.

## Design Questions

1. **Push vs Pull**:
   - Does UI poll for state?
   - Does game push state changes? (Event-based)
   - Reactive store that both sides can observe?

2. **Granularity**:
   - Full game state snapshot?
   - Query specific slices (player stats, minion list)?
   - Subscribe to specific changes?

3. **Commands**:
   - How does UI send actions back? (pause, resume, select unit, etc.)
   - Validation: Can game reject invalid commands?

4. **Type Safety**:
   - Shared types between React and Phaser?
   - API contract defined in `core/types`?

## Potential Architecture

### Option A: Event Bus + State Store

```typescript
// Shared event bus
const gameEvents = new EventEmitter();

// Game side: publishes state changes
gameEvents.emit('state:player', { hp: 100, stamina: 50 });
gameEvents.emit('state:minions', [{ id: 1, state: 'following' }]);

// UI side: subscribes to state
gameEvents.on('state:player', (player) => setPlayerState(player));

// UI side: sends commands
gameEvents.emit('command:pause');
gameEvents.emit('command:selectMinion', { id: 1 });
```

### Option B: Zustand/Jotai Store (Reactive)

```typescript
// Shared store
const useGameStore = create((set) => ({
  isPaused: false,
  player: null,
  minions: [],

  // Commands
  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),
}));

// Game writes to store
useGameStore.setState({ player: { hp: 100 } });

// React reads from store (reactive)
const player = useGameStore((s) => s.player);
```

### Option C: GameAPI Singleton

```typescript
// core/api/GameAPI.ts
class GameAPI {
  // Queries
  getPlayer(): PlayerState;
  getMinions(): MinionState[];
  isPaused(): boolean;

  // Commands
  pause(): void;
  resume(): void;
  selectMinion(id: number): void;

  // Subscriptions
  onPlayerChange(callback: (player: PlayerState) => void): Unsubscribe;
}

// Exposed globally or via context
export const gameAPI = new GameAPI();
```

## Recommendation

**Option B (Zustand)** feels like the sweet spot:
- Minimal boilerplate
- React-native reactivity
- Works outside React too (Phaser can read/write)
- DevTools for debugging
- Tiny bundle size (~1kb)

## When to Revisit

When implementing React UI layer (see: react-ui-layer.md).

## Related

- [react-ui-layer.md](react-ui-layer.md) - The React app that consumes this API
