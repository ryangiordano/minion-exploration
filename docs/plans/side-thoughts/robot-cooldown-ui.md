# Robot Cooldown UI

## The Idea
Show cooldowns for robot's personal gem abilities at the bottom of the screen. Helps player know when heal pulse (and other abilities) are available.

## Design
- Small HUD panel at bottom of screen
- Shows equipped personal gems as icons
- Cooldown overlay (radial fill or gray-out effect)
- Only for robot abilities (nanobots less important for now)

## Implementation Notes
- Need to expose cooldown state from gems (currently `lastTriggerTime` is private)
- Could add `getCooldownRemaining()` method to gems with cooldowns
- UI component polls robot's personal gems each frame
- Use gem color from GemConfig for icon tint

## When to Implement
After core ability behavior is working well. This is polish/UX.
