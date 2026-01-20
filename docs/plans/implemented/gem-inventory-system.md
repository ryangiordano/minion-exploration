# Gem Inventory System

## The Idea

Upgrade gems drop randomly from defeated enemies. Player collects gems into an inventory, then drag-and-drops them onto minions to equip. This shifts upgrades from "buy upgrades for specific minions" to "collect loot, then decide where to use it."

## Why This Direction

The previous approach (spending essence to buy upgrades directly on a minion) has a flaw: minions die easily. Investing in a specific minion feels bad when they get killed. With gem drops:

- **Loot drops feel good** - random rewards from combat are exciting
- **Player agency** - choose which minion gets the gem
- **Gems persist** - if minion dies, maybe gem drops? Or stays in inventory?
- **Inventory adds depth** - managing limited gem resources is interesting

## Implementation Plan

### Phase 1: Gem Drops

1. **Gem data structure**
   - Type, color, effect (reuse existing `AbilityGem` types)
   - Visual: simple colored circle for now

2. **Drop mechanics**
   - Enemies have chance to drop gems on death (like essence)
   - Gem spawns as world object, player walks over to collect
   - Collection animation (arc to player like essence)

3. **Gem types** (start simple)
   - Red: Attack boost
   - Blue: Defense/HP boost
   - Green: Speed boost
   - Yellow: Lifesteal

### Phase 2: Inventory Feature

1. **New feature directory**: `src/features/inventory/`
   - `data/InventoryState.ts` - tracks collected gems
   - `ui/InventoryModal.ts` - modal that opens with I key
   - `ui/GemSlot.ts` - individual gem display in inventory

2. **Modal behavior**
   - Opens with I key
   - Shows grid of collected gems
   - Clicking a gem selects it for equipping

3. **Drag and drop**
   - Select gem in inventory
   - Click on minion to equip
   - OR: drag gem from inventory onto minion directly

### Phase 3: Minion Gem Display

1. **Visual indicator**
   - Row of small circles below minion
   - Each circle represents an equipped gem slot
   - Color matches gem type (or gray if empty)

2. **Slot system**
   - Minions have fixed number of gem slots (start with 3?)
   - Can equip multiple gems of same type
   - Gems can be swapped/removed

### Phase 4: Gem Effects

1. **Stat modifications**
   - Hook into minion stat calculation
   - Each gem adds its effect

2. **Visual feedback on equip**
   - Sparkle effect
   - Minion briefly pulses gem color

## Design Questions

1. **What happens when minion dies?**
   - Option A: Gems are lost (harsh, but creates tension)
   - Option B: Gems return to inventory (safer, less punishing)
   - Option C: Gems drop at death location, can be recollected

2. **Gem stacking?**
   - Can you equip 3 attack gems for 3x effect?
   - Or are they unique-per-minion?

3. **Gem rarity?**
   - Just one tier for now
   - Future: common/rare/epic with stronger effects

4. **Inventory limits?**
   - Unlimited for MVP?
   - Capped inventory adds management decisions

## File Structure

```
src/features/
  inventory/
    data/
      InventoryState.ts      # Gem collection tracking
      GemConfig.ts           # Gem type definitions
    objects/
      WorldGem.ts            # Collectible gem in world
    ui/
      InventoryModal.ts      # I key modal
      GemSlot.ts             # Single gem display
    index.ts

  minions/
    objects/
      Minion.ts              # Add: equippedGems[], gem slot display
```

## When to Build

Now - this is the next major feature direction.

## Related

- [minion-ability-slots.md](minion-ability-slots.md) - Earlier thinking on slot systems
