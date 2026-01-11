# Minion Leveling System

## The Idea

Minions gain levels over time, and leveling increases their base stats according to a defined curve.

## Why It's Interesting

- Creates sense of progression and investment in individual minions
- Makes losing a high-level minion meaningful (emotional stakes)
- Provides a knob for balancing difficulty over time
- Players develop attachment to "veteran" minions

## Core Stats

| Stat | Effect |
|------|--------|
| **HP** | Health pool |
| **MP** | Mana for abilities (if we add active abilities) |
| **Strength** | Physical damage output |
| **Dexterity** | Attack speed, dodge chance, movement speed? |
| **Magic** | Magical damage, ability potency |
| **Resilience** | Damage reduction, status resistance |

## Design Questions

1. **XP Source**: How do minions gain XP?
   - Per enemy killed?
   - Shared pool across squad?
   - Time-based (survival)?
   - Participation-based (dealt damage, took damage)?

2. **Leveling Curve**: Linear, exponential, soft cap?
   - Fast early levels, slower later?
   - Max level cap?

3. **Stat Growth**: How do stats scale?
   - Flat increase per level?
   - Percentage growth?
   - Different growth rates per stat?
   - Minion "classes" with different growth profiles?

4. **Visibility**: How does player see level/stats?
   - Level indicator above minion?
   - Stats visible in UI panel?
   - Visual changes at level thresholds?

5. **Persistence**: Do levels persist between runs/levels?

## Potential Implementation

```typescript
interface MinionStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  dexterity: number;
  magic: number;
  resilience: number;
}

interface LevelingConfig {
  baseStats: MinionStats;
  growthRates: Partial<MinionStats>;  // Per-level increase
  xpCurve: (level: number) => number; // XP needed for next level
}

// On Minion class
class Minion {
  level: number = 1;
  xp: number = 0;

  addXp(amount: number) {
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel()) {
      this.levelUp();
    }
  }

  private levelUp() {
    this.level++;
    // Apply stat growth
  }
}
```

## When to Revisit

When core combat loop feels solid and we want to add progression depth.

## Related

- [minion-ability-slots.md](minion-ability-slots.md) - Slots for abilities/passives (separate from base stats)
