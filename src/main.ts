import Phaser from 'phaser';
import { gameConfig } from './core/config/game.config';
import { LevelScene } from './features/level';

// Register all feature scenes
const config: Phaser.Types.Core.GameConfig = {
  ...gameConfig,
  scene: [
    LevelScene
    // Add more scenes here
  ]
};

new Phaser.Game(config);
