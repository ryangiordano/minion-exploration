import Phaser from 'phaser';
import { ParticleBurst } from './ParticleBurst';
import { FloatingText } from './FloatingText';
import { ArcProjectile } from './ArcProjectile';
import { ClickIndicator } from './ClickIndicator';

/**
 * Convenience class that bundles all VFX primitives.
 * Create one per scene and access effects via properties.
 */
export class Vfx {
  readonly burst: ParticleBurst;
  readonly text: FloatingText;
  readonly arc: ArcProjectile;
  readonly click: ClickIndicator;

  constructor(scene: Phaser.Scene) {
    this.burst = new ParticleBurst(scene);
    this.text = new FloatingText(scene);
    this.arc = new ArcProjectile(scene);
    this.click = new ClickIndicator(scene);
  }
}
