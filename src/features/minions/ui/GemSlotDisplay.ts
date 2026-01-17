import Phaser from 'phaser';
import { AbilityGem } from '../../../core/abilities/types';
import { getGemVisual } from '../../inventory';

const GEM_CIRCLE_RADIUS = 6;
const GEM_SPACING = 4;
const OFFSET_Y = 35; // Below the minion sprite

/**
 * Visual display of equipped gems as small colored circles below a minion.
 */
export class GemSlotDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private gemCircles: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
  }

  /** Update position and display gems */
  public update(x: number, y: number, equippedGems: AbilityGem[]): void {
    // Position container below the minion
    this.container.setPosition(x, y + OFFSET_Y);

    // Rebuild circles if gem count changed
    if (this.gemCircles.length !== equippedGems.length) {
      this.rebuildCircles(equippedGems);
    } else {
      // Just update colors in case gems changed
      equippedGems.forEach((gem, i) => {
        const visual = getGemVisual(gem.id);
        this.gemCircles[i].setFillStyle(visual.color);
      });
    }
  }

  private rebuildCircles(gems: AbilityGem[]): void {
    // Clear existing
    this.gemCircles.forEach(c => c.destroy());
    this.gemCircles = [];

    if (gems.length === 0) return;

    // Calculate total width to center the row
    const totalWidth = gems.length * (GEM_CIRCLE_RADIUS * 2) + (gems.length - 1) * GEM_SPACING;
    const startX = -totalWidth / 2 + GEM_CIRCLE_RADIUS;

    gems.forEach((gem, i) => {
      const visual = getGemVisual(gem.id);
      const circleX = startX + i * (GEM_CIRCLE_RADIUS * 2 + GEM_SPACING);

      const circle = this.scene.add.circle(circleX, 0, GEM_CIRCLE_RADIUS, visual.color);
      circle.setStrokeStyle(1, 0xffffff, 0.8);

      this.container.add(circle);
      this.gemCircles.push(circle);
    });
  }

  public destroy(): void {
    this.gemCircles.forEach(c => c.destroy());
    this.container.destroy();
  }
}
