import Phaser from 'phaser';
import { Selectable } from '../types/interfaces';

export interface WhistleSelectionConfig {
  maxRadius?: number;
  growRate?: number;    // pixels per second
  shrinkRate?: number;  // pixels per second
  color?: number;
}

/**
 * Whistle selection component - hold to grow radius, release to select units
 */
export class WhistleSelection {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private readonly maxRadius: number;
  private readonly growRate: number;
  private readonly shrinkRate: number;
  private readonly color: number;

  private currentRadius = 0;
  private isActive = false;
  private key?: Phaser.Input.Keyboard.Key;

  private onSelectCallback?: (units: Selectable[]) => void;
  private getSelectableUnits?: () => Selectable[];

  constructor(scene: Phaser.Scene, config: WhistleSelectionConfig = {}) {
    this.scene = scene;
    this.maxRadius = config.maxRadius ?? 100;
    this.growRate = config.growRate ?? 300;
    this.shrinkRate = config.shrinkRate ?? 600;
    this.color = config.color ?? 0xffff00;

    this.graphics = scene.add.graphics();
    this.graphics.setVisible(false);
  }

  /**
   * Bind to a keyboard key
   */
  public bindKey(keyCode: number): this {
    if (this.scene.input.keyboard) {
      this.key = this.scene.input.keyboard.addKey(keyCode);

      this.key.on('down', () => {
        this.isActive = true;
        this.graphics.setVisible(true);
      });

      this.key.on('up', () => {
        this.isActive = false;
        this.triggerSelection();
      });
    }
    return this;
  }

  /**
   * Set callback for when selection happens
   */
  public onSelect(callback: (units: Selectable[]) => void): this {
    this.onSelectCallback = callback;
    return this;
  }

  /**
   * Set function to get selectable units (called on selection)
   */
  public setSelectableSource(getter: () => Selectable[]): this {
    this.getSelectableUnits = getter;
    return this;
  }

  /**
   * Update animation - call in scene update()
   */
  public update(delta: number): void {
    const deltaSeconds = delta / 1000;

    if (this.isActive) {
      // Grow while held
      this.currentRadius = Math.min(
        this.currentRadius + this.growRate * deltaSeconds,
        this.maxRadius
      );
    } else if (this.currentRadius > 0) {
      // Shrink when released
      this.currentRadius = Math.max(
        this.currentRadius - this.shrinkRate * deltaSeconds,
        0
      );

      if (this.currentRadius <= 0) {
        this.graphics.setVisible(false);
      }
    }

    // Update visual
    if (this.currentRadius > 0) {
      this.drawCircle();
    }
  }

  private drawCircle(): void {
    const pointer = this.scene.input.activePointer;
    this.graphics.clear();
    this.graphics.lineStyle(3, this.color, 0.8);
    this.graphics.strokeCircle(pointer.worldX, pointer.worldY, this.currentRadius);
    this.graphics.fillStyle(this.color, 0.1);
    this.graphics.fillCircle(pointer.worldX, pointer.worldY, this.currentRadius);
  }

  private triggerSelection(): void {
    if (!this.getSelectableUnits || !this.onSelectCallback) return;

    const pointer = this.scene.input.activePointer;
    const units = this.getSelectableUnits();

    const unitsInRadius = units.filter(unit => {
      const distance = Phaser.Math.Distance.Between(
        pointer.worldX, pointer.worldY,
        (unit as unknown as Phaser.GameObjects.Components.Transform).x,
        (unit as unknown as Phaser.GameObjects.Components.Transform).y
      );
      return distance <= this.currentRadius;
    });

    this.onSelectCallback(unitsInRadius);
  }

  public destroy(): void {
    this.key?.destroy();
    this.graphics.destroy();
  }
}
