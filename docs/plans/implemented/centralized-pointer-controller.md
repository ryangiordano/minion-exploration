# Centralized Pointer Controller

## Context
Currently click handling is distributed across LevelScene:
- Background clicks (move command)
- Minion clicks (selection)
- Treasure clicks (collect command)
- Enemy clicks (attack command)

Each entity handles its own `pointerdown` event with similar patterns.

## When to Refactor
Consider centralizing when any of these become pain points:
- Click priority conflicts (e.g., enemy overlapping treasure - which gets the click?)
- Complex modifier keys affecting multiple entity types
- Debugging click behavior requires hunting across multiple files
- Adding new clickable entity types feels repetitive

## Possible Approach
Create a `PointerController` class that:
1. Receives all pointer events
2. Determines what was clicked (hit testing)
3. Applies priority rules if multiple targets
4. Dispatches appropriate command based on target type and modifier keys

```typescript
// Sketch - not final design
class PointerController {
  handlePointerDown(pointer: Phaser.Input.Pointer) {
    const target = this.getClickTarget(pointer);

    if (pointer.rightButtonDown() && this.selectionManager.hasSelection()) {
      if (target instanceof Enemy) {
        this.issueAttackCommand(target);
      } else if (target instanceof Treasure) {
        this.issueCollectCommand(target);
      } else {
        this.issueMoveCommand(pointer.worldX, pointer.worldY);
      }
    }
  }
}
```

## Current Status
Not needed yet. The distributed approach is working fine with the current scope.
