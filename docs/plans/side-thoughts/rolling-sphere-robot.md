# Rolling Sphere Robot

## The Idea
Replace the blocky robot player sprite with a spherical robot that visually rolls as it moves.

## Visual Concept
- Sphere with a face texture/drawing on it
- As the robot moves, the face scrolls in the **opposite direction** of movement:
  - Move up → face scrolls down (toward bottom of sphere)
  - Move down → face scrolls up
  - Move left → face scrolls right
  - Move right → face scrolls left
- Face is masked to the sphere boundary, creating the illusion of a 3D rolling ball
- Support 8 directions (cardinal + diagonal)

## Implementation Approach

### Option A: UV Offset / Texture Scrolling
- Draw face on a texture larger than the visible sphere
- Mask to circular boundary
- Offset the texture position based on movement direction and distance
- Wrap the offset to create continuous rolling

### Option B: Rotating Face Container
- Face elements in a container
- Container position offset based on movement
- Circular mask clips to sphere boundary
- When face element exits one side, reposition to opposite side (seamless loop)

## Technical Considerations
- 8-direction movement means smooth diagonal scrolling needed
- Scroll speed should feel proportional to movement speed
- May want slight "momentum" on the face movement for juice
- Face needs to be simple initially (eyes, maybe mouth) - will be replaced with proper sprite later

## Design Questions
- Should the face have expressions that change with game state? (damage, idle, attacking)
- How does this interact with the nanobot swarm visually?
- Should the sphere have any other surface details (panel lines, lights)?

## When to Revisit
After core nanobot mechanics are feeling good and we want to polish player character visuals.
