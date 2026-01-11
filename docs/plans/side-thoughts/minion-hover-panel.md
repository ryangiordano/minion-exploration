# Minion Hover Panel

## The Idea

When mousing over a minion, show a tooltip/panel with:
- HP / Max HP
- MP / Max MP
- XP progress to next level
- Equipped gems with icons and descriptions

## Why It's Needed

The ability gem system has no discoverability without UI. Players need to see what gems are equipped and what they do. Hover panel is the simplest approach that doesn't require a full inventory/equipment screen.

## Design Sketch

```
┌─────────────────────────┐
│ Minion Lv.3             │
│ HP: 7/7   MP: 6/6       │
│ XP: ████████░░ 80/100   │
│                         │
│ [💎] Knockback Gem      │
│   Attacks push enemies  │
└─────────────────────────┘
```

## Implementation Notes

- Could use Phaser DOM elements or pure graphics
- Position panel near minion but not obscuring it
- Hide when mouse leaves minion
- Consider: should panel follow minion or stay fixed?

## When to Revisit

After ability gem system MVP is working. Need something equipped to show before this is useful.

## Related

- Ability gem system (prerequisite)
- React UI layer (alternative approach - could be React component instead)
- game-ui-api-layer.md
