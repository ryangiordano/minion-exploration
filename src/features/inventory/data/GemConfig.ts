/**
 * Visual configuration for gem types
 */
export interface GemVisualConfig {
  id: string;
  color: number;
  name: string;
}

/**
 * Gem type visual definitions - maps gem IDs to their display colors
 */
export const GEM_VISUALS: Record<string, GemVisualConfig> = {
  vitality: { id: 'vitality', color: 0xff4444, name: 'Vitality' },        // Red
  stun: { id: 'stun', color: 0x44aaff, name: 'Stun' },                    // Blue
  poison: { id: 'poison', color: 0x44ff44, name: 'Poison' },              // Green
  ranged_attack: { id: 'ranged_attack', color: 0xaaffaa, name: 'Ranged' }, // Light Green
  heal_pulse: { id: 'heal_pulse', color: 0xffff44, name: 'Heal Pulse' },  // Yellow
  lifesteal: { id: 'lifesteal', color: 0xff44ff, name: 'Lifesteal' },     // Magenta
};

/** Default color for unknown gem types */
export const DEFAULT_GEM_COLOR = 0xaaaaaa;

/** Get visual config for a gem, with fallback */
export function getGemVisual(gemId: string): GemVisualConfig {
  return GEM_VISUALS[gemId] ?? { id: gemId, color: DEFAULT_GEM_COLOR, name: gemId };
}
