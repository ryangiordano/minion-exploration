// Import gems for registration FIRST (before exports to ensure side effects run)
import { GemRegistry } from './data/GemRegistry';
import { VitalityGem } from '../../core/abilities/gems/VitalityGem';
import { KnockbackGem } from '../../core/abilities/gems/KnockbackGem';
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
  id: 'knockback',
  name: 'Knockback Gem',
  description: 'Push enemies back on hit',
  essenceCost: 20,
  gemType: 'passive',
  createGem: () => new KnockbackGem(),
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
export { UpgradeMenu } from './ui/UpgradeMenu';
