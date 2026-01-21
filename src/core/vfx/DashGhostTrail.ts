import Phaser from 'phaser';

export interface DashGhostTrailConfig {
  /** Color of the ghost circles */
  color?: number;
  /** Radius of each ghost */
  radius?: number;
  /** How often to spawn a ghost (in ms) */
  spawnInterval?: number;
  /** How long each ghost takes to fade out (in ms) */
  fadeDuration?: number;
  /** Starting alpha for ghosts */
  startAlpha?: number;
}

/**
 * Creates a trail of fading ghost circles behind a moving object.
 * Used for dash effects to create an afterimage/echo effect.
 */
export class DashGhostTrail {
  private scene: Phaser.Scene;
  private config: Required<DashGhostTrailConfig>;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private target: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, config: DashGhostTrailConfig = {}) {
    this.scene = scene;
    this.config = {
      color: config.color ?? 0x88ccff,
      radius: config.radius ?? 20,
      spawnInterval: config.spawnInterval ?? 30,
      fadeDuration: config.fadeDuration ?? 200,
      startAlpha: config.startAlpha ?? 0.5,
    };
  }

  /** Start spawning ghost trails following the target */
  start(target: { x: number; y: number }): void {
    this.target = target;

    // Spawn immediately
    this.spawnGhost();

    // Then spawn at intervals
    this.spawnTimer = this.scene.time.addEvent({
      delay: this.config.spawnInterval,
      callback: this.spawnGhost,
      callbackScope: this,
      loop: true,
    });
  }

  /** Stop spawning new ghosts */
  stop(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }
    this.target = null;
  }

  /** Spawn a single ghost at current target position */
  private spawnGhost(): void {
    if (!this.target) return;

    const ghost = this.scene.add.graphics();
    ghost.setPosition(this.target.x, this.target.y);

    // Draw the ghost circle (matching robot body style)
    ghost.fillStyle(this.config.color, 1);
    ghost.fillCircle(0, 0, this.config.radius);

    // Add subtle highlight like the robot
    ghost.fillStyle(0xffffff, 0.15);
    ghost.fillCircle(
      -this.config.radius * 0.3,
      -this.config.radius * 0.3,
      this.config.radius * 0.3
    );

    ghost.setAlpha(this.config.startAlpha);
    ghost.setDepth(-1); // Behind the robot

    // Fade out and destroy
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.8,
      duration: this.config.fadeDuration,
      ease: 'Quad.easeOut',
      onComplete: () => ghost.destroy(),
    });
  }

  /** Clean up resources */
  destroy(): void {
    this.stop();
  }
}
