import { Combatable, AttackConfig } from '../types/interfaces';

export interface AttackBehaviorConfig {
  defaultAttack: AttackConfig;
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
   */
  public update(delta: number): void {
    if (!this.target) return;

    // Check if target was defeated by someone else
    if (this.target.isDefeated()) {
      const defeatedTarget = this.target;
      this.disengage();
      this.onTargetDefeatedCallback?.(defeatedTarget);
      return;
    }

    // Update cooldown
    this.cooldownTimer -= delta;

    // Attack if cooldown is ready
    if (this.cooldownTimer <= 0) {
      this.performAttack(this.defaultAttack);
      this.cooldownTimer = this.defaultAttack.cooldownMs;
    }
  }

  private performAttack(attack: AttackConfig): void {
    if (!this.target) return;

    this.target.takeDamage(attack.damage);
    this.onAttackCallback?.(this.target, attack.damage);

    // Check if we just killed the target
    if (this.target.isDefeated()) {
      const defeatedTarget = this.target;
      this.disengage();
      this.onTargetDefeatedCallback?.(defeatedTarget);
    }
  }
}
