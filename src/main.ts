import Phaser from 'phaser';
import { gameConfig } from './core/config/game.config';
import { ExampleScene } from './features/example-feature';

// Register all feature scenes
const config: Phaser.Types.Core.GameConfig = {
  ...gameConfig,
  scene: [
    ExampleScene
    // Add more feature scenes here
  ]
};

new Phaser.Game(config);
