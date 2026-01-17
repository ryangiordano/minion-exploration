import Phaser from 'phaser';

export interface EdgeScrollIndicatorConfig {
  /** Width of edge zones that trigger indicators (should match EdgeScrollCamera) */
  edgeSize?: number;
  /** Color of the chevron indicators */
  color?: number;
  /** Alpha of the chevron indicators */
  alpha?: number;
  /** Size of each chevron */
  chevronSize?: number;
  /** Animation distance (how far the chevron moves) */
  animationDistance?: number;
  /** Animation duration in ms */
  animationDuration?: number;
}

const DEFAULT_EDGE_SIZE = 50;
const DEFAULT_COLOR = 0xffffff;
const DEFAULT_ALPHA = 0.6;
const DEFAULT_CHEVRON_SIZE = 12;
const DEFAULT_ANIMATION_DISTANCE = 8;
const DEFAULT_ANIMATION_DURATION = 600;

type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Visual indicator showing a single animated chevron when camera is edge-scrolling.
 * Works alongside EdgeScrollCamera to provide directional feedback.
 */
export class EdgeScrollIndicator {
  private scene: Phaser.Scene;
  private edgeSize: number;
  private color: number;
  private alpha: number;
  private chevronSize: number;
  private animationDistance: number;
  private animationDuration: number;

  private chevrons: Map<Direction, Phaser.GameObjects.Graphics> = new Map();
  private tweens: Map<Direction, Phaser.Tweens.Tween> = new Map();
  private offsets: Map<Direction, { value: number }> = new Map();
  private activeDirections: Set<Direction> = new Set();

  constructor(scene: Phaser.Scene, config: EdgeScrollIndicatorConfig = {}) {
    this.scene = scene;
    this.edgeSize = config.edgeSize ?? DEFAULT_EDGE_SIZE;
    this.color = config.color ?? DEFAULT_COLOR;
    this.alpha = config.alpha ?? DEFAULT_ALPHA;
    this.chevronSize = config.chevronSize ?? DEFAULT_CHEVRON_SIZE;
    this.animationDistance = config.animationDistance ?? DEFAULT_ANIMATION_DISTANCE;
    this.animationDuration = config.animationDuration ?? DEFAULT_ANIMATION_DURATION;

    this.createChevrons();
  }

  /** Create chevron graphics for each direction */
  private createChevrons(): void {
    const directions: Direction[] = ['left', 'right', 'up', 'down'];

    for (const direction of directions) {
      const graphics = this.scene.add.graphics();
      graphics.setScrollFactor(0);
      graphics.setDepth(1000);
      graphics.setVisible(false);

      this.chevrons.set(direction, graphics);
      this.offsets.set(direction, { value: 0 });
    }
  }

  /** Update indicators based on current scroll state */
  update(_delta: number, isScrollingLeft: boolean, isScrollingRight: boolean, isScrollingUp: boolean, isScrollingDown: boolean): void {
    this.updateDirection('left', isScrollingLeft);
    this.updateDirection('right', isScrollingRight);
    this.updateDirection('up', isScrollingUp);
    this.updateDirection('down', isScrollingDown);

    // Redraw active chevrons
    for (const direction of this.activeDirections) {
      this.drawChevron(direction);
    }
  }

  private updateDirection(direction: Direction, isActive: boolean): void {
    const wasActive = this.activeDirections.has(direction);

    if (isActive && !wasActive) {
      this.activeDirections.add(direction);
      this.showChevron(direction);
    } else if (!isActive && wasActive) {
      this.activeDirections.delete(direction);
      this.hideChevron(direction);
    }
  }

  private showChevron(direction: Direction): void {
    const graphics = this.chevrons.get(direction);
    if (!graphics) return;

    graphics.setVisible(true);
    graphics.setAlpha(0);

    // Fade in
    this.scene.tweens.add({
      targets: graphics,
      alpha: 1,
      duration: 150,
      ease: 'Sine.easeOut',
    });

    this.startAnimation(direction);
    this.drawChevron(direction);
  }

  private hideChevron(direction: Direction): void {
    const graphics = this.chevrons.get(direction);
    if (!graphics) return;

    this.stopAnimation(direction);

    // Fade out then hide
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      ease: 'Sine.easeIn',
      onComplete: () => {
        graphics.setVisible(false);
      },
    });
  }

  private startAnimation(direction: Direction): void {
    const offset = this.offsets.get(direction);
    if (!offset) return;

    // Stop any existing tween
    this.stopAnimation(direction);

    // Reset offset
    offset.value = 0;

    // Create looping tween
    const tween = this.scene.tweens.add({
      targets: offset,
      value: this.animationDistance,
      duration: this.animationDuration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this.tweens.set(direction, tween);
  }

  private stopAnimation(direction: Direction): void {
    const tween = this.tweens.get(direction);
    if (tween) {
      tween.stop();
      this.tweens.delete(direction);
    }

    const offset = this.offsets.get(direction);
    if (offset) {
      offset.value = 0;
    }
  }

  private drawChevron(direction: Direction): void {
    const graphics = this.chevrons.get(direction);
    const offset = this.offsets.get(direction);
    if (!graphics || !offset) return;

    const camera = this.scene.cameras.main;
    const viewWidth = camera.width;
    const viewHeight = camera.height;
    const edgeCenter = this.edgeSize / 2;

    graphics.clear();
    graphics.lineStyle(2, this.color, this.alpha);

    const pos = this.getChevronPosition(direction, viewWidth, viewHeight, edgeCenter, offset.value);
    this.drawChevronShape(graphics, pos.x, pos.y, this.chevronSize, direction);
  }

  private getChevronPosition(
    direction: Direction,
    viewWidth: number,
    viewHeight: number,
    edgeCenter: number,
    offset: number
  ): { x: number; y: number } {
    const centerX = viewWidth / 2;
    const centerY = viewHeight / 2;

    switch (direction) {
      case 'left':
        return { x: edgeCenter - offset, y: centerY };
      case 'right':
        return { x: viewWidth - edgeCenter + offset, y: centerY };
      case 'up':
        return { x: centerX, y: edgeCenter - offset };
      case 'down':
        return { x: centerX, y: viewHeight - edgeCenter + offset };
    }
  }

  private drawChevronShape(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, direction: Direction): void {
    const half = size / 2;

    g.beginPath();

    switch (direction) {
      case 'left':
        g.moveTo(x + half, y - half);
        g.lineTo(x - half, y);
        g.lineTo(x + half, y + half);
        break;
      case 'right':
        g.moveTo(x - half, y - half);
        g.lineTo(x + half, y);
        g.lineTo(x - half, y + half);
        break;
      case 'up':
        g.moveTo(x - half, y + half);
        g.lineTo(x, y - half);
        g.lineTo(x + half, y + half);
        break;
      case 'down':
        g.moveTo(x - half, y - half);
        g.lineTo(x, y + half);
        g.lineTo(x + half, y - half);
        break;
    }

    g.strokePath();
  }

  /** Clean up resources */
  destroy(): void {
    for (const tween of this.tweens.values()) {
      tween.stop();
    }
    this.tweens.clear();

    for (const graphics of this.chevrons.values()) {
      graphics.destroy();
    }
    this.chevrons.clear();
  }
}
