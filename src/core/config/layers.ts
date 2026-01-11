/**
 * Z-index depth layers for consistent rendering order
 * Higher values render on top of lower values
 */
export const LAYERS = {
  BACKGROUND: 0,
  GROUND: 10,
  ENTITIES: 20,
  EFFECTS: 30,
  UI_WORLD: 40,    // UI elements that exist in world space (HP bars, selection circles)
  UI_OVERLAY: 100, // UI fixed to camera (score, stamina bar)
} as const;
