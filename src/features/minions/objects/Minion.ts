import Phaser from 'phaser';
import { TargetedMovement } from '../../../core/components/TargetedMovement';
import { Unit, Followable } from '../../../core/types/interfaces';

const MINION_RADIUS = 10;

export class Minion extends Phaser.Physics.Arcade.Sprite implements Unit {
  private selected = false;
  private selectionCircle?: Phaser.GameObjects.Graphics;
  private movement!: TargetedMovement; // Initialized after super()
  private arrivalCallback?: () => void;
  private followingTarget?: Followable;
  private followAngleOffset = 0; // Random angle for spreading around target

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '');

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Create visual (small green circle for MVP)
    const graphics = scene.add.graphics();
    graphics.fillStyle(0x50c878, 1); // Emerald green
    graphics.fillCircle(10, 10, 10); // Draw at center of texture
    graphics.generateTexture('minion', 20, 20);
    graphics.destroy();

    this.setTexture('minion');

    // Setup physics
    this.setCollideWorldBounds(true);

    // Setup movement component
    this.movement = new TargetedMovement(this, {
      speed: 120,
      arrivalDistance: 10,
      slowdownDistance: 80,
      minSpeedScale: 0.3
    });

    // Make interactive
    this.setInteractive({ useHandCursor: true });

    // Create selection indicator (invisible by default)
    this.selectionCircle = scene.add.graphics();
    this.selectionCircle.lineStyle(2, 0xffff00, 1); // Yellow outline
    this.selectionCircle.strokeCircle(0, 0, 14);
    this.selectionCircle.setVisible(false);
  }

  public select(): void {
    this.selected = true;
    this.selectionCircle?.setVisible(true);
  }

  public deselect(): void {
    this.selected = false;
    this.selectionCircle?.setVisible(false);
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public moveTo(x: number, y: number, onArrival?: () => void): void {
    this.followingTarget = undefined; // Clear any follow target
    this.arrivalCallback = onArrival;
    this.movement.moveTo(x, y);
  }

  public followTarget(target: Followable, onArrival: () => void): void {
    this.followingTarget = target;
    this.arrivalCallback = onArrival;
    // Pick a random angle to spread minions around the target perimeter
    this.followAngleOffset = Math.random() * Math.PI * 2;
    // Initial move toward target
    this.movement.moveTo(target.x, target.y);
  }

  public stopMoving(): void {
    this.followingTarget = undefined;
    this.movement.stop();
  }

  public getRadius(): number {
    return MINION_RADIUS;
  }

  update(): void {
    // Update selection circle position to follow minion
    if (this.selectionCircle) {
      this.selectionCircle.setPosition(this.x, this.y);
    }

    // If following a target, update destination and check edge-based arrival
    if (this.followingTarget) {
      // Calculate a point on the target's perimeter (spread minions around it)
      const perimeterDistance = this.followingTarget.getRadius() + MINION_RADIUS;
      const targetX = this.followingTarget.x + Math.cos(this.followAngleOffset) * perimeterDistance;
      const targetY = this.followingTarget.y + Math.sin(this.followAngleOffset) * perimeterDistance;

      // Update movement destination to perimeter point
      this.movement.moveTo(targetX, targetY);

      // Check edge-based arrival (touching the target)
      const distanceToTarget = Phaser.Math.Distance.Between(
        this.x, this.y,
        this.followingTarget.x, this.followingTarget.y
      );
      const touchDistance = MINION_RADIUS + this.followingTarget.getRadius();

      if (distanceToTarget <= touchDistance) {
        // Arrived at target edge
        this.movement.stop();
        const callback = this.arrivalCallback;
        this.arrivalCallback = undefined;
        this.followingTarget = undefined;
        if (callback) callback();
        return;
      }
    }

    // Update movement component (for regular moveTo)
    const arrived = this.movement.update();

    // Fire arrival callback if we just arrived (non-follow movement)
    if (arrived && this.arrivalCallback && !this.followingTarget) {
      const callback = this.arrivalCallback;
      this.arrivalCallback = undefined;
      callback();
    }
  }

  destroy(fromScene?: boolean): void {
    this.selectionCircle?.destroy();
    super.destroy(fromScene);
  }
}
