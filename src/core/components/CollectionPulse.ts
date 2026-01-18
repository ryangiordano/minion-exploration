import Phaser from 'phaser';
import { Collectible } from '../../features/level/systems/CollectionSystem';

export interface CollectionPulseConfig {
  /** Maximum radius the pulse can expand to */
  maxRadius?: number;
  /** Expansion rate in pixels per second */
  growRate?: number;
  /** Circle stroke color */
  color?: number;
  /** Circle stroke alpha */
  alpha?: number;
}

export interface PulseEmitter {
  x: number;
  y: number;
}

/**
 * Collection pulse - press key to emit expanding circles from emitters (minions),
 * collecting any items the circles touch as they expand outward.
 */
export class CollectionPulse {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private readonly maxRadius: number;
  private readonly growRate: number;
  private readonly color: number;
  private readonly alpha: number;

  private currentRadius = 0;
  private isPulsing = false;
  private key?: Phaser.Input.Keyboard.Key;

  private getEmitters?: () => PulseEmitter[];
  private getCollectibles?: () => Collectible[];
  private onCollectCallback?: (item: Collectible, emitter: PulseEmitter) => void;

  /** Track which items have been collected this pulse to avoid double-collection */
  private collectedThisPulse = new Set<Collectible>();

  constructor(scene: Phaser.Scene, config: CollectionPulseConfig = {}) {
    this.scene = scene;
    this.maxRadius = config.maxRadius ?? 150;
    this.growRate = config.growRate ?? 400;
    this.color = config.color ?? 0x88ccff;
    this.alpha = config.alpha ?? 0.6;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);
  }

  /** Bind to a keyboard key - triggers pulse on press */
  public bindKey(keyCode: number): this {
    if (this.scene.input.keyboard) {
      this.key = this.scene.input.keyboard.addKey(keyCode);

      this.key.on('down', () => {
        // Start a new pulse (reset radius to 0)
        this.isPulsing = true;
        this.currentRadius = 0;
        this.collectedThisPulse.clear();
      });
    }
    return this;
  }

  /** Set function to get pulse emitters (selected minions) */
  public setEmitterSource(getter: () => PulseEmitter[]): this {
    this.getEmitters = getter;
    return this;
  }

  /** Set function to get collectible items */
  public setCollectibleSource(getter: () => Collectible[]): this {
    this.getCollectibles = getter;
    return this;
  }

  /** Set callback when an item is collected by the pulse */
  public onCollect(callback: (item: Collectible, emitter: PulseEmitter) => void): this {
    this.onCollectCallback = callback;
    return this;
  }

  /** Update animation and check for collections - call in scene update() */
  public update(delta: number): void {
    const deltaSeconds = delta / 1000;

    if (this.isPulsing) {
      // Expand the pulse
      this.currentRadius = Math.min(
        this.currentRadius + this.growRate * deltaSeconds,
        this.maxRadius
      );
      this.checkCollections();

      // Stop pulsing when we reach max radius
      if (this.currentRadius >= this.maxRadius) {
        this.isPulsing = false;
        this.currentRadius = 0;
      }
    }

    // Draw circles
    this.drawCircles();
  }

  private drawCircles(): void {
    this.graphics.clear();

    if (this.currentRadius <= 0 || !this.isPulsing) return;

    const emitters = this.getEmitters?.() ?? [];
    if (emitters.length === 0) return;

    // Calculate progress (0 to 1)
    const progress = this.currentRadius / this.maxRadius;

    // Ease-in-out for visual radius (makes expansion feel smoother)
    const easedProgress = this.easeInOutQuad(progress);
    const visualRadius = easedProgress * this.maxRadius;

    // Fade out as it reaches max radius
    const fadeAlpha = this.alpha * (1 - progress);
    const fadeFill = 0.08 * (1 - progress);

    this.graphics.lineStyle(2, this.color, fadeAlpha);
    this.graphics.fillStyle(this.color, fadeFill);

    for (const emitter of emitters) {
      this.graphics.strokeCircle(emitter.x, emitter.y, visualRadius);
      this.graphics.fillCircle(emitter.x, emitter.y, visualRadius);
    }
  }

  /** Quadratic ease-in-out */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private checkCollections(): void {
    if (!this.getEmitters || !this.getCollectibles || !this.onCollectCallback) return;

    const emitters = this.getEmitters();
    const collectibles = this.getCollectibles();

    for (const item of collectibles) {
      // Skip already collected or non-collectible items
      if (item.isCollected() || !item.isCollectible()) continue;
      // Skip items we've already collected this pulse
      if (this.collectedThisPulse.has(item)) continue;

      // Check if any emitter's circle touches this item
      for (const emitter of emitters) {
        const distance = Phaser.Math.Distance.Between(
          emitter.x, emitter.y,
          item.x, item.y
        );

        if (distance <= this.currentRadius) {
          this.collectedThisPulse.add(item);
          this.onCollectCallback(item, emitter);
          break;
        }
      }
    }
  }

  public isExpanding(): boolean {
    return this.isPulsing;
  }

  public getCurrentRadius(): number {
    return this.currentRadius;
  }

  public destroy(): void {
    this.key?.destroy();
    this.graphics.destroy();
  }
}
