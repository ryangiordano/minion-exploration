// Types
export type {
  AbilityGem,
  AbilityDefinition,
  GemOwner,
  StatModifier,
  AttackHitContext,
  TakeDamageContext
} from './types';

// Components
export { AbilitySystem, type AbilitySystemConfig } from './AbilitySystem';
export { ActionResolver, type ActionResolverContext } from './ActionResolver';

// Gems
export {
  VitalityGem,
  KnockbackGem,
  HealPulseGem,
  RangedAttackGem,
  LifestealGem,
  type HealPulseConfig,
  type RangedAttackConfig,
  type LifestealConfig
} from './gems';

// Effects
export {
  healEffect,
  lifestealEffect,
  knockbackEffect,
  pullEffect,
  projectileEffect,
  type EffectContext,
  type EffectTarget,
  type HealEffectParams,
  type KnockbackEffectParams,
  type ProjectileEffectParams,
} from './effects';
