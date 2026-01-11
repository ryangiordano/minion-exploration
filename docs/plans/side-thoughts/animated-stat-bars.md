# Animated Stat Bars

## Idea
Add visual polish to stat bars:
- Animate the bar fill when values increase/decrease (tween to new value instead of instant)
- Particle effects at the edge of the bar during changes

## Why It's Interesting
- Gives satisfying feedback for healing, damage, XP gains
- Makes the game feel more polished and "juicy"
- Particles could indicate direction (green sparkles for healing, red for damage)

## Design Questions
- Should the animation speed be configurable?
- Different particle colors/effects for different bar types (HP vs XP)?
- Should damage show a "delayed" red portion that catches up (like in fighting games)?

## When to Revisit
After core gameplay loop is solid and we're in polish phase.
