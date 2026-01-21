import { Combatable, AttackConfig } from '../types/interfaces';
import { isWithinAttackRange } from '../utils/distance';

export interface AttackBehaviorConfig {
  defaultAttack: AttackConfig;
}

export interface AttackUpdateContext {
  attackerX: number;
  attackerY: number;
  attackerRadius: number;
  effectiveAttack?: AttackConfig;  // Optional override for dynamic attack configs
  /** The attacker entity (for aggro notification on damage) */
  attacker?: Combatable;
}

/**
 * Context passed to attack callback
 */
export interface AttackCallbackContext {
  target: Combatable;
  damage: number;
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

export class AttackBehavior {
  private target?: Combatable;
  private cooldownTimer = 0;
  private readonly defaultAttack: AttackConfig;
  private onAttackCallback?: (context: AttackCallbackContext) => void;
  private onTargetDefeatedCallback?: (target: Combatable) => void;
  /** The entity performing attacks (for aggro notification) */
  private attacker?: Combatable;

  constructor(config: AttackBehaviorConfig) {
    this.defaultAttack = config.defaultAttack;
  }

  /**
   * Set a callback for when an attack is initiated (for visual feedback and ability hooks)
   */
  public onAttack(callback: (context: AttackCallbackContext) => void): void {
    this.onAttackCallback = callback;
  }

  /**
   * Set a callback for when target is defeated
   */
  public onTargetDefeated(callback: (target: Combatable) => void): void {
    this.onTargetDefeatedCallback = callback;
  }

  /**
   * Start attacking a target
   */
  public engage(target: Combatable): void {
    this.target = target;
    this.cooldownTimer = 0; // Attack immediately on first contact
  }

  /**
   * Stop attacking current target
   */
  public disengage(): void {
    this.target = undefined;
    this.cooldownTimer = 0;
  }

  /**
   * Check if currently engaged with a target
   */
  public isEngaged(): boolean {
    return this.target !== undefined && !this.target.isDefeated();
  }

  /**
   * Get current combat target
   */
  public getTarget(): Combatable | undefined {
    return this.target;
  }

  /**
   * Update the attack behavior - call every frame
   * @param delta - Time since last frame in ms
   * @param context - Position and attack config for range checking
   */
  public update(delta: number, context?: AttackUpdateContext): void {
    if (!this.target) return;

    // Check if target was defeated by someone else
    if (this.target.isDefeated()) {
      const defeatedTarget = this.target;
      this.disengage();
      this.onTargetDefeatedCallback?.(defeatedTarget);
      return;
    }

    // Use effective attack if provided, otherwise default
    const attack = context?.effectiveAttack ?? this.defaultAttack;

    // Store attacker reference for damage attribution
    if (context?.attacker) {
      this.attacker = context.attacker;
    }

    // Check range if context provided (uses edge-to-edge distance)
    if (context) {
      const attackRange = attack.range ?? 0;
      const inRange = isWithinAttackRange(
        context.attackerX,
        context.attackerY,
        context.attackerRadius,
        this.target.x,
        this.target.y,
        this.target.getRadius(),
        attackRange
      );

      // Not in range yet - don't attack, just tick cooldown
      if (!inRange) {
        this.cooldownTimer -= delta;
        return;
      }
    }

    // Update cooldown
    this.cooldownTimer -= delta;

    // Attack if cooldown is ready
    if (this.cooldownTimer <= 0) {
      this.performAttack(attack);
      this.cooldownTimer = attack.cooldownMs;
    }
  }

  private performAttack(attack: AttackConfig): void {
    if (!this.target) return;

    // Store reference before damage - target may trigger callbacks that clear this.target
    const target = this.target;
    const attacker = this.attacker;
    const isRanged = attack.effectType === 'ranged';

    if (isRanged) {
      // For ranged attacks, defer damage until projectile impact
      let damageDealt = false;
      const dealDamage = () => {
        if (damageDealt) return; // Prevent double damage
        damageDealt = true;

        // Check if target is still valid
        if (target.isDefeated()) return;

        target.takeDamage(attack.damage, attacker);

        // Check if we just killed the target
        if (target.isDefeated()) {
          if (this.target === target) {
            this.disengage();
          }
          this.onTargetDefeatedCallback?.(target);
        }
      };

      this.onAttackCallback?.({
        target,
        damage: attack.damage,
        dealDamage,
        damageDeferred: true,
      });
    } else {
      // For melee attacks, apply damage immediately
      target.takeDamage(attack.damage, attacker);

      this.onAttackCallback?.({
        target,
        damage: attack.damage,
        damageDeferred: false,
      });

      // Check if we just killed the target (and we're still tracking it)
      if (this.target === target && target.isDefeated()) {
        this.disengage();
        this.onTargetDefeatedCallback?.(target);
      }
    }
  }
}
