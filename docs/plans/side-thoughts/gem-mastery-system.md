# Gem Mastery System

## The Idea

Equipped gems have their own XP bar. When a gem is "mastered" (XP bar full), some form of persistence between runs is conferred - perhaps the gem becomes permanently stronger, or unlocks a variant, or grants a passive bonus even when unequipped.

## Why It's Interesting

- Adds long-term progression beyond individual runs
- Creates attachment to specific gems ("my maxed-out Knockback gem")
- Encourages experimentation (try different gems to master them)
- Roguelike meta-progression hook (mastered gems carry benefits forward)

## Design Questions

1. **What persists?**
   - Gem power level increases?
   - Unlock gem variants/evolutions?
   - Passive bonuses when unequipped?
   - Unlock for starting loadout?

2. **How is mastery XP gained?**
   - Same as minion XP (combat)?
   - Usage-based (heal gem gains XP per heal)?
   - Both?

3. **Mastery tiers?**
   - Binary (unmastered → mastered)?
   - Multiple levels (Bronze → Silver → Gold)?

4. **UI representation?**
   - Small XP bar on gem icon?
   - Gem glow/visual change when mastered?

## When to Revisit

After the base ability gem system is working. This is a meta-progression layer on top of the core system.

## Related

- Ability gem slot system (prerequisite)
- Run persistence / save system
