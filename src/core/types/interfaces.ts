/**
 * Interface for entities that can be selected
 */
export interface Selectable {
  select(): void;
  deselect(): void;
  isSelected(): boolean;
}

/**
 * Interface for entities that can be followed/targeted
 */
export interface Followable {
  x: number;
  y: number;
  getRadius(): number;
}

/**
 * Interface for entities that can receive and execute commands
 */
export interface Commandable {
  moveTo(x: number, y: number, onArrival?: () => void): void;
  followTarget(target: Followable, onArrival?: () => void, persistent?: boolean): void;
}

/**
 * Combined interface for units that can be selected and commanded (like minions)
 */
export interface Unit extends Selectable, Commandable {}

/**
 * Configuration for an attack behavior
 */
export interface AttackConfig {
  damage: number;
  cooldownMs: number;
  effectType?: string;  // 'melee', 'ranged', etc. for visual feedback
}

/**
 * Interface for entities that have health and can take damage
 */
export interface Combatable extends Followable {
  getCurrentHp(): number;
  getMaxHp(): number;
  takeDamage(amount: number): void;
  isDefeated(): boolean;
}

/**
 * Interface for entities that can attack
 */
export interface Attacker {
  getPrimaryAttack(): AttackConfig;
}

/**
 * Interface for Combatables that can track and fight back against attackers
 */
export interface CombatableWithAttackers extends Combatable {
  addAttacker(attacker: Combatable): void;
  removeAttacker(attacker: Combatable): void;
}

/**
 * Interface for entities that can detect and track threats
 */
export interface AggroCapable {
  getAggroRadius(): number;
}
