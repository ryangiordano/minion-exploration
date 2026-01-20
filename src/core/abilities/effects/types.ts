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
  /** Whether to show the pulse wave effect at executor (default: true) */
  showPulseWave?: boolean;
  /** Radius for the pulse wave effect (default: 80) */
  pulseRadius?: number;
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

/** Visual style for projectile effects */
export type ProjectileVisualType = 'pellet' | 'laser' | 'bolt';

/** Muzzle flash configuration for projectile effects */
export interface MuzzleFlashParams {
  /** Color of the muzzle flash (defaults to projectile color) */
  color?: number;
  /** Maximum size of the flash */
  maxSize?: number;
  /** Duration of grow phase in ms */
  growDuration?: number;
  /** Duration of shrink phase in ms */
  shrinkDuration?: number;
}

/** Particle burst configuration for projectile effects */
export interface ImpactBurstParams {
  /** Number of particles */
  count?: number;
  /** Color of particles (defaults to projectile color) */
  color?: number;
  /** Speed range of particles */
  speedMin?: number;
  speedMax?: number;
}

/**
 * Projectile effect parameters
 */
export interface ProjectileEffectParams extends EffectParams {
  /** Speed in pixels per second */
  speed?: number;
  /** Projectile radius (for pellet type) */
  size?: number;
  /** Projectile color (hex) */
  color?: number;
  /** Callback when projectile reaches target */
  onImpact?: () => void;
  /** Visual style: 'pellet' (default) or 'laser' */
  visualType?: ProjectileVisualType;
  /** Muzzle flash config (set to enable muzzle flash) */
  muzzleFlash?: MuzzleFlashParams;
  /** Impact particle burst config (set to enable particles) */
  impactBurst?: ImpactBurstParams;
  /** Laser beam width (for laser type) */
  laserWidth?: number;
  /** Laser glow size (for laser type) */
  laserGlowSize?: number;
  /** Bolt length in pixels (for bolt type, default: 20) */
  boltLength?: number;
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
