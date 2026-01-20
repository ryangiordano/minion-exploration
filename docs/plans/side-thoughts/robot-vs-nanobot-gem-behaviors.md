# Robot vs Nanobot Gem Behaviors

## The Idea
Gems should behave differently based on whether they're equipped on the robot or a nanobot. The robot has momentum-based combat (rolling, dashing), while nanobots are autonomous units that auto-target.

## Proposed Behaviors

### Ranged Attack Gem
- **Robot**: Fires projectile in roll/facing direction on spacebar (alongside dash)
- **Nanobot**: Auto-fires at nearest enemy (current behavior)

### Heal Pulse Gem
- **Robot**: Big wave effect, heals all nearby allies for full value
- **Nanobot**: Heals allies but for very small amounts (decimal HP, like 0.2-0.5)
  - Prevents stacking heal pulse nanobots from being OP
  - Multiple nanobots with heal pulse contribute small trickle healing

### Lifesteal / Stun
- **Both**: Same behavior (triggered on hit)

### Vitality
- **Both**: Same passive stat boost

## Implementation Approach

**Option C: Gems define both behaviors, owner type determines which executes**

Could add to AbilityGem interface:
```typescript
interface AbilityGem {
  // Existing...

  // New: Robot-specific ability (triggered manually, e.g., on spacebar)
  getRobotAbility?(): RobotAbilityDefinition;
}
```

Or detect owner type in ActionResolver and apply modifiers:
```typescript
// In ActionResolver
const isRobot = owner instanceof Robot; // or check for a marker interface
if (isRobot && ability.robotModifiers) {
  // Apply robot-specific behavior
}
```

## Trigger Mechanism
- Robot abilities fire on **spacebar press** alongside dash
- Need to hook into Robot's dash input to also trigger equipped gem abilities

## Design Questions
- Should robot projectile require an enemy in range, or always fire?
- What's the right heal amount for nanobot heal pulse? (0.2? 0.5? percentage-based?)
- Should there be a visual difference for nanobot heals vs robot heals?

## When to Implement
After core gameplay loop is validated. This is polish/balance work.
