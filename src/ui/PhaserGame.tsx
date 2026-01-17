import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../core/config/game.config';
import { LevelScene } from '../features/level';
import { useGameStore } from './store/gameStore';

export interface PhaserGameRef {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

/**
 * Bridge component that manages the Phaser game instance.
 * Handles initialization, cleanup, and pause state synchronization.
 */
export const PhaserGame = forwardRef<PhaserGameRef>(function PhaserGame(_props, ref) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Expose game and scene to parent components
  useImperativeHandle(ref, () => ({
    game: gameRef.current,
    scene: gameRef.current?.scene.getScene('LevelScene') ?? null,
  }));

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      ...gameConfig,
      parent: containerRef.current,
      scene: [LevelScene],
    };

    gameRef.current = new Phaser.Game(config);

    // Disable right-click context menu on game canvas
    gameRef.current.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Sync pause state from store to Phaser
  const isPaused = useGameStore((s) => s.isPaused);
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('LevelScene');
    if (!scene) return;

    if (isPaused) {
      scene.scene.pause();
    } else {
      scene.scene.resume();
    }
  }, [isPaused]);

  return <div ref={containerRef} id="game" />;
});
