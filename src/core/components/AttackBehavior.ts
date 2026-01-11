import Phaser from 'phaser';
import { Combatable, AttackConfig } from '../types/interfaces';

export interface AttackBehaviorConfig {
  defaultAttack: AttackConfig;
}

export interface AttackUpdateContext {
  attackerX: number;
  attackerY: number;
  attackerRadius: number;
  effectiveAttack?: AttackConfig;  // Optional override for dynamic attack configs
}

export class AttackBehavior {
  private target?: Combatable;
  private cooldownTimer = 0;
  private readonly defaultAttack: AttackConfig;
  private onAttackCallback?: (target: Combatable, damage: number) => void;
  private onTargetDefeatedCallback?: (target: Combatable) => void;

  constructor(config: AttackBehaviorConfig) {
    this.defaultAttack = config.defaultAttack;
  }

  /**
   * Set a callback for when an attack lands (for visual feedback)
   */
  public onAttack(callback: (target: Combatable, damage: number) => void): void {
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

    // Check range if context provided
    if (context) {
      const distance = Phaser.Math.Distance.Between(
        context.attackerX, context.attackerY,
        this.target.x, this.target.y
      );
      const touchDistance = context.attackerRadius + this.target.getRadius();
      const attackRange = attack.range ?? 0;
      const maxAttackDistance = touchDistance + attackRange + 5; // +5 tolerance

      // Not in range yet - don't attack, just tick cooldown
      if (distance > maxAttackDistance) {
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

    target.takeDamage(attack.damage);
    this.onAttackCallback?.(target, attack.damage);

    // Check if we just killed the target (and we're still tracking it)
    if (this.target === target && target.isDefeated()) {
      this.disengage();
      this.onTargetDefeatedCallback?.(target);
    }
  }
}
