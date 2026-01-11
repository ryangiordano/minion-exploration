import Phaser from 'phaser';
import { AbilityGem, AttackHitContext } from '../types';

/**
 * Attack modifier gem that pushes enemies back on hit
 */
export class KnockbackGem implements AbilityGem {
  readonly id = 'knockback';
  readonly name = 'Knockback Gem';
  readonly description = 'Attacks push enemies back';

  private readonly knockbackDistance: number;
  private readonly knockbackDuration: number;

  constructor(knockbackDistance: number = 30, knockbackDuration: number = 100) {
    this.knockbackDistance = knockbackDistance;
    this.knockbackDuration = knockbackDuration;
  }

  onAttackHit(context: AttackHitContext): void {
    const { attacker, target, scene } = context;

    // Calculate knockback direction (away from attacker)
    const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
    const newX = target.x + Math.cos(angle) * this.knockbackDistance;
    const newY = target.y + Math.sin(angle) * this.knockbackDistance;

    // Animate the knockback
    scene.tweens.add({
      targets: target,
      x: newX,
      y: newY,
      duration: this.knockbackDuration,
      ease: 'Power2'
    });
  }
}
