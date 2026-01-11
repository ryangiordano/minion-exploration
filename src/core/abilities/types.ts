import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../types/interfaces';

/**
 * Stat modifier applied by gems
 */
export interface StatModifier {
  stat: 'maxHp' | 'maxMp' | 'strength' | 'dexterity' | 'magic' | 'resilience';
  type: 'flat' | 'percent';
  value: number;
}

/**
 * Context passed to onAttackHit hook
 */
export interface AttackHitContext {
  attacker: GemOwner;
  target: Combatable;
  damage: number;
  scene: Phaser.Scene;
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

  // Scene access for effects
  getScene(): Phaser.Scene;

  // Finding allies (for abilities like heal)
  getNearbyAllies?(radius: number): GemOwner[];
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

  // Combat hooks
  onAttackHit?(context: AttackHitContext): void;
  onTakeDamage?(context: TakeDamageContext): void;

  // Update hook for abilities that tick (like auto-heal)
  onUpdate?(owner: GemOwner, delta: number): void;

  // Passive stat modifiers
  getStatModifiers?(): StatModifier[];

  // Attack modifiers (range, effectType, etc.)
  getAttackModifiers?(): Partial<AttackConfig>;
}
