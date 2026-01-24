import Phaser from 'phaser';
import { RockTypeConfig } from './types';

/** Light greyscale palette for rocks */
const ROCK_COLORS = [
  0x8a8a8a, // Light grey
  0x9a9a9a, // Lighter grey
  0x7d7d7d, // Medium-light grey
  0xa5a5a5, // Very light grey
  0x909090, // Soft grey
];

/**
 * Generates geometric rock textures with rounded squares
 * and decorative debris at the base.
 */
export class RockTextureGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Generate a rock texture for the given config.
   * Returns the texture key.
   */
  generateTexture(config: RockTypeConfig, seed: number): string {
    const key = `rock_${config.size}_${config.blocksMovement ? 'b' : 's'}_${seed}`;

    if (this.scene.textures.exists(key)) {
      return key;
    }

    const { size } = config;
    const graphics = this.scene.add.graphics();

    // Main rock body - rounded square
    const mainColor = Phaser.Utils.Array.GetRandom(ROCK_COLORS);
    const cornerRadius = size * 0.15;
    const padding = 2; // Small padding so debris can extend slightly

    graphics.fillStyle(mainColor, 1);
    graphics.fillRoundedRect(
      padding,
      padding,
      size - padding * 2,
      size - padding * 2,
      cornerRadius
    );

    // Decorative debris squares at the base - spread evenly across width
    const numDebris = config.blocksMovement
      ? Phaser.Math.Between(2, 4)
      : Phaser.Math.Between(1, 2);

    // Divide the width into zones to spread debris evenly
    const zoneWidth = size / numDebris;

    for (let i = 0; i < numDebris; i++) {
      // Larger decorative squares
      const debrisSize = Phaser.Math.Between(
        Math.floor(size * 0.18),
        Math.floor(size * 0.32)
      );
      const debrisColor = Phaser.Utils.Array.GetRandom(ROCK_COLORS);

      // x: place within this debris's zone with some wiggle room
      const zoneStart = i * zoneWidth;
      const zoneEnd = (i + 1) * zoneWidth;
      const debrisX = Phaser.Math.Between(
        Math.floor(zoneStart + debrisSize * 0.5),
        Math.floor(zoneEnd - debrisSize * 0.5)
      );

      // y: anchored at the very bottom of the texture (sitting on the ground)
      const debrisY = size - debrisSize;

      const debrisRadius = debrisSize * 0.15;

      graphics.fillStyle(debrisColor, 1);
      graphics.fillRoundedRect(
        debrisX - debrisSize / 2,
        debrisY,
        debrisSize,
        debrisSize,
        debrisRadius
      );
    }

    // Generate texture from graphics
    graphics.generateTexture(key, size, size);
    graphics.destroy();

    return key;
  }
}
