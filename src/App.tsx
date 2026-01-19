import { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { PhaserGame, PhaserGameRef } from './ui/PhaserGame';
import { PartyUpgradeMenu } from './ui/screens/PartyUpgradeMenu';
import { EssenceDisplay } from './ui/components';
import { useGameStore } from './ui/store/gameStore';
import './index.css';

interface CanvasBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function App() {
  const phaserRef = useRef<PhaserGameRef>(null);
  const activeMenu = useGameStore((s) => s.activeMenu);
  const playerEssence = useGameStore((s) => s.playerEssence);
  const [canvasBounds, setCanvasBounds] = useState<CanvasBounds | null>(null);

  const updateCanvasBounds = useCallback(() => {
    const canvas = phaserRef.current?.game?.canvas;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setCanvasBounds({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  }, []);

  useEffect(() => {
    // Initial update after a short delay to let Phaser initialize
    const initTimer = setTimeout(updateCanvasBounds, 100);

    // Update on window resize
    window.addEventListener('resize', updateCanvasBounds);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', updateCanvasBounds);
    };
  }, [updateCanvasBounds]);

  const overlayStyle: React.CSSProperties = canvasBounds
    ? {
        position: 'absolute',
        top: `${canvasBounds.top}px`,
        left: `${canvasBounds.left}px`,
        width: `${canvasBounds.width}px`,
        height: `${canvasBounds.height}px`,
      }
    : {
        // Hide overlay until canvas bounds are known to prevent flash at window edges
        visibility: 'hidden',
      };

  return (
    <div className="game-container">
      {/* Phaser canvas */}
      <PhaserGame ref={phaserRef} />

      {/* React UI overlay - positioned over the canvas */}
      <div className="ui-overlay" style={overlayStyle}>
        {/* HUD elements - always visible */}
        <div className="hud-bottom-right">
          <EssenceDisplay essence={playerEssence} />
        </div>

        {/* Menus render centered */}
        <AnimatePresence>
          {activeMenu === 'party' && <PartyUpgradeMenu key="party-menu" />}
        </AnimatePresence>
        {activeMenu === 'pause' && (
          <div className="placeholder-menu">
            <p>Pause Menu (React) - Coming Soon</p>
            <button onClick={() => useGameStore.getState().closeMenu()}>
              Resume
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
