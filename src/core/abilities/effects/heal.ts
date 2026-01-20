import { EffectContext, EffectTarget, HealEffectParams, canBeHealed } from './types';
import { GameEvents, HealEvent } from '../../components/GameEventManager';
import { HealPulseWave } from '../../vfx';

/**
 * Heal effect - restores HP to targets with visual feedback.
 * Shows a healing pulse wave from executor, healing lines to targets, and floating text.
 */
export function healEffect(
  ctx: EffectContext,
  targets: EffectTarget[],
  params: HealEffectParams
): void {
  const { executor, scene } = ctx;
  const { power, showPulseWave = true, pulseRadius = 80 } = params;

  if (power <= 0) return;

  // Show pulse wave effect at executor location (only once per heal effect)
  if (showPulseWave && targets.length > 0) {
    const healPulse = new HealPulseWave(scene);
    healPulse.play(executor.x, executor.y, { endRadius: pulseRadius });
  }

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

  // Lifesteal uses simpler visuals (no big pulse wave)
  healEffect(ctx, targets, { power: healAmount, showPulseWave: false });
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
