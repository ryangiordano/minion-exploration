import { EffectContext, EffectTarget, HealEffectParams, canBeHealed } from './types';
import { GameEvents, HealEvent } from '../../components/GameEventManager';

/**
 * Heal effect - restores HP to targets with visual feedback.
 * Shows a healing line from executor to target, burst effect, and floating text.
 */
export function healEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: HealEffectParams
): void {
  const { executor, scene } = ctx;
  const { power } = params;

  if (power <= 0) return;

  for (const target of targets) {
    if (!canBeHealed(target)) continue;

    // Apply heal
    target.heal(power);

    // Visual: healing line from executor to target
    showHealLine(scene, executor.x, executor.y, target.x, target.y);

    // Visual: burst at target
    showHealBurst(scene, target.x, target.y);

    // Emit event for floating text
    scene.events.emit(GameEvents.HEAL, {
      x: target.x,
      y: target.y,
      amount: power,
    } as HealEvent);
  }
}

/**
 * Lifesteal effect - heals based on damage dealt.
 * Heals the executor and optionally nearby allies.
 */
export function lifestealEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: { ratio: number }
): void {
  const { triggerDamage } = ctx;
  if (!triggerDamage || triggerDamage <= 0) return;

  // Always heal at least 1 if any damage was dealt
  const healAmount = Math.max(1, Math.floor(triggerDamage * params.ratio));

  healEffect(ctx, targets, { power: healAmount });
}

/**
 * Show a healing line from source to target
 */
function showHealLine(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  const line = scene.add.graphics();
  line.lineStyle(2, 0x00ff88, 0.8);
  line.lineBetween(fromX, fromY, toX, toY);

  scene.tweens.add({
    targets: line,
    alpha: 0,
    duration: 300,
    onComplete: () => line.destroy(),
  });
}

/**
 * Show a healing burst at a position
 */
function showHealBurst(scene: Phaser.Scene, x: number, y: number): void {
  const burst = scene.add.circle(x, y, 8, 0x00ff88, 0.6);

  scene.tweens.add({
    targets: burst,
    scale: 2,
    alpha: 0,
    duration: 300,
    onComplete: () => burst.destroy(),
  });
}
