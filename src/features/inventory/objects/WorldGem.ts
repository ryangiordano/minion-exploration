import Phaser from 'phaser';
import { Followable } from '../../../core/types/interfaces';
import { getGemVisual } from '../data/GemConfig';

const GEM_RADIUS = 10;

/**
 * A collectible gem that exists in the game world.
 * Player walks over it to collect into inventory.
 */
export class WorldGem extends Phaser.GameObjects.Container implements Followable {
  private collected = false;
  private collectible = true;
  private gemId: string;

  constructor(scene: Phaser.Scene, x: number, y: number, gemId: string) {
    super(scene, x, y);

    this.gemId = gemId;
    scene.add.existing(this);

    // Create visual - colored circle based on gem type
    const visual = getGemVisual(gemId);
    const circle = scene.add.circle(0, 0, GEM_RADIUS, visual.color);
    circle.setStrokeStyle(2, 0xffffff);
    this.add(circle);

    // Make interactive
    this.setSize(GEM_RADIUS * 2, GEM_RADIUS * 2);
    this.setInteractive({ useHandCursor: true });
  }

  public getGemId(): string {
    return this.gemId;
  }

  public getRadius(): number {
    return GEM_RADIUS;
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

  /** Collect this gem, returns the gem ID */
  public collect(): string | null {
    if (this.collected) {
      return null;
    }

    this.collected = true;
    this.destroy();
    return this.gemId;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
