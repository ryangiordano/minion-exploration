import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../types/interfaces';

/**
 * Stat modifier applied by gems
 */
export interface StatModifier {
  stat: 'maxHp' | 'maxMp' | 'strength' | 'dexterity' | 'magic' | 'resilience' | 'moveSpeed' | 'combatMoveSpeed';
  type: 'flat' | 'percent';
  value: number;
}

/**
 * Defines an active ability that can be triggered by the ActionResolver.
 * This is pure data - no behavior logic.
 */
export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;

  // Costs
  mpCost: number;
  cooldownMs: number;

  // Targeting
  targetType: 'self' | 'ally' | 'enemy' | 'area_allies' | 'area_enemies';
  range: number;

  // Effect
  effectType: 'heal' | 'damage' | 'buff' | 'debuff';
  basePower: number;
  scalingStat?: 'strength' | 'magic' | 'dexterity';
  scalingRatio?: number;  // How much stat contributes (e.g., 0.5 = +0.5 per stat point)

  // Auto-trigger conditions (for abilities that activate automatically)
  autoTrigger?: {
    condition: 'ally_wounded' | 'enemy_in_range' | 'self_wounded' | 'always';
    threshold?: number;  // e.g., 0.7 for "ally below 70% HP"
  };

  // Visual effect key (for effect system to dispatch)
  effectKey?: string;
}

/** Type of entity attacking */
export type AttackerType = 'robot' | 'nanobot';

/**
 * Context passed to onAttackHit hook
 */
export interface AttackHitContext {
  attacker: GemOwner;
  target: Combatable;
  damage: number;
  scene: Phaser.Scene;
  /** Type of attacker - allows gems to behave differently for robot vs nanobot */
  attackerType: AttackerType;
  /**
   * For ranged attacks, call this to apply damage on projectile impact.
   * For melee attacks, damage is already applied and this is undefined.
   */
  dealDamage?: () => void;
  /**
   * Whether damage has been deferred (ranged) or already applied (melee).
   */
  damageDeferred: boolean;
}

/**
 * Context passed to onTakeDamage hook
 */
export interface TakeDamageContext {
  defender: GemOwner;
  attacker: Combatable | null;  // null if damage source unknown
  damage: number;
  scene: Phaser.Scene;
}

/**
 * Interface for entities that can equip ability gems
 */
export interface GemOwner {
  // Position
  x: number;
  y: number;
  getRadius(): number;

  // Resources
  getCurrentHp(): number;
  getMaxHp(): number;
  getCurrentMp(): number;
  getMaxMp(): number;
  spendMp(amount: number): boolean;
  heal(amount: number): void;

  // Stats for ability scaling
  getStat?(stat: 'strength' | 'magic' | 'dexterity'): number;

  // Scene access for effects
  getScene(): Phaser.Scene;

  // Finding allies/enemies (for abilities)
  getNearbyAllies?(radius: number): GemOwner[];
  getNearbyEnemies?(radius: number): Combatable[];
}

/**
 * An ability gem that can be equipped in a slot
 */
export interface AbilityGem {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  // Lifecycle hooks - gems implement what they need
  onEquip?(owner: GemOwner): void;
  onUnequip?(owner: GemOwner): void;

  // Combat hooks (effects triggered by attacks)
  onAttackHit?(context: AttackHitContext): void;
  onTakeDamage?(context: TakeDamageContext): void;

  // Active ability definition (executed by ActionResolver)
  getAbility?(): AbilityDefinition;

  // Passive stat modifiers
  getStatModifiers?(): StatModifier[];

  // Attack modifiers (range, effectType, etc.)
  getAttackModifiers?(): Partial<AttackConfig>;

  // Cooldown info for UI display (for gems with manual cooldown tracking)
  getCooldownInfo?(): CooldownInfo | null;

  // DEPRECATED: Use getAbility() instead. Will be removed.
  // Only kept for backwards compatibility during migration.
  onUpdate?(owner: GemOwner, delta: number): void;
}

/**
 * Cooldown info for UI display
 */
export interface CooldownInfo {
  /** Time remaining in ms (0 = ready) */
  remaining: number;
  /** Total cooldown duration in ms */
  total: number;
}
