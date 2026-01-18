import { create } from 'zustand';
import type { MinionState, InventoryGemState, ActiveMenu } from '../../shared/types';

interface GameStore {
  // Game state (Phaser writes, React reads)
  isPaused: boolean;
  playerEssence: number;
  minions: MinionState[];
  inventoryGems: InventoryGemState[];

  // UI state
  activeMenu: ActiveMenu;
  selectedMinionId: string | null;

  // Actions - UI control
  openUpgradeMenu: (minionId: string) => void;
  openInventory: () => void;
  closeMenu: () => void;
  pause: () => void;
  resume: () => void;

  // Actions - State updates (called by Phaser)
  setPlayerEssence: (amount: number) => void;
  setMinions: (minions: MinionState[]) => void;
  updateMinion: (id: string, state: Partial<MinionState>) => void;
  setInventoryGems: (gems: InventoryGemState[]) => void;

  // Command callbacks (Phaser registers handlers for these)
  _onEquipGem: ((minionId: string, gemId: string) => void) | null;
  _onRemoveGem: ((minionId: string, slot: number) => void) | null;
  _onRepairMinion: ((minionId: string) => void) | null;

  // Register command handlers (called by Phaser on init)
  registerCommandHandlers: (handlers: {
    onEquipGem: (minionId: string, gemId: string) => void;
    onRemoveGem: (minionId: string, slot: number) => void;
    onRepairMinion: (minionId: string) => void;
  }) => void;

  // Commands (React calls these, Phaser handles them)
  equipGem: (minionId: string, gemId: string) => void;
  removeGem: (minionId: string, slot: number) => void;
  repairMinion: (minionId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  isPaused: false,
  playerEssence: 0,
  minions: [],
  inventoryGems: [],
  activeMenu: 'none',
  selectedMinionId: null,

  // Command handlers (null until Phaser registers them)
  _onEquipGem: null,
  _onRemoveGem: null,
  _onRepairMinion: null,

  // UI actions
  openUpgradeMenu: (minionId) => set({
    activeMenu: 'upgrade',
    selectedMinionId: minionId,
    isPaused: true
  }),

  openInventory: () => set({
    activeMenu: 'inventory',
    isPaused: true
  }),

  closeMenu: () => set({
    activeMenu: 'none',
    selectedMinionId: null,
    isPaused: false
  }),

  pause: () => set({ isPaused: true }),
  resume: () => set({ isPaused: false }),

  // State updates (called by Phaser)
  setPlayerEssence: (amount) => set({ playerEssence: amount }),

  setMinions: (minions) => set({ minions }),

  updateMinion: (id, state) => set((prev) => ({
    minions: prev.minions.map(m => m.id === id ? { ...m, ...state } : m)
  })),

  setInventoryGems: (gems) => set({ inventoryGems: gems }),

  // Register command handlers
  registerCommandHandlers: (handlers) => set({
    _onEquipGem: handlers.onEquipGem,
    _onRemoveGem: handlers.onRemoveGem,
    _onRepairMinion: handlers.onRepairMinion,
  }),

  // Commands (React -> Phaser)
  equipGem: (minionId, gemId) => {
    const handler = get()._onEquipGem;
    if (handler) handler(minionId, gemId);
  },

  removeGem: (minionId, slot) => {
    const handler = get()._onRemoveGem;
    if (handler) handler(minionId, slot);
  },

  repairMinion: (minionId) => {
    const handler = get()._onRepairMinion;
    if (handler) handler(minionId);
  },
}));

/** Direct access for Phaser (outside React components) */
export const gameStore = useGameStore;
