# Arc VFX Code Sharing

## The Idea

`HealArc` and `ArcProjectile` both use quadratic bezier curves for their arc paths. There's potential to extract shared arc math into a common utility.

## Current State

- **ArcProjectile**: Solid orb traveling along arc with trail particles
- **HealArc**: Line/beam that draws itself along arc path (fade or snake mode)

Both use the same bezier formula:
```typescript
// B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
const oneMinusT = 1 - t;
const x = oneMinusT * oneMinusT * p0x + 2 * oneMinusT * t * p1x + t * t * p2x;
const y = oneMinusT * oneMinusT * p0y + 2 * oneMinusT * t * p1y + t * t * p2y;
```

## Potential Shared Utilities

1. **BezierPath class** - Encapsulate bezier math, provide `getPointAt(t)`, `getPointsAlongPath(segments)`
2. **Arc height calculation** - Both scale height with distance
3. **Tween counter pattern** - Both use `addCounter` with 0→1 to animate progress

## When to Revisit

- When adding another arc-based VFX effect
- If we need more complex curves (cubic bezier, splines)
- During a general VFX cleanup pass

## Design Questions

- Is a shared `BezierPath` worth the abstraction, or is the math simple enough to duplicate?
- Should we also share the tween setup, or is that too coupled to each effect's specific needs?
