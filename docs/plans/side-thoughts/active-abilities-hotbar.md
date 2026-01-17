# Side Thought: Active Abilities & Hotbar System

## The Problem This Was Trying to Solve

Combat feels passive - minions auto-attack and auto-fire abilities, so the player is mostly just watching after issuing attack orders. We wanted more meaningful player input during combat.

## The Proposed Solution

Manual ability activation via a dynamic hotbar:
- Active abilities require player input to fire (passives stay passive)
- Equipping an active gem on a minion adds an entry to a shared hotbar
- Keys 1, 2, 3, etc. fire abilities
- Abilities only fireable when their minion is selected
- Multiple minions with same ability show as "charges"

## Why We Tabled It

**Complexity scales badly**: With 3+ minions, each potentially having multiple active abilities, the hotbar becomes overwhelming. You're essentially managing multiple hero ability bars simultaneously.

**Micromanagement feel**: The game is about commanding minions, not being them. A hotbar pushes toward direct control that might fight against the commander fantasy.

**May not be necessary**: The Minion Preservation System (limited party, minions that matter) might already make combat more engaging through higher stakes alone. Worth testing that first.

## When to Revisit

- If combat still feels too passive after preservation system is implemented
- If we find a simpler activation model (e.g., one "party ability" instead of per-minion hotbar)
- If the game shifts toward fewer, more powerful minions where direct ability control makes sense

## Alternative Approaches to Explore

1. **Commander abilities**: Player has abilities, not minions. "Heal all selected minions", "All selected minions use their active ability"

2. **Tactical pause**: Slow/pause time to issue commands, abilities fire on unpause

3. **Stance system**: Toggle minion behavior modes (aggressive/defensive/ability-focused) rather than direct ability control

4. **Auto-fire with player targeting**: Abilities auto-fire, but at a location/enemy the player designates

5. **Fewer, bigger abilities**: One ultimate ability per minion that the player triggers, rest is passive

## Key Insight to Preserve

The player needs *something* to do during combat beyond initial attack orders. The solution should add agency without adding micromanagement overhead.
