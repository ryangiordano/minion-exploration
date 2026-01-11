# React UI Layer for Menus

## The Idea

Introduce a lightweight React application layered on top of the Phaser canvas to handle all menu/UI concerns that aren't real-time gameplay HUD.

## Why It's Interesting

- Phaser's built-in UI primitives are painful for complex menus, forms, settings
- React provides accessibility, responsive layouts, and familiar component patterns
- This is the conventional approach for Phaser games with non-trivial UI
- Keeps gameplay rendering in Phaser where it belongs, UI in DOM where it belongs

## Use Cases

- Main menu / title screen
- Pause menu
- Settings screens
- Inventory / unit management screens
- Level select
- Any modal dialogs or overlays

## Design Questions

1. **Layering**: React app renders a transparent overlay div on top of Phaser canvas?
2. **State sync**: How does React know when to show/hide? (See: game-ui-api-layer.md)
3. **Styling**: Tailwind? CSS modules? Styled-components?
4. **Bundling**: Vite already supports React - minimal config change

## Technical Approach

```
┌─────────────────────────────────┐
│     React UI Layer (DOM)        │  ← Menus, dialogs, overlays
├─────────────────────────────────┤
│     Phaser Canvas               │  ← Gameplay, sprites, physics
└─────────────────────────────────┘
```

React mounts alongside Phaser, not inside it. Both share access to a game state API.

## When to Revisit

When we need our first real menu (main menu, pause screen, or settings).

## Related

- [game-ui-api-layer.md](game-ui-api-layer.md) - The API that bridges React and Phaser
