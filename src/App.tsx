import { useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { PhaserGame, PhaserGameRef } from './ui/PhaserGame';
import { PartyUpgradeMenu } from './ui/screens/PartyUpgradeMenu';
import { EssenceDisplay } from './ui/components';
import { useGameStore } from './ui/store/gameStore';
import './index.css';

export function App() {
  const phaserRef = useRef<PhaserGameRef>(null);
  const activeMenu = useGameStore((s) => s.activeMenu);
  const playerEssence = useGameStore((s) => s.playerEssence);

  return (
    <div className="game-container">
      {/* Phaser canvas */}
      <PhaserGame ref={phaserRef} />

      {/* React UI overlay - positioned over the canvas via CSS */}
      <div className="ui-overlay">
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
