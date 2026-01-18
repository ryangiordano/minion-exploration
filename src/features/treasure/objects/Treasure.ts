import Phaser from 'phaser';
import { Followable } from '../../../core/types/interfaces';

/** Essence denomination tiers */
export type EssenceDenomination = 1 | 5 | 10;

/** Size configuration for each denomination */
const DENOMINATION_CONFIG: Record<EssenceDenomination, { size: number; particleSize: number }> = {
  1: { size: 10, particleSize: 2 },
  5: { size: 16, particleSize: 3 },
  10: { size: 24, particleSize: 4 },
};

const ESSENCE_COLOR = 0xffd700;
const ESSENCE_STROKE_COLOR = 0xb8860b;

export class Treasure extends Phaser.GameObjects.Container implements Followable {
  private collected = false;
  private collectible = true;
  private value: EssenceDenomination;
  private size: number;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, x: number, y: number, value: EssenceDenomination = 1) {
    super(scene, x, y);

    this.value = value;
    const config = DENOMINATION_CONFIG[value];
    this.size = config.size;

    // Add to scene
    scene.add.existing(this);

    // Create visual (gold essence square)
    const square = scene.add.rectangle(0, 0, this.size, this.size, ESSENCE_COLOR);
    square.setStrokeStyle(2, ESSENCE_STROKE_COLOR);
    this.add(square);

    // Create particle emitter for ambient effect
    this.createParticleEffect(config.particleSize);

    // Make interactive for click detection
    this.setSize(this.size, this.size);
    this.setInteractive({ useHandCursor: true });
  }

  private createParticleEffect(particleSize: number): void {
    // Create a small square texture for particles
    const textureKey = `essence_particle_${particleSize}`;
    if (!this.scene.textures.exists(textureKey)) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(ESSENCE_COLOR, 1);
      graphics.fillRect(0, 0, particleSize, particleSize);
      graphics.generateTexture(textureKey, particleSize, particleSize);
      graphics.destroy();
    }

    this.particles = this.scene.add.particles(0, 0, textureKey, {
      speed: { min: 10, max: 25 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 150,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.add(this.particles);
  }

  public getRadius(): number {
    return this.size / 2;
  }

  public isCollected(): boolean {
    return this.collected;
  }

  public isCollectible(): boolean {
    return this.collectible;
  }

  public setCollectible(value: boolean): void {
    this.collectible = value;
  }

  public getValue(): number {
    return this.value;
  }

  public collect(): number {
    if (this.collected) {
      return 0;
    }

    this.collected = true;
    this.particles?.stop();
    this.destroy();
    return this.value;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
