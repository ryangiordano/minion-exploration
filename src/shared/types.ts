/** State representation of a minion for the UI layer */
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
  equippedGems: EquippedGemState[];
  attack: {
    damage: number;
    range: number;
    effectType: string;
  };
}

/** Equipped gem state for UI display */
export interface EquippedGemState {
  id: string;
  slot: number;
  name: string;
  description: string;
  color: number;
}

/** Inventory gem state for UI display */
export interface InventoryGemState {
  instanceId: string;
  gemId: string;
  name: string;
  description: string;
  essenceCost: number;
  color: number;
}

/** Active menu types */
export type ActiveMenu = 'none' | 'party' | 'pause' | 'main';

/** Robot state for UI display */
export interface RobotState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  personalGemSlots: (EquippedGemState | null)[];
  nanobotGemSlots: (EquippedGemState | null)[];
}

/** Nanobot state for UI display */
export interface NanobotState {
  id: string;
  hp: number;
  maxHp: number;
}
