# Minion Ability & Passive Slot System

## The Idea

Minions have slots where players can equip items/crystals/runes that grant abilities or passive effects. This allows customization of individual minions beyond their base stats.

## Why It's Interesting

- Deep customization without class explosion
- Player expression: build minions your way
- Loot system hook: finding crystals/runes is exciting
- Tactical variety: adapt loadout to challenges
- Emergent builds: combining passives in unexpected ways

## Slot Types

| Slot Type | Purpose | Examples |
|-----------|---------|----------|
| **Ability** | Active or attack-modifying abilities | Ranged attack, AoE slam, heal pulse |
| **Passive** | Stat modifiers or triggered effects | +20% HP, thorns damage, lifesteal |

## Example Crystals/Runes

**Passives:**
- **Vitality Crystal**: +25% max HP
- **Thorns Rune**: Reflect 10% damage to attackers
- **Vampiric Shard**: Heal 5% of damage dealt
- **Iron Skin**: +15 resilience
- **Swift Feet**: +20% movement speed

**Abilities (replace or augment attack):**
- **Ranged Crystal**: Attacks become ranged projectiles
- **Knockback Rune**: Attacks push enemies back
- **Cleave Gem**: Attacks hit in an arc
- **Poison Fang**: Attacks apply poison DoT
- **Stun Strike**: Chance to stun on hit

## Design Questions

1. **Slot Count**: How many slots per minion?
   - Fixed (e.g., 1 ability + 2 passives)?
   - Scales with level?
   - Unlockable slots?

2. **Equip Restrictions**:
   - Can any crystal go in any slot?
   - Unique-equipped (only one Vampiric Shard per minion)?
   - Squad-wide uniques?

3. **Acquisition**: Where do crystals come from?
   - Drops from enemies?
   - Found in treasure?
   - Crafted/combined?

4. **UI**: How does player manage loadouts?
   - Per-minion equipment screen
   - Drag-and-drop from inventory
   - Quick-swap presets?

5. **Stacking**: Do multiple copies stack?
   - Additive? Multiplicative? Diminishing?

6. **Visual Feedback**: Can you tell a minion's loadout by looking at it?
   - Glow effects?
   - Particle trails?
   - Equipment visible on sprite?

## Potential Architecture

```typescript
interface Crystal {
  id: string;
  name: string;
  type: 'ability' | 'passive';
  effects: Effect[];
  icon: string;
}

interface Effect {
  type: 'stat_modifier' | 'on_hit' | 'on_damaged' | 'attack_replace';
  // ... effect-specific data
}

interface MinionSlots {
  ability: Crystal | null;
  passive1: Crystal | null;
  passive2: Crystal | null;
}

// Effect system hooks into combat
class Minion {
  slots: MinionSlots;

  getEffectiveStat(stat: keyof MinionStats): number {
    let value = this.baseStats[stat];
    for (const crystal of this.equippedCrystals()) {
      value = crystal.modifyStat(stat, value);
    }
    return value;
  }

  onDealDamage(target: Enemy, damage: number) {
    for (const crystal of this.equippedCrystals()) {
      crystal.onDealDamage?.(this, target, damage);
    }
  }
}
```

## Implementation Considerations

- Effects need hook points: `onHit`, `onDamaged`, `onKill`, `onTick`, etc.
- May want an `EffectSystem` component that manages all active effects
- Consider how this interacts with leveling (do crystals scale with level?)

## When to Revisit

After leveling system exists and combat has more depth. This adds complexity, so base systems should be solid first.

## Related

- [minion-leveling-system.md](minion-leveling-system.md) - Base stats that crystals modify
