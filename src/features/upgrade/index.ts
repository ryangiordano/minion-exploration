// Import gems for registration FIRST (before exports to ensure side effects run)
import { GemRegistry } from './data/GemRegistry';
import { VitalityGem } from '../../core/abilities/gems/VitalityGem';
import { StunGem } from '../../core/abilities/gems/StunGem';
import { PoisonGem } from '../../core/abilities/gems/PoisonGem';
import { RangedAttackGem } from '../../core/abilities/gems/RangedAttackGem';
import { HealPulseGem } from '../../core/abilities/gems/HealPulseGem';
import { LifestealGem } from '../../core/abilities/gems/LifestealGem';

// Register all available gems with their costs
GemRegistry.register({
  id: 'vitality',
  name: 'Vitality Gem',
  description: '+2 Max HP',
  essenceCost: 15,
  gemType: 'passive',
  createGem: () => new VitalityGem(),
});

GemRegistry.register({
  id: 'stun',
  name: 'Stun Gem',
  description: '25% chance to stun enemies',
  essenceCost: 20,
  gemType: 'passive',
  createGem: () => new StunGem(),
});

GemRegistry.register({
  id: 'poison',
  name: 'Poison Gem',
  description: '35% chance to poison enemies (2 dmg/tick for 3s)',
  essenceCost: 25,
  gemType: 'passive',
  createGem: () => new PoisonGem(),
});

GemRegistry.register({
  id: 'ranged_attack',
  name: 'Ranged Attack Gem',
  description: 'Attack from distance with projectiles',
  essenceCost: 30,
  gemType: 'passive',
  createGem: () => new RangedAttackGem(),
});

GemRegistry.register({
  id: 'heal_pulse',
  name: 'Heal Pulse Gem',
  description: 'Auto-heals nearby wounded allies',
  essenceCost: 35,
  gemType: 'active',
  createGem: () => new HealPulseGem(),
});

GemRegistry.register({
  id: 'lifesteal',
  name: 'Lifesteal Gem',
  description: 'Heal when dealing damage',
  essenceCost: 40,
  gemType: 'passive',
  createGem: () => new LifestealGem(),
});

// Export public API
export { GemRegistry } from './data/GemRegistry';
export type { GemRegistryEntry } from './data/GemRegistry';
export { GemCard } from './ui/GemCard';
