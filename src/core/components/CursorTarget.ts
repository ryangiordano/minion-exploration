import Phaser from 'phaser';
import { Followable } from '../types/interfaces';

/**
 * A Followable that tracks the cursor position in world space.
 * Used as a target for minions to follow when whistled.
 */
export class CursorTarget implements Followable {
  private scene: Phaser.Scene;
  private _x: number = 0;
  private _y: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  getRadius(): number {
    // Small radius - minions gather close to cursor
    return 20;
  }

  /**
   * Call in update loop to track cursor position
   */
  update(): void {
    const pointer = this.scene.input.activePointer;
    this._x = pointer.worldX;
    this._y = pointer.worldY;
  }
}
