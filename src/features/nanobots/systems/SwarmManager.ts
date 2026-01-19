import Phaser from 'phaser';
import { Nanobot, NANOBOT_VISUAL_RADIUS } from '../objects/Nanobot';
import { Robot } from '../../robot';
import { Combatable } from '../../../core/types/interfaces';

/** Configuration for the SwarmManager */
export interface SwarmManagerConfig {
  robot: Robot;
  scene: Phaser.Scene;
  maxNanobots?: number;
  spawnCost?: number;
  baseOrbitDistance?: number;
}

/**
 * Manages the swarm of nanobots that follow and support the robot.
 * Handles spawning, death cleanup, formation, and distributing commands.
 */
export class SwarmManager {
  private scene: Phaser.Scene;
  private robot: Robot;
  private nanobots: Nanobot[] = [];

  private readonly maxNanobots: number;
  private readonly spawnCost: number;
  private readonly baseOrbitDistance: number;

  /** Scatter radius when commanding nanobots to a location */
  private readonly scatterRadius = NANOBOT_VISUAL_RADIUS * 3;

  /** Callback fired when a new nanobot is spawned */
  private spawnCallback?: (nanobot: Nanobot) => void;

  constructor(config: SwarmManagerConfig) {
    this.scene = config.scene;
    this.robot = config.robot;
    this.maxNanobots = config.maxNanobots ?? 10;
    this.spawnCost = config.spawnCost ?? 5;
    this.baseOrbitDistance = config.baseOrbitDistance ?? 50;
  }

  /** Update all nanobots */
  public update(delta: number, enemies: Combatable[]): void {
    for (const nanobot of this.nanobots) {
      nanobot.setNearbyEnemies(enemies);
      nanobot.update(delta);
    }
  }

  /** Spawn a new nanobot if under the cap */
  public spawnNanobot(): Nanobot | null {
    if (this.nanobots.length >= this.maxNanobots) {
      return null;
    }

    // Calculate orbit angle for this nanobot (evenly distributed)
    const orbitAngle = this.calculateOrbitAngle(this.nanobots.length);

    // Add slight distance variation for organic feel
    const distanceVariation = Phaser.Math.Between(-10, 10);
    const orbitDistance = this.baseOrbitDistance + distanceVariation;

    // Spawn at robot position
    const nanobot = new Nanobot(this.scene, this.robot.x, this.robot.y, {
      robot: this.robot,
      orbitAngle,
      orbitDistance,
    });

    // Handle death
    nanobot.onDeath(() => {
      const index = this.nanobots.indexOf(nanobot);
      if (index > -1) {
        this.nanobots.splice(index, 1);
        // Recalculate orbit angles for remaining nanobots
        this.redistributeOrbits();
      }
    });

    this.nanobots.push(nanobot);

    // Fire spawn callback if registered
    this.spawnCallback?.(nanobot);

    return nanobot;
  }

  /** Calculate the orbit angle for a nanobot at the given index */
  private calculateOrbitAngle(index: number): number {
    const totalNanobots = Math.max(this.nanobots.length + 1, 1);
    return (index / totalNanobots) * Math.PI * 2;
  }

  /** Redistribute orbit angles after a nanobot dies */
  private redistributeOrbits(): void {
    // For now, don't redistribute - each nanobot keeps its original angle
    // This prevents janky movement when one dies
    // Could add smooth transition later if desired
  }

  /** Command all nanobots to move to a location with scatter */
  public commandMoveTo(x: number, y: number): void {
    for (const nanobot of this.nanobots) {
      const offset = this.getScatterOffset();
      nanobot.commandMoveTo(x + offset.x, y + offset.y);
    }
  }

  /** Command all nanobots to recall to robot */
  public commandRecall(): void {
    for (const nanobot of this.nanobots) {
      nanobot.commandRecall();
    }
  }

  /** Get a random scatter offset for organic movement */
  private getScatterOffset(): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.scatterRadius;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  }

  /** Get the current nanobot count */
  public getNanobotCount(): number {
    return this.nanobots.length;
  }

  /** Get the maximum nanobot count */
  public getMaxNanobots(): number {
    return this.maxNanobots;
  }

  /** Get the essence cost to spawn a nanobot */
  public getSpawnCost(): number {
    return this.spawnCost;
  }

  /** Check if at max capacity */
  public isAtCapacity(): boolean {
    return this.nanobots.length >= this.maxNanobots;
  }

  /** Get all active nanobots */
  public getNanobots(): Nanobot[] {
    return [...this.nanobots];
  }

  /** Register a callback for when a new nanobot is spawned */
  public onNanobotSpawn(callback: (nanobot: Nanobot) => void): void {
    this.spawnCallback = callback;
  }

  /** Freeze all nanobots (stops behavior updates, used during portal transitions) */
  public freezeAll(): void {
    for (const nanobot of this.nanobots) {
      nanobot.freeze();
    }
  }

  /** Unfreeze all nanobots and return them to following */
  public unfreezeAll(): void {
    for (const nanobot of this.nanobots) {
      nanobot.unfreeze();
    }
  }
}
