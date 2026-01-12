import Phaser from 'phaser';
import { GemOwner } from '../types';
import { Combatable } from '../../types/interfaces';

/**
 * Context passed to all effect functions.
 * Effects receive everything they need to execute and render.
 */
export interface EffectContext {
  /** The entity executing/triggering the effect */
  executor: GemOwner;
  /** The scene for rendering visuals */
  scene: Phaser.Scene;
  /** Damage that triggered this effect (for lifesteal, on-hit effects) */
  triggerDamage?: number;
}

/**
 * Parameters common to all effects.
 * Individual effects extend this with their specific params.
 */
export interface EffectParams {
  /** Effect strength/magnitude (interpretation varies by effect type) */
  power?: number;
}

/**
 * Heal effect parameters
 */
export interface HealEffectParams extends EffectParams {
  /** Amount to heal (required for heal effects) */
  power: number;
}

/**
 * Knockback effect parameters
 */
export interface KnockbackEffectParams extends EffectParams {
  /** Distance to push targets */
  distance: number;
  /** Animation duration in ms */
  duration?: number;
}

/**
 * Projectile effect parameters
 */
export interface ProjectileEffectParams extends EffectParams {
  /** Speed in pixels per second */
  speed?: number;
  /** Projectile radius */
  size?: number;
  /** Projectile color (hex) */
  color?: number;
  /** Callback when projectile reaches target */
  onImpact?: () => void;
}

/**
 * A target that can receive effects.
 * Can be a GemOwner (allies with full interface) or Combatable (enemies).
 */
export type EffectTarget = GemOwner | Combatable;

/**
 * Type guard to check if target can be healed
 */
export function canBeHealed(target: EffectTarget): target is GemOwner {
  return 'heal' in target && typeof (target as GemOwner).heal === 'function';
}

/**
 * Type guard to check if target can take damage
 */
export function canTakeDamage(target: EffectTarget): target is Combatable {
  return 'takeDamage' in target && typeof target.takeDamage === 'function';
}
