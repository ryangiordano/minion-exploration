# Plan: Minion Preservation System

**Status: IMPLEMENTED**

## Problem Statement

Combat currently feels chaotic and meaningless. Players spawn swarms of disposable minions with no attachment to individuals. Losing a minion has no weight - just spawn another. This undermines any sense of tactical depth or emotional investment.

## Design Goals

1. **Minions as investments** - Each minion should feel valuable and worth protecting
2. **Meaningful resource tension** - Essence should create interesting spend/save decisions
3. **Growth through depth, not quantity** - Power comes from better builds, not more bodies
4. **Death has consequences** - But not so punishing that players quit

## Core Design

### Party Limit: 3 Minions

Hard cap of 3 minions at any time. This is the foundation - everything else builds on making these 3 matter.

### Essence Economy Triangle

Three competing uses for essence:

| Action | Cost | Result |
|--------|------|--------|
| **Spawn** | High (50?) | Create new minion |
| **Repair** | Low (5-10?) | Restore minion HP |
| **Augment** | Medium (15-40) | Slot gem into minion |

*Exact costs TBD through playtesting. The ratio matters more than absolute numbers.*

### Gem Removal Rules

- **Remove gem → Gem is destroyed**, minion lives
- **Minion dies → Gems spill out intact**, minion is lost

This creates an interesting tension: badly-built minions can be "recycled" for their gems, but you lose the minion and spawn cost.

### Repair System

- Minions can be repaired at any time (not just between floors)
- Repair costs scale with missing HP? Or flat cost? (Design question)
- Creates pressure to invest in healing abilities to reduce repair drain

---

## Current State Analysis

### What Exists

| System | Status | Location |
|--------|--------|----------|
| Minion spawning | ✅ Works | `LevelScene.spawnMinion()` |
| Minion death | ✅ Works | `Minion.die()` → callback removes from array |
| Essence tracking | ✅ Works | `CurrencyDisplay` |
| Gem equipping | ✅ Works | `AbilitySystem.equipGem()` |
| Gem inventory | ✅ Works | `InventoryState` |
| Spawn cost | ✅ Exists | `MINION_COST = 10` (needs rebalancing) |

### What's Missing

| Feature | Notes |
|---------|-------|
| Party limit enforcement | No cap currently, can spawn unlimited |
| Gem dropping on death | Gems are destroyed with minion |
| Gem removal UI | No way to remove equipped gems |
| Repair mechanic | No way to heal outside floor clear / abilities |
| Augment cost | Slotting gems is currently free |
| WorldGems bug | `this.worldGems` referenced but never declared |

---

## Implementation Plan

### Phase 1: Party Limit & Spawn Cost Rebalance

**Goal**: Make minions feel limited and expensive.

#### 1.1 Enforce Party Limit

Create a party management system to track and enforce limits.

**New file**: `src/core/game-state/PartyManager.ts`
```typescript
// Tracks party composition and enforces limits
// - maxPartySize: number (default 3)
// - canAddMinion(): boolean
// - getPartySize(): number
```

**Changes to LevelScene**:
- Check `partyManager.canAddMinion()` before spawning
- Disable spawn UI/keybind when at cap
- Display party count somewhere (e.g., "Minions: 2/3")

#### 1.2 Rebalance Spawn Cost

Increase `MINION_COST` significantly (50+ essence). Losing a minion should set you back meaningfully.

**Tuning consideration**: Starting essence may need adjustment so players can spawn initial party.

#### 1.3 Starting Party

Options:
- A) Start with 3 minions, spawning is only for replacement
- B) Start with 1 minion + enough essence to spawn 2 more
- C) Start with 0 minions + essence to spawn 3

Recommend **(A)** for smoother onboarding - players learn the game before facing resource pressure.

---

### Phase 2: Gem Economy Changes

**Goal**: Make gem slotting a meaningful investment.

#### 2.1 Augment Cost (Slotting Gems)

When equipping a gem to a minion, deduct essence cost.

**Changes to upgrade flow**:
- `UpgradeMenu` or `InventoryDisplay` checks `currencyDisplay.canAfford(gemCost)`
- On equip: `currencyDisplay.spend(gemCost)`
- Show cost in UI when selecting gem to equip

**Design question**: Is cost the gem's base cost, or a separate "slotting fee"?
- *Recommendation*: Use gem's base cost. Simple, already defined in registry.

#### 2.2 Gem Removal (Destroys Gem)

Add ability to remove gems from minions.

**UI approach**:
- In upgrade menu, clicking an equipped gem shows "Remove (destroys gem)" option
- Confirmation dialog? Or just do it? (Lean toward no confirmation - keep it snappy)

**Changes to AbilitySystem**:
- Add `removeGem(slot): void` method
- Calls `gem.onUnequip()` if it exists, then nulls the slot

**Changes to Minion**:
- Expose `removeGem(slot)` that delegates to ability system
- Update `GemSlotDisplay` to reflect removal

---

### Phase 3: Death & Gem Recovery

**Goal**: Death hurts, but gems are recoverable.

#### 3.1 Fix WorldGems Bug

`LevelScene` references `this.worldGems` but never declares it.

**Fix**: Add `private worldGems: WorldGem[] = []` to class properties.

#### 3.2 Gems Drop on Minion Death

When a minion dies, spawn `WorldGem` objects for each equipped gem.

**Changes to Minion.die()**:
- Before destroy, emit event or call callback with equipped gems
- Or: return equipped gems from `die()` method

**Changes to LevelScene death callback**:
- Get equipped gems from dying minion
- For each gem, spawn `WorldGem` at minion's position
- Add slight random offset so gems don't stack perfectly
- Gems are collectible like enemy-dropped gems

#### 3.3 Death Animation Enhancement (Optional)

Make gem spilling feel impactful:
- Gems burst outward with velocity
- Slight delay between minion fade and gem spawn
- Sound effect / particle burst

---

### Phase 4: Repair System

**Goal**: Let players spend essence to heal minions.

#### 4.1 Repair Mechanic

**Design options**:

| Option | Pros | Cons |
|--------|------|------|
| Flat cost per repair (e.g., 10 essence = full heal) | Simple, predictable | No scaling with damage taken |
| Cost per HP restored (e.g., 1 essence per 2 HP) | Scales with damage | Math-y, less intuitive |
| Percentage-based (e.g., 5 essence = heal 50% max HP) | Middle ground | Still requires calculation |

*Recommendation*: **Flat cost for full heal**. Simple to understand, creates clear decision: "Is healing this minion worth 10 essence?"

#### 4.2 Repair UI

**Option A**: Button in upgrade menu when minion selected
- Shows "Repair (X essence)" when minion is damaged
- Grayed out if at full HP or can't afford

**Option B**: Global repair keybind
- Press R to open repair mode
- Click minion to repair
- Shows cost preview on hover

**Option C**: Contextual in-world
- Damaged minions show repair icon above them
- Click icon to repair

*Recommendation*: **Option A** - keeps economy actions in the upgrade menu, single place for minion management.

#### 4.3 Repair Implementation

**New method in LevelScene or dedicated RepairSystem**:
```typescript
repairMinion(minion: Minion): boolean {
  const cost = this.getRepairCost(minion);
  if (!this.currencyDisplay.canAfford(cost)) return false;
  if (minion.getCurrentHp() >= minion.getMaxHp()) return false;

  this.currencyDisplay.spend(cost);
  minion.heal(minion.getMaxHp()); // Full heal
  // Play repair effect
  return true;
}
```

---

### Phase 5: UI & Feedback

**Goal**: Make the economy visible and understandable.

#### 5.1 Party Counter

Display current/max party size: "Minions: 2/3"

**Location options**:
- Near essence display (bottom right)
- Top of screen with other HUD elements
- In upgrade menu header

#### 5.2 Cost Previews

Show costs before committing:
- Spawn button shows cost
- Gem equip shows cost
- Repair shows cost

#### 5.3 Death Feedback

When minion dies:
- Gem spill is visually clear
- Maybe brief "Minion Lost" text
- Party counter updates

---

## Open Questions

### Balancing (Needs Playtesting)

- [ ] What's the right spawn cost? (50? 75? 100?)
- [ ] What's the right repair cost? (5? 10? 15?)
- [ ] Should starting party be free, or cost essence?
- [ ] How much essence do enemies drop? (May need rebalancing)

### Design Decisions

- [ ] Can you repair during combat, or only when safe?
- [ ] Should repair cost scale with minion level/upgrades?
- [ ] Do we want a "downed" state before true death? (Second chance mechanic)
- [ ] Should there be a minimum time before respawning? (Prevent instant replacement)

### Future Considerations (Out of Scope)

- Unlocking additional party slots (grow to 4, 5 minions over time?)
- Unlocking additional gem slots per minion
- Minion-specific upgrades / veterancy system
- Persistent minions across runs

---

## Implementation Order

Suggested sequence to enable incremental testing:

1. **Fix worldGems bug** - Prerequisite for gem dropping
2. **Party limit (3)** - Immediate feel change
3. **Increase spawn cost** - Makes limit meaningful
4. **Gems drop on death** - Recovery mechanic
5. **Augment cost** - Gem economy
6. **Gem removal** - Build flexibility
7. **Repair system** - Sustain mechanic
8. **UI polish** - Party counter, cost previews

Each step is testable independently. Stop and playtest after steps 2-4 to see if the core loop feels better.

---

## Success Criteria

The system is working when:

- [ ] Players feel tension about minion survival
- [ ] Losing a minion is painful but recoverable
- [ ] Resource decisions feel meaningful (repair vs augment vs save)
- [ ] Combat feels less chaotic with fewer minions
- [ ] Players develop attachment to their minions
