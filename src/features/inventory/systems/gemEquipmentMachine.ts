import { setup, assign } from 'xstate';
import { InventoryGem } from '../data/InventoryState';

/**
 * Context for the gem equipment state machine
 */
export interface GemEquipmentContext {
  /** The gem currently pending equipment */
  pendingGem: InventoryGem | null;
}

/**
 * Events for the gem equipment state machine
 */
export type GemEquipmentEvent =
  | { type: 'SELECT_GEM'; gem: InventoryGem }
  | { type: 'CANCEL' }
  | { type: 'EQUIP_COMPLETE' };

/**
 * State machine for gem equipment flow.
 *
 * States:
 * - idle: No gem selected, waiting for user to pick one
 * - awaitingTarget: Gem selected, waiting for user to click a minion
 */
export const gemEquipmentMachine = setup({
  types: {
    context: {} as GemEquipmentContext,
    events: {} as GemEquipmentEvent,
  },
  actions: {
    setPendingGem: assign(({ event }) => {
      if (event.type === 'SELECT_GEM') {
        return { pendingGem: event.gem };
      }
      return {};
    }),
    clearPendingGem: assign({
      pendingGem: null,
    }),
  },
}).createMachine({
  id: 'gemEquipment',
  initial: 'idle',
  context: {
    pendingGem: null,
  },
  states: {
    idle: {
      on: {
        SELECT_GEM: {
          target: 'awaitingTarget',
          actions: 'setPendingGem',
        },
      },
    },
    awaitingTarget: {
      on: {
        SELECT_GEM: {
          // Selecting a different gem while already awaiting
          actions: 'setPendingGem',
        },
        CANCEL: {
          target: 'idle',
          actions: 'clearPendingGem',
        },
        EQUIP_COMPLETE: {
          target: 'idle',
          actions: 'clearPendingGem',
        },
      },
    },
  },
});

export type GemEquipmentState = 'idle' | 'awaitingTarget';
