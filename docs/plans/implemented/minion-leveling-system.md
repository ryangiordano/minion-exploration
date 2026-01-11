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
| **Dexterity** | Attack speed, dodge chance, movement speed? Crit chance|
| **Magic** | Magical damage, ability potency |
| **Resilience** | Damage reduction, status resistance |

## Design Decisions

### XP Source
**Participation-based with equal split.** When an enemy dies, XP is split equally among all minions that participated in that combat (dealt or received damage).

**Combat Contribution Tracking:**
- A registry/map tracks which minions participated in combat with each enemy
- Registry is populated when a minion deals damage to or receives damage from an enemy
- When enemy dies, XP is calculated and split equally among all participants
- Registry entry for that enemy is cleared on death
- Entire registry could be wiped on full disengage (no active combats)

This approach:
- Rewards participation without creating perverse incentives to optimize kills
- Simple mental model for players
- Encourages sending minions into combat rather than holding back

### Leveling Curve
**Fast early, slower later** with a soft cap. Early levels feel frequent and rewarding. Later levels are bonuses, not expectations. Specific numbers TBD during tuning.

### Stat Growth
Start with **flat increase per level**, but data structure supports per-stat growth rates for future tuning.

### Visibility
Three bars stacked above minion head (flush against each other):
1. **Green** - HP (already exists)
2. **Blue** - MP
3. **Yellow** - XP progress to next level

Stats visible in squad panel (future). Visual changes at level thresholds (future polish).

### Persistence
**Per-run only.** Each run is its own bubble — levels reset on new run. Roguelite meta-progression (unlocks, permanent upgrades) is a separate system for later.

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
