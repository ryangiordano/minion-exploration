# React UI Migration Path

A phased approach to adding React for menu/overlay UI while keeping Phaser for gameplay.

## Why This Architecture

The current [UpgradeMenu.ts](../../src/features/upgrade/ui/UpgradeMenu.ts) is 840 lines of imperative Phaser code to render what is essentially a form with lists, buttons, and stat displays. In React, this would be ~150-200 lines of declarative JSX with automatic re-rendering on state changes.

**React handles:**
- Menus, modals, overlays (UpgradeMenu, PauseMenu, MainMenu)
- Complex forms and lists
- Inventory management screens
- Settings, tooltips, dialogs

**Phaser handles:**
- Gameplay rendering (sprites, physics, particles)
- Real-time HUD elements that need to track world positions
- Camera, input during gameplay

---

## Phase 1: Foundation (Do This First)

### 1.1 Install Dependencies

```bash
npm install react react-dom zustand
npm install -D @vitejs/plugin-react @types/react @types/react-dom
```

### 1.2 Update Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
```

### 1.3 Create Directory Structure

```
src/
├── main.tsx                    ← NEW: React entry point
├── App.tsx                     ← NEW: React root
├── ui/                         ← NEW: All React UI
│   ├── components/             ← Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Panel.tsx
│   │   ├── StatBar.tsx
│   │   └── GemIcon.tsx
│   ├── screens/                ← Full-screen menus
│   │   ├── UpgradeMenu.tsx
│   │   ├── PauseMenu.tsx
│   │   └── MainMenu.tsx
│   ├── store/                  ← Zustand stores
│   │   ├── gameStore.ts        ← Core game state bridge
│   │   └── uiStore.ts          ← UI-only state
│   └── PhaserGame.tsx          ← Bridge component
├── game/                       ← Phaser code (rename from current structure)
│   ├── main.ts                 ← Phaser config
│   ├── core/                   ← Move current core/ here
│   └── features/               ← Move current features/ here
└── shared/                     ← Types shared between React & Phaser
    └── types.ts
```

### 1.4 Update index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phaser Game</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root {
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background-color: #222;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

---

## Phase 2: The Bridge Layer

### 2.1 Create the Zustand Store

This is the communication layer between React and Phaser.

```typescript
// src/ui/store/gameStore.ts
import { create } from 'zustand';
import type { MinionState, PlayerState } from '../../shared/types';

interface GameStore {
  // Game state (Phaser writes, React reads)
  isPaused: boolean;
  playerEssence: number;
  minions: MinionState[];

  // UI state (React writes, Phaser reads)
  activeMenu: 'none' | 'upgrade' | 'pause' | 'inventory';
  selectedMinionId: string | null;

  // Actions (callable from both sides)
  openUpgradeMenu: (minionId: string) => void;
  closeMenu: () => void;
  setPlayerEssence: (amount: number) => void;
  updateMinion: (id: string, state: Partial<MinionState>) => void;

  // Commands (React -> Phaser)
  equipGem: (minionId: string, gemId: string) => void;
  removeGem: (minionId: string, slot: number) => void;
  repairMinion: (minionId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  isPaused: false,
  playerEssence: 0,
  minions: [],
  activeMenu: 'none',
  selectedMinionId: null,

  // UI actions
  openUpgradeMenu: (minionId) => set({
    activeMenu: 'upgrade',
    selectedMinionId: minionId,
    isPaused: true
  }),
  closeMenu: () => set({
    activeMenu: 'none',
    selectedMinionId: null,
    isPaused: false
  }),

  // State updates (called by Phaser)
  setPlayerEssence: (amount) => set({ playerEssence: amount }),
  updateMinion: (id, state) => set((prev) => ({
    minions: prev.minions.map(m => m.id === id ? { ...m, ...state } : m)
  })),

  // Commands (handled by Phaser via subscription)
  equipGem: () => {}, // Placeholder - Phaser subscribes to these
  removeGem: () => {},
  repairMinion: () => {},
}));

// For Phaser to access outside React
export const gameStore = useGameStore;
```

### 2.2 Create the PhaserGame Bridge Component

```typescript
// src/ui/PhaserGame.tsx
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../game/core/config/game.config';
import { LevelScene } from '../game/features/level';
import { useGameStore } from './store/gameStore';

export interface PhaserGameRef {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

export const PhaserGame = forwardRef<PhaserGameRef>((_props, ref) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    game: gameRef.current,
    scene: gameRef.current?.scene.getScene('LevelScene') ?? null,
  }));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      ...gameConfig,
      parent: containerRef.current,
      scene: [LevelScene],
    };

    gameRef.current = new Phaser.Game(config);

    // Disable right-click
    gameRef.current.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Sync pause state to Phaser
  const isPaused = useGameStore((s) => s.isPaused);
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene('LevelScene');
    if (scene) {
      if (isPaused) {
        scene.scene.pause();
      } else {
        scene.scene.resume();
      }
    }
  }, [isPaused]);

  return <div ref={containerRef} id="game" />;
});
```

### 2.3 Create Shared Types

```typescript
// src/shared/types.ts

export interface MinionState {
  id: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  xp: number;
  xpToNext: number;
  level: number;
  stats: {
    strength: number;
    magic: number;
    dexterity: number;
    resilience: number;
  };
  equippedGems: EquippedGem[];
  attack: {
    damage: number;
    range: number;
    effectType: string;
  };
}

export interface EquippedGem {
  id: string;
  name: string;
  description: string;
  color: number;
}

export interface InventoryGem {
  instanceId: string;
  gemId: string;
  name: string;
  description: string;
  essenceCost: number;
  color: number;
}
```

---

## Phase 3: React Entry Point

### 3.1 Main Entry

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css'; // Create basic styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 3.2 App Component

```typescript
// src/App.tsx
import { useRef } from 'react';
import { PhaserGame, PhaserGameRef } from './ui/PhaserGame';
import { UpgradeMenu } from './ui/screens/UpgradeMenu';
import { useGameStore } from './ui/store/gameStore';

export function App() {
  const phaserRef = useRef<PhaserGameRef>(null);
  const activeMenu = useGameStore((s) => s.activeMenu);

  return (
    <div className="game-container">
      {/* Phaser canvas */}
      <PhaserGame ref={phaserRef} />

      {/* React UI overlay */}
      <div className="ui-overlay">
        {activeMenu === 'upgrade' && <UpgradeMenu />}
        {/* Add more menus here */}
      </div>
    </div>
  );
}
```

### 3.3 Basic CSS

```css
/* src/index.css */
.game-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

#game {
  /* Phaser will set dimensions */
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Allow clicks through to game */
  display: flex;
  justify-content: center;
  align-items: center;
}

.ui-overlay > * {
  pointer-events: auto; /* But menus capture clicks */
}
```

---

## Phase 4: Convert UpgradeMenu

Here's what the 840-line Phaser UpgradeMenu becomes in React (~200 lines):

```typescript
// src/ui/screens/UpgradeMenu.tsx
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { GemRow } from '../components/GemRow';
import { Button } from '../components/Button';

export function UpgradeMenu() {
  const selectedMinionId = useGameStore((s) => s.selectedMinionId);
  const minions = useGameStore((s) => s.minions);
  const essence = useGameStore((s) => s.playerEssence);
  const closeMenu = useGameStore((s) => s.closeMenu);
  const equipGem = useGameStore((s) => s.equipGem);
  const removeGem = useGameStore((s) => s.removeGem);
  const repairMinion = useGameStore((s) => s.repairMinion);

  const minion = minions.find(m => m.id === selectedMinionId);
  if (!minion) return null;

  const isDamaged = minion.hp < minion.maxHp;
  const repairCost = 10;
  const canRepair = essence >= repairCost && isDamaged;

  return (
    <div className="upgrade-menu" onKeyDown={(e) => e.key === 'Escape' && closeMenu()}>
      {/* Left Panel - Gems */}
      <Panel title="MINION" width={340}>
        <Section title="EQUIPPED">
          {minion.equippedGems.length === 0 ? (
            <EmptyText>No gems equipped</EmptyText>
          ) : (
            minion.equippedGems.map((gem, slot) => (
              <GemRow
                key={gem.id}
                gem={gem}
                action={{ label: 'Remove', onClick: () => removeGem(minion.id, slot) }}
              />
            ))
          )}
        </Section>

        <Section title="INVENTORY">
          <InventoryGemList
            minionId={minion.id}
            essence={essence}
            onEquip={equipGem}
          />
        </Section>

        {isDamaged && (
          <Button
            disabled={!canRepair}
            onClick={() => repairMinion(minion.id)}
          >
            Repair - {repairCost} Essence
          </Button>
        )}

        <Hint>ESC to close</Hint>
      </Panel>

      {/* Right Panel - Stats */}
      <Panel title="STATS" width={180}>
        <StatBar label="HP" current={minion.hp} max={minion.maxHp} color="#ff6666" />
        <StatBar label="MP" current={minion.mp} max={minion.maxMp} color="#6666ff" />
        <StatBar label={`Lv${minion.level}`} current={minion.xp} max={minion.xpToNext} color="#ffd700" />

        <Divider />

        <StatLine label="Strength" value={minion.stats.strength} color="#ff8844" />
        <StatLine label="Magic" value={minion.stats.magic} color="#aa66ff" />
        <StatLine label="Dexterity" value={minion.stats.dexterity} color="#44ff88" />
        <StatLine label="Resilience" value={minion.stats.resilience} color="#66aaff" />

        <Divider />

        <StatLine label="Damage" value={minion.attack.damage} color="#ff8844" />
        <StatLine label="Range" value={minion.attack.range} />
        <StatLine label="Type" value={minion.attack.effectType} />
      </Panel>
    </div>
  );
}
```

---

## Phase 5: Wire Up Phaser → Store

In your LevelScene, sync state to the store:

```typescript
// In LevelScene.ts
import { gameStore } from '../../ui/store/gameStore';

// When essence changes:
gameStore.getState().setPlayerEssence(this.currencyDisplay.getEssence());

// When opening upgrade menu (replace old UpgradeMenu usage):
gameStore.getState().openUpgradeMenu(minion.getId());

// Subscribe to commands from React:
gameStore.subscribe((state, prevState) => {
  // Handle equipGem, removeGem, repairMinion commands
});
```

---

## Migration Order

1. **Phase 1-3**: Set up React infrastructure (doesn't change existing code)
2. **Test**: Verify game still works with React wrapper
3. **Phase 4**: Convert UpgradeMenu to React
4. **Delete**: Remove old `src/features/upgrade/ui/UpgradeMenu.ts`
5. **Iterate**: Convert other menus one at a time

## Estimated Effort

| Phase | Files Changed | Complexity |
|-------|---------------|------------|
| Phase 1 (Setup) | 3-4 new files | Low |
| Phase 2 (Bridge) | 3 new files | Medium |
| Phase 3 (Entry) | 3 new files | Low |
| Phase 4 (UpgradeMenu) | 5-6 new components | Medium |
| Phase 5 (Wiring) | Modify LevelScene | Medium |

The infrastructure (Phases 1-3) is a one-time cost. After that, each menu conversion is independent.

## Benefits After Migration

- **UpgradeMenu**: 840 lines → ~200 lines
- **Automatic re-renders**: No manual `refreshMenu()` calls
- **Hot reloading**: Iterate on UI without restarting game
- **Accessibility**: Native DOM means screen readers, keyboard nav work
- **DevTools**: React DevTools + Zustand DevTools for debugging
- **Styling**: Use CSS/Tailwind instead of manual Graphics calls
