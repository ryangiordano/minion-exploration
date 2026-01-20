import Phaser from 'phaser';
import { AbilityGem } from '../../../core/abilities/types';
import { getGemVisual } from '../../inventory';
import { LAYERS } from '../../../core/config';

const GEM_RADIUS = 5;
const ORBIT_SPEED = 1.2; // Radians per second

// Depth values relative to robot (LAYERS.ENTITIES + 1 = 21)
const DEPTH_BEHIND = LAYERS.ENTITIES - 1;  // Behind robot
const DEPTH_FRONT = LAYERS.ENTITIES + 2;   // In front of robot
const DEPTH_ALWAYS_TOP = LAYERS.ENTITIES + 5; // Always visible (personal gems)

// Scale range for depth illusion (smaller when "behind")
const SCALE_BACK = 0.7;
const SCALE_FRONT = 1.0;

export type OrbitMode = 'flat' | '3d';

export interface OrbitalGemDisplayConfig {
  /** 'flat' = always visible circular orbit, '3d' = front/behind depth orbit */
  mode: OrbitMode;
  /** Distance from center */
  orbitDistance: number;
}

/**
 * Visual display showing equipped gems as tiny colored spheres orbiting the robot.
 * Supports two modes:
 * - 'flat': Gems orbit in a circle, always visible above the robot (for personal gems)
 * - '3d': Gems orbit in front and behind the robot with depth (for nanobot gems)
 */
export class OrbitalGemDisplay {
  private scene: Phaser.Scene;
  private orbitals: OrbitalGem[] = [];
  private gemsGetter: () => AbilityGem[];
  private orbitAngle = 0;
  private config: OrbitalGemDisplayConfig;
  private lastGemIds: string[] = [];

  constructor(scene: Phaser.Scene, gemsGetter: () => AbilityGem[], config: OrbitalGemDisplayConfig) {
    this.scene = scene;
    this.gemsGetter = gemsGetter;
    this.config = config;
  }

  /** Update orbital positions and cooldown states */
  update(centerX: number, centerY: number, delta: number): void {
    const gems = this.gemsGetter();
    const currentGemIds = gems.map(g => g.id);

    // Rebuild if gems changed (count or IDs)
    const gemsChanged = currentGemIds.length !== this.lastGemIds.length ||
      currentGemIds.some((id, i) => id !== this.lastGemIds[i]);

    if (gemsChanged) {
      this.rebuildOrbitals(gems);
      this.lastGemIds = currentGemIds;
    }

    // Advance orbit angle
    const deltaSeconds = delta / 1000;
    this.orbitAngle += ORBIT_SPEED * deltaSeconds;

    // Update each orbital's position and cooldown state
    gems.forEach((gem, i) => {
      const orbital = this.orbitals[i];
      if (!orbital) return;

      // Calculate position around the orbit
      const angleOffset = (i / gems.length) * Math.PI * 2;
      const angle = this.orbitAngle + angleOffset;

      if (this.config.mode === 'flat') {
        // Flat mode: circular orbit, always on top
        const x = centerX + Math.cos(angle) * this.config.orbitDistance;
        const y = centerY + Math.sin(angle) * this.config.orbitDistance;

        orbital.setPosition(x, y);
        orbital.setDepth(DEPTH_ALWAYS_TOP);
        orbital.setScale(1.0);
      } else {
        // 3D mode: elliptical orbit with depth sorting
        const x = centerX + Math.cos(angle) * this.config.orbitDistance;

        // Y position is compressed to create depth illusion (elliptical orbit)
        const depthFactor = Math.sin(angle); // -1 = behind, +1 = in front
        const y = centerY + depthFactor * (this.config.orbitDistance * 0.4);

        orbital.setPosition(x, y);

        // Set depth based on position in orbit
        const isBehind = depthFactor < 0;
        orbital.setDepth(isBehind ? DEPTH_BEHIND : DEPTH_FRONT);

        // Scale based on depth (smaller when behind)
        const scale = Phaser.Math.Linear(SCALE_BACK, SCALE_FRONT, (depthFactor + 1) / 2);
        orbital.setScale(scale);
      }

      // Update cooldown visual
      const cooldownInfo = gem.getCooldownInfo?.() ?? null;
      const isOnCooldown = cooldownInfo !== null && cooldownInfo.remaining > 0;
      orbital.setCooldownState(isOnCooldown);
    });
  }

  /** Rebuild all orbitals from current gems */
  private rebuildOrbitals(gems: AbilityGem[]): void {
    // Clear existing
    this.orbitals.forEach(orbital => orbital.destroy());
    this.orbitals = [];

    // Create new orbitals
    gems.forEach((gem) => {
      const orbital = new OrbitalGem(this.scene, gem);
      this.orbitals.push(orbital);
    });
  }

  /** Set visibility of all orbital gems */
  setVisible(visible: boolean): void {
    this.orbitals.forEach(orbital => orbital.setVisible(visible));
  }

  destroy(): void {
    this.orbitals.forEach(orbital => orbital.destroy());
    this.orbitals = [];
  }
}

/**
 * Individual orbiting gem sphere
 */
class OrbitalGem {
  private container: Phaser.GameObjects.Container;
  private sphere: Phaser.GameObjects.Arc;
  private highlight: Phaser.GameObjects.Arc;
  private isOnCooldown = false;

  constructor(scene: Phaser.Scene, gem: AbilityGem) {
    const visual = getGemVisual(gem.id);

    this.container = scene.add.container(0, 0);

    // Main gem sphere
    this.sphere = scene.add.circle(0, 0, GEM_RADIUS, visual.color);
    this.sphere.setStrokeStyle(1, 0xffffff, 0.6);
    this.container.add(this.sphere);

    // Highlight for 3D effect
    this.highlight = scene.add.circle(-GEM_RADIUS * 0.3, -GEM_RADIUS * 0.3, GEM_RADIUS * 0.3, 0xffffff, 0.4);
    this.container.add(this.highlight);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  setCooldownState(onCooldown: boolean): void {
    if (onCooldown === this.isOnCooldown) return;

    this.isOnCooldown = onCooldown;

    if (onCooldown) {
      // Dim the gem
      this.sphere.setAlpha(0.3);
      this.highlight.setAlpha(0.15);
    } else {
      // Full brightness
      this.sphere.setAlpha(1);
      this.highlight.setAlpha(0.4);
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}
