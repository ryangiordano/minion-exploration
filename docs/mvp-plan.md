# Pikmin-Like MVP Plan

## Core Concept
Control a player character who commands minions to carry treasures and fight enemies.

## MVP Scope (The Absolute Minimum)

### 1. Player Character
- **Movement**: WASD or arrow keys
- **Stamina bar**: Depletes when running, regenerates when idle
- **Visual**: Simple colored circle or sprite

### 2. Single Minion Type
- **Stats**: Speed, Strength (carrying capacity)
- **States**:
  - IDLE: Follows player
  - CARRY: Moving treasure to base
  - ATTACK: Attacking enemy
- **Visual**: Small colored circle that follows player

### 3. Selection & Commands
- **Click minion**: Select it (visual indicator)
- **Right-click target**: Send selected minion to interact
  - Click treasure → Attempt to carry
  - Click enemy → Attack
  - Click ground → Move there

### 4. One Treasure Type
- **Weight property**: Requires X strength to carry
- **Win condition**: Return to base (a designated area)
- **Visual**: Different colored shape

### 5. One Enemy Type
- **Health**: Takes damage from minions
- **Behavior**: Static (doesn't move/attack for MVP)
- **Death**: Disappears when health reaches 0
- **Visual**: Distinct colored shape

### 6. Base Zone
- **Visual**: Circle or area on map
- **Function**: Where treasures are returned
- **Win State**: "You collected the treasure!" message

## What We're NOT Building Yet
- ❌ Multiple minion types
- ❌ Unique abilities
- ❌ Minion leveling/XP (start with this in mind, but don't implement)
- ❌ Enemy AI (movement, attacking back)
- ❌ Multiple treasures/enemies
- ❌ Pathfinding (use simple point-and-move)
- ❌ Day/night cycles
- ❌ Complex UI

## Success Criteria
Can you:
1. Move the player around?
2. Select a minion?
3. Command it to pick up a treasure?
4. See it carry the treasure to base?
5. Command it to attack an enemy?
6. See the enemy die after enough attacks?

**If yes → MVP complete. Then iterate.**

## Technical Implementation Order

### Phase 1: Player (Day 1)
- Create Player class extending Sprite
- Add keyboard input (cursor keys)
- Add basic stamina (number that drains/refills)
- Display stamina as text or bar

### Phase 2: Minion Basics (Day 1-2)
- Create Minion class extending Sprite
- Implement IDLE state: Follow player at distance
- Add selection: Click to highlight
- Add move command: Right-click ground → move to point

### Phase 3: Treasure Interaction (Day 2)
- Create Treasure class
- Add weight property
- Minion CARRY state: If strength >= weight, carry to base
- Base zone: Check overlap, remove treasure, show win message

### Phase 4: Enemy Interaction (Day 3)
- Create Enemy class with health
- Minion ATTACK state: Move to enemy, deal damage over time
- Enemy death: Remove sprite when health <= 0

### Phase 5: Polish (Day 3-4)
- Visual feedback (selected minion glow, health bars)
- Basic sounds (optional)
- Multiple minions (spawn 3-5 at start)
- Test and tune: Is it fun to command them?

## Key Questions After MVP
- Is selecting/commanding minions satisfying?
- Does the stamina system add anything interesting?
- What would make this more fun: danger, choices, variety, progression?

## Next Iteration Ideas (Post-MVP)
- Enemy that moves/attacks back
- Second minion type with different stats
- Multiple treasures with varying weights
- Minion XP/leveling from your original doc
- Whistling to recall all minions
