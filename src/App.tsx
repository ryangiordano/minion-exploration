import { useRef } from 'react';
import { PhaserGame, PhaserGameRef } from './ui/PhaserGame';
import { UpgradeMenu } from './ui/screens/UpgradeMenu';
import { useGameStore } from './ui/store/gameStore';
import './index.css';

export function App() {
  const phaserRef = useRef<PhaserGameRef>(null);
  const activeMenu = useGameStore((s) => s.activeMenu);

  return (
    <div className="game-container">
      {/* Phaser canvas */}
      <PhaserGame ref={phaserRef} />

      {/* React UI overlay - menus render here */}
      <div className="ui-overlay">
        {activeMenu === 'upgrade' && <UpgradeMenu />}
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
