import Phaser from 'phaser';
import { EffectContext, EffectTarget, ProjectileEffectParams } from './types';
import { MuzzleFlash } from '../../vfx/MuzzleFlash';
import { LaserBeam } from '../../vfx/LaserBeam';
import { ParticleBurst } from '../../vfx/ParticleBurst';

const DEFAULT_PROJECTILE_SPEED = 300;
const DEFAULT_PROJECTILE_SIZE = 4;
const DEFAULT_PROJECTILE_COLOR = 0x88ccff;

/**
 * Projectile effect - fires a visual projectile from executor to target.
 * Supports different visual styles: pellet (traveling circle) or laser (instant beam).
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
    visualType = 'pellet',
    muzzleFlash,
    impactBurst,
    laserWidth = 3,
    laserGlowSize = 6,
  } = params;

  // Show muzzle flash if configured
  if (muzzleFlash) {
    const muzzle = new MuzzleFlash(scene);
    muzzle.play(executor.x, executor.y, muzzleFlash.color ?? color, {
      maxSize: muzzleFlash.maxSize,
      growDuration: muzzleFlash.growDuration,
      shrinkDuration: muzzleFlash.shrinkDuration,
    });
  }

  for (const target of targets) {
    if (visualType === 'laser') {
      // Instant laser beam
      const laser = new LaserBeam(scene);
      laser.play(executor.x, executor.y, target.x, target.y, color, {
        width: laserWidth,
        glowSize: laserGlowSize,
      });

      // Show impact effects
      showImpactEffects(scene, target.x, target.y, size, color, impactBurst);

      // Call onImpact immediately for laser (instant hit)
      onImpact?.();
    } else {
      // Pellet projectile (traveling circle)
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
        duration: Math.max(50, duration),
        ease: 'Linear',
        onComplete: () => {
          showImpactEffects(scene, target.x, target.y, size, color, impactBurst);
          projectile.destroy();
          onImpact?.();
        },
      });
    }
  }
}

/**
 * Show impact effects at position
 */
function showImpactEffects(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color: number,
  burstConfig?: ProjectileEffectParams['impactBurst']
): void {
  if (burstConfig) {
    // Use particle burst if configured
    const burst = new ParticleBurst(scene);
    burst.play(x, y, burstConfig.color ?? color, {
      count: burstConfig.count ?? 6,
      size: size * 0.8,
      distance: 20,
      duration: 200,
      randomizeDistance: true,
    });
  } else {
    // Default expanding circle impact
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
}
