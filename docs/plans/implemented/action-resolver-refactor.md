# ActionResolver Refactor Plan

## Problem Statement

Currently, gems contain both **data** (stat modifiers, attack configurations) and **behavior** (HealPulseGem has an `onUpdate` that makes decisions about when/how to heal). This creates issues:

1. **Unpredictable emergent behavior**: Multiple gems with `onUpdate` logic can interact in unexpected ways
2. **Gems control minion behavior**: The gem decides the healing strategy, not a centralized system
3. **Hard to reason about**: To understand what a minion does, you have to read all equipped gem code
4. **Scaling doesn't use stats**: HealPulseGem heals a flat amount instead of scaling with the owner's Magic stat

## Proposed Architecture

### Separation of Concerns

| Layer | Responsibility | Examples |
|-------|---------------|----------|
| **Gems** | Pure data/modifiers | Stats, attack effects, ability definitions |
| **ActionResolver** | Behavior decisions | When to use abilities, targeting priority |
| **AbilitySystem** | Hook dispatch + execution | Fire abilities, apply attack effects |

### What Gems Should Provide

1. **Stat Modifiers** - `getStatModifiers()` (already exists, good pattern)
2. **Attack Modifiers** - `getAttackModifiers()` (already exists, good pattern)
3. **Ability Definitions** - NEW: Define *what* an ability does, not *when* to use it
4. **Attack Effects** - `onAttackHit` (keep this - it's an effect, not behavior)

### What Gems Should NOT Have

- `onUpdate` with decision-making logic
- Logic that checks conditions and decides actions
- Cooldown management (move to AbilitySystem)

## New Interfaces

### AbilityDefinition (data only)

```typescript
export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;

  // Costs
  mpCost: number;
  cooldownMs: number;

  // Targeting
  targetType: 'self' | 'ally' | 'enemy' | 'area_allies' | 'area_enemies';
  range: number;  // How far can this ability reach?

  // Effect scaling
  effectType: 'heal' | 'damage' | 'buff' | 'debuff';
  basePower: number;  // Base value before stat scaling
  scalingStat?: 'strength' | 'magic' | 'dexterity';  // Which stat scales the effect?
  scalingRatio?: number;  // How much stat contributes (e.g., 0.5 = +0.5 per stat point)

  // Trigger conditions (for auto-abilities)
  autoTrigger?: {
    condition: 'ally_wounded' | 'enemy_in_range' | 'self_wounded' | 'always';
    threshold?: number;  // e.g., 0.7 for "ally below 70% HP"
  };

  // Visual effect key (for AbilitySystem to dispatch)
  effectKey?: string;
}
```

### Updated AbilityGem

```typescript
export interface AbilityGem {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  // Data providers (no behavior)
  getStatModifiers?(): StatModifier[];
  getAttackModifiers?(): Partial<AttackConfig>;
  getAbility?(): AbilityDefinition;  // NEW: Pure data

  // Effect hooks (executed, not decided)
  onAttackHit?(context: AttackHitContext): void;  // Keep - adds visual/knockback

  // Lifecycle (minimal)
  onEquip?(owner: GemOwner): void;
  onUnequip?(owner: GemOwner): void;

  // REMOVE: onUpdate - behavior moves to ActionResolver
}
```

### ActionResolver (new)

```typescript
export interface ActionResolverContext {
  owner: GemOwner;
  allies: GemOwner[];
  enemies: Combatable[];
  delta: number;
}

export class ActionResolver {
  private cooldowns: Map<string, number> = new Map();

  /**
   * Called each frame to evaluate and execute abilities.
   * Returns true if an ability was used this frame.
   */
  public update(context: ActionResolverContext, abilities: AbilityDefinition[]): boolean {
    // 1. Update cooldowns
    // 2. For each ability, check if conditions are met
    // 3. Find valid targets
    // 4. Execute highest priority ability
    // 5. Return whether an action was taken
  }

  private evaluateAbility(ability: AbilityDefinition, context: ActionResolverContext): {
    canUse: boolean;
    target: GemOwner | Combatable | null;
    priority: number;
  } {
    // Check cooldown, MP cost, target availability
    // Calculate priority based on urgency (e.g., lower ally HP = higher heal priority)
  }

  private executeAbility(
    ability: AbilityDefinition,
    owner: GemOwner,
    target: GemOwner | Combatable | null
  ): void {
    // Spend MP
    // Calculate scaled effect: basePower + (stat * scalingRatio)
    // Apply effect (heal, damage, buff)
    // Set cooldown
    // Trigger visual effect
  }
}
```

## Refactored HealPulseGem Example

**Before (behavior in gem):**
```typescript
export class HealPulseGem implements AbilityGem {
  private cooldownTimer: number = 0;

  onUpdate(owner: GemOwner, delta: number): void {
    this.cooldownTimer -= delta;
    if (this.cooldownTimer > 0) return;
    if (owner.getCurrentMp() < this.mpCost) return;

    const allies = owner.getNearbyAllies?.(this.healRadius) ?? [];
    const wounded = allies.filter(ally =>
      ally.getCurrentHp() / ally.getMaxHp() < this.hpThreshold
    );

    if (wounded.length === 0) return;

    // Gem makes targeting decision
    const mostWounded = wounded.reduce((a, b) => ...);

    if (owner.spendMp(this.mpCost)) {
      mostWounded.heal(this.healAmount);  // Flat amount, doesn't scale
      this.cooldownTimer = this.cooldownMs;
    }
  }
}
```

**After (data only):**
```typescript
export class HealPulseGem implements AbilityGem {
  readonly id = 'heal_pulse';
  readonly name = 'Heal Pulse Gem';
  readonly description = 'Auto-heals nearby wounded allies';

  getAbility(): AbilityDefinition {
    return {
      id: 'heal_pulse',
      name: 'Heal Pulse',
      description: 'Restore HP to wounded ally',
      mpCost: 2,
      cooldownMs: 3000,
      targetType: 'ally',
      range: 80,
      effectType: 'heal',
      basePower: 1,
      scalingStat: 'magic',
      scalingRatio: 0.5,  // Heal = 1 + (magic * 0.5)
      autoTrigger: {
        condition: 'ally_wounded',
        threshold: 0.7,
      },
      effectKey: 'heal_pulse',  // For visual effect
    };
  }
}
```

## AbilitySystem Changes

The AbilitySystem collects ability definitions from gems and passes them to the ActionResolver:

```typescript
export class AbilitySystem {
  private actionResolver: ActionResolver;

  public update(delta: number, context: ActionResolverContext): void {
    // Collect abilities from all equipped gems
    const abilities = this.getEquippedGems()
      .map(gem => gem.getAbility?.())
      .filter((a): a is AbilityDefinition => a !== undefined);

    // Let ActionResolver handle behavior
    this.actionResolver.update(context, abilities);
  }

  // Keep: getStatModifiers(), getAttackModifiers(), onAttackHit()
}
```

## Benefits

1. **Predictable behavior**: ActionResolver is the single source of behavior logic
2. **Stat scaling**: Effects scale with owner's stats (Magic → better heals)
3. **Easy to balance**: All ability data in one place, easy to tune numbers
4. **Testable**: ActionResolver can be unit tested with mock context
5. **Extensible**: Add new abilities by adding data, not behavior code

## Migration Path

1. **Phase 1**: Create ActionResolver and AbilityDefinition
2. **Phase 2**: Add `getAbility()` to HealPulseGem (keeping old `onUpdate` for now)
3. **Phase 3**: Wire ActionResolver into AbilitySystem.update()
4. **Phase 4**: Remove `onUpdate` from HealPulseGem
5. **Phase 5**: Remove `onUpdate` from AbilityGem interface

## Files to Create/Modify

### New Files
- `src/core/abilities/ActionResolver.ts` - Behavior logic
- `src/core/abilities/AbilityDefinition.ts` - Type definitions

### Modified Files
- `src/core/abilities/types.ts` - Add AbilityDefinition, update AbilityGem
- `src/core/abilities/AbilitySystem.ts` - Integrate ActionResolver
- `src/core/abilities/gems/HealPulseGem.ts` - Convert to data-only

### Unchanged Files (already good patterns)
- `src/core/abilities/gems/VitalityGem.ts` - Pure stat modifiers
- `src/core/abilities/gems/KnockbackGem.ts` - Attack effect only
- `src/core/abilities/gems/RangedAttackGem.ts` - Attack modifiers + effect

## Questions to Consider

1. **Should ActionResolver be part of AbilitySystem or separate?**
   - Leaning toward embedded in AbilitySystem for simplicity

2. **How to handle ability priorities?**
   - Could add priority field to AbilityDefinition
   - Or let ActionResolver calculate based on context urgency

3. **Visual effects - how dispatched?**
   - Could use event emitter pattern
   - Or callback on GemOwner interface

## Scope Note

This refactor primarily affects **active abilities** (HealPulseGem pattern). The existing patterns for:
- Passive stat gems (VitalityGem)
- Attack modifiers (RangedAttackGem)
- Attack effects (KnockbackGem)

...are already clean and don't need changes.
