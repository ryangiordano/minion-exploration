import Phaser from 'phaser';
import { EffectContext, EffectTarget, ProjectileEffectParams } from './types';

const DEFAULT_PROJECTILE_SPEED = 300;
const DEFAULT_PROJECTILE_SIZE = 4;
const DEFAULT_PROJECTILE_COLOR = 0x88ccff;

/**
 * Projectile effect - fires a visual projectile from executor to target.
 * The projectile travels with animation and creates an impact effect.
 */
export function projectileEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: ProjectileEffectParams = {}
): void {
  const { executor, scene } = ctx;
  const {
    speed = DEFAULT_PROJECTILE_SPEED,
    size = DEFAULT_PROJECTILE_SIZE,
    color = DEFAULT_PROJECTILE_COLOR,
    onImpact,
  } = params;

  for (const target of targets) {
    // Create projectile visual
    const projectile = scene.add.circle(
      executor.x,
      executor.y,
      size,
      color
    );
    projectile.setAlpha(0.9);

    // Calculate travel time based on distance and speed
    const distance = Phaser.Math.Distance.Between(
      executor.x,
      executor.y,
      target.x,
      target.y
    );
    const duration = (distance / speed) * 1000;

    // Animate projectile to target
    scene.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: Math.max(50, duration), // Minimum 50ms
      ease: 'Linear',
      onComplete: () => {
        showImpactEffect(scene, target.x, target.y, size, color);
        projectile.destroy();
        onImpact?.();
      },
    });
  }
}

/**
 * Show impact burst at position
 */
function showImpactEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color: number
): void {
  const impact = scene.add.circle(x, y, size * 2, color, 0.8);

  scene.tweens.add({
    targets: impact,
    scale: 2,
    alpha: 0,
    duration: 150,
    ease: 'Power2',
    onComplete: () => impact.destroy(),
  });
}
