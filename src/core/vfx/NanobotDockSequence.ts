import Phaser from 'phaser';

/** Configuration for nanobot docking animation */
export interface NanobotDockConfig {
  /** Distance from robot center when docked */
  dockRadius?: number;
}

const DEFAULT_CONFIG: Required<NanobotDockConfig> = {
  dockRadius: 35,
};

/** Represents a nanobot that can be animated */
export interface DockableNanobot {
  x: number;
  y: number;
  setPosition(x: number, y: number): void;
}

/** Stored starting position for a nanobot during docking */
interface DockStartPosition {
  x: number;
  y: number;
}

/**
 * Handles the nanobot spiral-dock animation for launch sequence.
 * Nanobots spiral inward and snap to evenly-spaced positions around the robot.
 */
export class NanobotDockSequence {
  private scene: Phaser.Scene;
  private config: Required<NanobotDockConfig>;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private startPositions = new WeakMap<object, DockStartPosition>();

  constructor(scene: Phaser.Scene, config: NanobotDockConfig = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the docking sequence - nanobots spiral toward target.
   * Progress is controlled externally via updateProgress().
   */
  startDocking(
    nanobots: DockableNanobot[],
    targetX: number,
    targetY: number,
    progress: number
  ): void {
    this.updateDocking(nanobots, targetX, targetY, progress);
  }

  /**
   * Update nanobot positions based on charge progress (0-1).
   * At 0: nanobots at their current positions
   * At 1: nanobots snapped to dock positions around robot
   */
  updateDocking(
    nanobots: DockableNanobot[],
    targetX: number,
    targetY: number,
    progress: number
  ): void {
    const count = nanobots.length;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const nanobot = nanobots[i];

      // Calculate dock position (evenly spaced around robot)
      const dockAngle = (i / count) * Math.PI * 2 - Math.PI / 2; // Start at top
      const dockX = targetX + Math.cos(dockAngle) * this.config.dockRadius;
      const dockY = targetY + Math.sin(dockAngle) * this.config.dockRadius;

      // Get starting position (stored on first call, or use current)
      if (!this.startPositions.has(nanobot)) {
        this.startPositions.set(nanobot, { x: nanobot.x, y: nanobot.y });
      }
      const start = this.startPositions.get(nanobot)!;

      // Direct linear interpolation between start and dock position
      const x = Phaser.Math.Linear(start.x, dockX, progress);
      const y = Phaser.Math.Linear(start.y, dockY, progress);

      nanobot.setPosition(x, y);
    }
  }

  /**
   * Reset nanobots to their original positions (when charge released).
   * Animates them back smoothly.
   */
  releaseDocking(nanobots: DockableNanobot[], duration = 300): void {
    // Stop any active tweens
    this.stopAllTweens();

    for (const nanobot of nanobots) {
      const start = this.startPositions.get(nanobot);

      if (start) {
        // Animate back to original position
        const tween = this.scene.tweens.add({
          targets: nanobot,
          x: start.x,
          y: start.y,
          duration,
          ease: 'Power2.easeOut',
        });
        this.activeTweens.push(tween);
      }
    }
  }

  /**
   * Clear stored starting positions (call when docking completes or cancels).
   */
  clearDockingState(nanobots: DockableNanobot[]): void {
    for (const nanobot of nanobots) {
      this.startPositions.delete(nanobot);
    }
  }

  /**
   * Snap nanobots to final docked positions (call when fully charged).
   */
  snapToDocked(
    nanobots: DockableNanobot[],
    targetX: number,
    targetY: number
  ): void {
    const count = nanobots.length;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const nanobot = nanobots[i];
      const dockAngle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const dockX = targetX + Math.cos(dockAngle) * this.config.dockRadius;
      const dockY = targetY + Math.sin(dockAngle) * this.config.dockRadius;
      nanobot.setPosition(dockX, dockY);
    }
  }

  private stopAllTweens(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens = [];
  }

  destroy(): void {
    this.stopAllTweens();
  }
}
