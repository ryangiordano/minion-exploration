# Ability Gem System - Implementation Plan

## Overview

A composable system where minions have slots that hold ability gems. Gems hook into combat lifecycle events to modify attacks, add effects, or provide active abilities.

## Design Decisions

- **Unified slot type**: One slot type, gems self-declare what hooks they use
- **Separate cooldowns**: Active abilities (like heal) have their own cooldown, independent of attack
- **MVP scope**: One slot per minion, three example gems

## MVP Gems

1. **Knockback Gem** (attack modifier)
   - Pushes target back on hit
   - Hook: `onAttackHit`

2. **Heal Pulse Gem** (active ability)
   - Spends MP to heal nearby allied minions
   - Has own cooldown (e.g., 3 seconds)
   - Triggers when nearby ally below HP threshold
   - Hook: `onUpdate`

3. **Vitality Gem** (passive)
   - +2 max HP (flat bonus for MVP, could be % later)
   - Hook: `getStatModifiers`

## Architecture

### Core Interfaces

```typescript
// src/core/abilities/types.ts

export interface AbilityGem {
  id: string;
  name: string;
  description: string;

  // Lifecycle hooks - gems implement what they need
  onEquip?(owner: GemOwner): void;
  onUnequip?(owner: GemOwner): void;
  onAttackHit?(context: AttackHitContext): void;
  onTakeDamage?(context: TakeDamageContext): void;
  onUpdate?(owner: GemOwner, delta: number): void;

  // Stat modifiers (passive effects)
  getStatModifiers?(): StatModifier[];
}

export interface AttackHitContext {
  attacker: GemOwner;
  target: Combatable;
  damage: number;
  scene: Phaser.Scene;
}

export interface TakeDamageContext {
  defender: GemOwner;
  attacker: Combatable;
  damage: number;
  scene: Phaser.Scene;
}

export interface StatModifier {
  stat: 'maxHp' | 'maxMp' | 'strength' | 'dexterity' | 'magic' | 'resilience';
  type: 'flat' | 'percent';
  value: number;
}

export interface GemOwner {
  // Position
  x: number;
  y: number;
  getRadius(): number;

  // Resources
  getCurrentHp(): number;
  getMaxHp(): number;
  getCurrentMp(): number;
  getMaxMp(): number;
  spendMp(amount: number): boolean;
  heal(amount: number): void;

  // Scene access for effects
  getScene(): Phaser.Scene;

  // Finding allies (for heal)
  getNearbyAllies?(radius: number): GemOwner[];
}
```

### AbilitySystem Component

```typescript
// src/core/components/AbilitySystem.ts

export interface AbilitySystemConfig {
  maxSlots?: number;  // Default: 1
}

export class AbilitySystem {
  private slots: (AbilityGem | null)[];
  private owner: GemOwner;

  constructor(owner: GemOwner, config?: AbilitySystemConfig);

  // Slot management
  equipGem(gem: AbilityGem, slot?: number): boolean;
  unequipGem(slot: number): AbilityGem | null;
  getEquippedGems(): AbilityGem[];
  getGemInSlot(slot: number): AbilityGem | null;

  // Hook dispatchers (called by Minion/Enemy)
  onAttackHit(context: Omit<AttackHitContext, 'attacker'>): void;
  onTakeDamage(context: Omit<TakeDamageContext, 'defender'>): void;
  update(delta: number): void;

  // Stat calculation
  getStatModifiers(): StatModifier[];
}
```

### Example Gem Implementations

```typescript
// src/core/abilities/gems/KnockbackGem.ts
export class KnockbackGem implements AbilityGem {
  id = 'knockback';
  name = 'Knockback Gem';
  description = 'Attacks push enemies back';

  private knockbackDistance = 30;

  onAttackHit(context: AttackHitContext): void {
    const { attacker, target, scene } = context;
    const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
    const newX = target.x + Math.cos(angle) * this.knockbackDistance;
    const newY = target.y + Math.sin(angle) * this.knockbackDistance;

    scene.tweens.add({
      targets: target,
      x: newX,
      y: newY,
      duration: 100,
      ease: 'Power2'
    });
  }
}

// src/core/abilities/gems/HealPulseGem.ts
export class HealPulseGem implements AbilityGem {
  id = 'heal_pulse';
  name = 'Heal Pulse Gem';
  description = 'Automatically heals nearby wounded allies';

  private healRadius = 80;
  private healAmount = 2;
  private mpCost = 2;
  private cooldownMs = 3000;
  private hpThreshold = 0.7;  // Heal allies below 70% HP

  private cooldownTimer = 0;

  onUpdate(owner: GemOwner, delta: number): void {
    this.cooldownTimer -= delta;
    if (this.cooldownTimer > 0) return;

    // Check MP
    if (owner.getCurrentMp() < this.mpCost) return;

    // Find wounded allies
    const allies = owner.getNearbyAllies?.(this.healRadius) ?? [];
    const wounded = allies.filter(ally =>
      ally.getCurrentHp() / ally.getMaxHp() < this.hpThreshold
    );

    if (wounded.length === 0) return;

    // Heal the most wounded ally
    const mostWounded = wounded.reduce((a, b) =>
      a.getCurrentHp() / a.getMaxHp() < b.getCurrentHp() / b.getMaxHp() ? a : b
    );

    if (owner.spendMp(this.mpCost)) {
      mostWounded.heal(this.healAmount);
      this.cooldownTimer = this.cooldownMs;
      // TODO: Visual effect
    }
  }
}

// src/core/abilities/gems/VitalityGem.ts
export class VitalityGem implements AbilityGem {
  id = 'vitality';
  name = 'Vitality Gem';
  description = '+2 Max HP';

  getStatModifiers(): StatModifier[] {
    return [{ stat: 'maxHp', type: 'flat', value: 2 }];
  }
}
```

## Integration Points

### Minion Changes

1. Add `AbilitySystem` component
2. Implement `GemOwner` interface
3. Add `heal(amount)` method
4. Add `getNearbyAllies(radius)` method
5. Call `abilitySystem.onAttackHit()` after dealing damage
6. Call `abilitySystem.update(delta)` in update loop
7. Use `abilitySystem.getStatModifiers()` when calculating effective stats

### LevelingSystem Changes

1. Add method to apply external stat modifiers
2. `getEffectiveStats(modifiers: StatModifier[])` that combines base + growth + external

### AttackBehavior Changes

Minimal - just need to expose a hook point. The `onAttack` callback already exists, we just need to ensure the context includes enough info.

## File Structure

```
src/core/
  abilities/
    types.ts              # Interfaces
    AbilitySystem.ts      # Component that manages equipped gems
    gems/
      index.ts            # Export all gems
      KnockbackGem.ts
      HealPulseGem.ts
      VitalityGem.ts
```

## Implementation Order

1. Create `types.ts` with interfaces
2. Create `AbilitySystem` component
3. Implement `VitalityGem` (simplest - just stat modifier)
4. Add `GemOwner` implementation to Minion
5. Wire up stat modifiers in LevelingSystem
6. Test vitality gem works
7. Implement `KnockbackGem`
8. Wire up `onAttackHit` hook in Minion
9. Test knockback works
10. Add `heal()` and `getNearbyAllies()` to Minion
11. Implement `HealPulseGem`
12. Test healing works
13. Add visual effects for knockback and heal

## Testing Strategy

- Unit test: AbilitySystem slot management
- Unit test: Stat modifier calculation
- Manual test: Equip vitality gem, verify HP increases
- Manual test: Equip knockback gem, verify enemies pushed
- Manual test: Equip heal gem, verify MP spent and allies healed

## Future Considerations (Not MVP)

- Multiple slots (unlock with level?)
- Gem inventory UI
- Gem drops from enemies
- Gem combining/upgrading
- Enemy gems (enemies with abilities)
- Gem mastery system (see side-thoughts/gem-mastery-system.md)
