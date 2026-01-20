# Tick System Implementation Plan

## Overview

A centralized timing system that provides a global "heartbeat" for periodic game effects. Instead of each system managing its own timers, effects register with the TickSystem and receive callbacks at regular intervals.

## Design Decisions

- **Tick interval:** 500ms (2 ticks per second)
- **Durations expressed in ticks**, not milliseconds (e.g., "lasts 6 ticks" = 3 seconds)
- **Scope:** DOTs, HOTs, buff/debuff durations, periodic effects
- **Out of scope:** Attack cooldowns, movement, animations (these stay frame-based)

## Architecture

### TickSystem Class

Location: `src/core/systems/TickSystem.ts`

```typescript
interface TickEffect {
  id: string;
  target: unknown;           // The entity this effect is attached to
  onTick: () => void;        // Called each tick
  ticksRemaining: number;    // Decrements each tick, removed at 0
  onExpire?: () => void;     // Optional cleanup callback
}

class TickSystem {
  private effects: Map<string, TickEffect>;
  private tickInterval: number = 500;
  private elapsed: number = 0;
  private currentTick: number = 0;
  private paused: boolean = false;

  update(delta: number): void;
  register(effect: TickEffect): string;
  unregister(id: string): void;
  pause(): void;
  resume(): void;

  // Helpers
  getEffectsForTarget(target: unknown): TickEffect[];
  clearEffectsForTarget(target: unknown): void;
}
```

### Integration Points

1. **LevelScene** owns the TickSystem instance
2. **LevelScene.update()** calls `tickSystem.update(delta)`
3. Systems that apply effects (combat, abilities) register with TickSystem

### Refactoring DebuffManager

Current DebuffManager tracks durations in milliseconds. We'll update it to:

1. Store `ticksRemaining` instead of `remainingMs`
2. Register debuffs with TickSystem when applied
3. Let TickSystem handle the countdown and expiration
4. DebuffManager becomes a registry/query layer, not a timer

```typescript
// Before
applyDebuff(type: DebuffType, durationMs: number)

// After
applyDebuff(type: DebuffType, ticks: number, onTick?: () => void)
```

## Implementation Steps

### Step 1: Create TickSystem

- Create `src/core/systems/TickSystem.ts`
- Implement core tick loop with delta accumulation
- Add register/unregister API
- Add pause/resume support
- Export from `src/core/systems/index.ts`

### Step 2: Integrate with LevelScene

- Instantiate TickSystem in LevelScene
- Call `tickSystem.update(delta)` in scene update loop
- Make tickSystem accessible to systems that need it (pass via context or scene reference)

### Step 3: Refactor DebuffManager

- Change duration storage from `remainingMs` to `ticksRemaining`
- Update `applyDebuff` signature to accept ticks
- Register debuffs with TickSystem on apply
- Update `hasDebuff` and query methods (no changes needed, just storage)
- Remove manual delta countdown logic

### Step 4: Update Debuff Callers

- Find all places that call `applyDebuff`
- Convert millisecond durations to tick counts
- Example: `applyDebuff('stun', 2000)` → `applyDebuff('stun', 4)` (4 ticks = 2 seconds)

### Step 5: Add DOT Support (New Capability)

- Create poison/burn/bleed effect types that deal damage onTick
- Register with TickSystem when applied
- Damage happens each tick, effect expires after N ticks

### Step 6: Add Regen/HOT Support

- Health regeneration ticks through the system
- Healing gems can apply HOT effects that tick

### Step 7: Create Poison Gem (Demonstration)

- Create a new `PoisonGem` ability gem
- On hit, applies poison effect to target
- Poison deals X damage per tick for N ticks
- Add visual indicator (green tint or particles) while poisoned
- This validates the full system end-to-end

## Example Usage

```typescript
// Applying a 3-second stun (6 ticks)
debuffManager.applyDebuff('stun', 6);

// Applying poison that deals 5 damage per tick for 4 ticks
tickSystem.register({
  id: `poison-${enemy.id}-${Date.now()}`,
  target: enemy,
  ticksRemaining: 4,
  onTick: () => enemy.takeDamage(5, 'poison'),
  onExpire: () => enemy.removeVisualEffect('poison'),
});

// Health regen: heal 2 HP per tick for 10 ticks
tickSystem.register({
  id: `regen-${minion.id}`,
  target: minion,
  ticksRemaining: 10,
  onTick: () => minion.heal(2),
});
```

## Future Considerations

- **Tick rate modifiers:** Abilities that "speed up" or "slow down" time for an entity
- **Tick events:** Global event emitter so systems can listen to tick boundaries
- **Visual tick indicator:** Optional UI element showing the tick rhythm
- **Configurable tick rate:** Per-scene or global setting for balance tuning

## Migration Notes

- Existing `durationMs` values need conversion: `ticks = Math.ceil(durationMs / 500)`
- DebuffManager's `update(delta)` method will be simplified or removed
- No changes needed to AttackBehavior or ability cooldowns (they stay frame-based)
