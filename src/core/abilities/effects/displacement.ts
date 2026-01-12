import Phaser from 'phaser';
import { EffectContext, EffectTarget, KnockbackEffectParams } from './types';

/**
 * Knockback effect - pushes targets away from the executor.
 * Animates targets to a new position using Phaser tweens.
 */
export function knockbackEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: KnockbackEffectParams
): void {
  const { executor, scene } = ctx;
  const { distance, duration = 100 } = params;

  for (const target of targets) {
    // Calculate knockback direction (away from executor)
    const angle = Phaser.Math.Angle.Between(
      executor.x,
      executor.y,
      target.x,
      target.y
    );

    const newX = target.x + Math.cos(angle) * distance;
    const newY = target.y + Math.sin(angle) * distance;

    // Animate the knockback
    scene.tweens.add({
      targets: target,
      x: newX,
      y: newY,
      duration,
      ease: 'Power2',
    });
  }
}

/**
 * Pull effect - pulls targets toward the executor.
 * Opposite of knockback.
 */
export function pullEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: KnockbackEffectParams
): void {
  const { executor, scene } = ctx;
  const { distance, duration = 100 } = params;

  for (const target of targets) {
    // Calculate pull direction (toward executor)
    const angle = Phaser.Math.Angle.Between(
      target.x,
      target.y,
      executor.x,
      executor.y
    );

    const newX = target.x + Math.cos(angle) * distance;
    const newY = target.y + Math.sin(angle) * distance;

    scene.tweens.add({
      targets: target,
      x: newX,
      y: newY,
      duration,
      ease: 'Power2',
    });
  }
}
