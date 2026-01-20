import { create } from 'zustand';
import type { MinionState, InventoryGemState, ActiveMenu, RobotState, NanobotState } from '../../shared/types';

/** Which gem slot category we're interacting with */
export type GemSlotType = 'personal' | 'nanobot';

interface GameStore {
  // Game state (Phaser writes, React reads)
  isPaused: boolean;
  playerEssence: number;
  minions: MinionState[];
  inventoryGems: InventoryGemState[];
  robot: RobotState | null;
  nanobots: NanobotState[];

  // UI state
  activeMenu: ActiveMenu;

  // Actions - UI control
  openPartyMenu: () => void;
  closeMenu: () => void;
  pause: () => void;
  resume: () => void;

  // Actions - State updates (called by Phaser)
  setPlayerEssence: (amount: number) => void;
  setMinions: (minions: MinionState[]) => void;
  updateMinion: (id: string, state: Partial<MinionState>) => void;
  setInventoryGems: (gems: InventoryGemState[]) => void;
  setRobot: (robot: RobotState) => void;
  setNanobots: (nanobots: NanobotState[]) => void;

  // Command callbacks (Phaser registers handlers for these)
  _onEquipGem: ((minionId: string, gemId: string) => void) | null;
  _onRemoveGem: ((minionId: string, slot: number) => void) | null;
  _onRepairMinion: ((minionId: string) => void) | null;
  _onEquipRobotGem: ((slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => void) | null;
  _onRemoveRobotGem: ((slotType: GemSlotType, slotIndex: number) => void) | null;
  _onSellGem: ((gemInstanceId: string) => void) | null;

  // Register command handlers (called by Phaser on init)
  registerCommandHandlers: (handlers: {
    onEquipGem: (minionId: string, gemId: string) => void;
    onRemoveGem: (minionId: string, slot: number) => void;
    onRepairMinion: (minionId: string) => void;
    onEquipRobotGem?: (slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => void;
    onRemoveRobotGem?: (slotType: GemSlotType, slotIndex: number) => void;
    onSellGem?: (gemInstanceId: string) => void;
  }) => void;

  // Commands (React calls these, Phaser handles them)
  equipGem: (minionId: string, gemId: string) => void;
  removeGem: (minionId: string, slot: number) => void;
  repairMinion: (minionId: string) => void;
  equipRobotGem: (slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => void;
  removeRobotGem: (slotType: GemSlotType, slotIndex: number) => void;
  sellGem: (gemInstanceId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  isPaused: false,
  playerEssence: 0,
  minions: [],
  inventoryGems: [],
  robot: null,
  nanobots: [],
  activeMenu: 'none',

  // Command handlers (null until Phaser registers them)
  _onEquipGem: null,
  _onRemoveGem: null,
  _onRepairMinion: null,
  _onEquipRobotGem: null,
  _onRemoveRobotGem: null,
  _onSellGem: null,

  // UI actions
  openPartyMenu: () => set({
    activeMenu: 'party',
    isPaused: true
  }),

  closeMenu: () => set({
    activeMenu: 'none',
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

  setRobot: (robot) => set({ robot }),

  setNanobots: (nanobots) => set({ nanobots }),

  // Register command handlers
  registerCommandHandlers: (handlers) => set({
    _onEquipGem: handlers.onEquipGem,
    _onRemoveGem: handlers.onRemoveGem,
    _onRepairMinion: handlers.onRepairMinion,
    _onEquipRobotGem: handlers.onEquipRobotGem ?? null,
    _onRemoveRobotGem: handlers.onRemoveRobotGem ?? null,
    _onSellGem: handlers.onSellGem ?? null,
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

  equipRobotGem: (slotType, slotIndex, gemInstanceId) => {
    const handler = get()._onEquipRobotGem;
    if (handler) handler(slotType, slotIndex, gemInstanceId);
  },

  removeRobotGem: (slotType, slotIndex) => {
    const handler = get()._onRemoveRobotGem;
    if (handler) handler(slotType, slotIndex);
  },

  sellGem: (gemInstanceId) => {
    const handler = get()._onSellGem;
    if (handler) handler(gemInstanceId);
  },
}));

/** Direct access for Phaser (outside React components) */
export const gameStore = useGameStore;
