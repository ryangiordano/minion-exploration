import { setup, assign } from 'xstate';
import { Followable, Combatable } from '../../../core/types/interfaces';

/**
 * Context for the minion state machine
 */
export interface MinionContext {
  followTarget: Followable | null;
  combatTarget: Combatable | null;
}

/**
 * Events that can be sent to the minion state machine
 */
export type MinionEvent =
  | { type: 'WHISTLE'; cursorTarget: Followable }  // Recruit idle minions OR recall fighting minions
  | { type: 'DISMISS' }                             // Return to idle
  | { type: 'ENEMY_NEARBY'; enemy: Combatable }     // Enemy detected while following
  | { type: 'ENEMY_DEFEATED' };                     // Combat target died

/**
 * Simplified state machine for minion behavior.
 *
 * States:
 * - idle: Standing still, not recruited
 * - following: Following the cursor, will auto-attack nearby enemies
 * - fighting: Actively in combat with a specific enemy
 */
export const minionMachine = setup({
  types: {
    context: {} as MinionContext,
    events: {} as MinionEvent,
  },
  actions: {
    setFollowTarget: assign(({ event }) => {
      if (event.type === 'WHISTLE') {
        return { followTarget: event.cursorTarget };
      }
      return {};
    }),
    setCombatTarget: assign(({ event }) => {
      if (event.type === 'ENEMY_NEARBY') {
        return { combatTarget: event.enemy };
      }
      return {};
    }),
    clearCombatTarget: assign({
      combatTarget: null,
    }),
    clearAllTargets: assign({
      followTarget: null,
      combatTarget: null,
    }),
  },
}).createMachine({
  id: 'minion',
  initial: 'idle',
  context: {
    followTarget: null,
    combatTarget: null,
  },
  states: {
    idle: {
      on: {
        WHISTLE: {
          target: 'following',
          actions: 'setFollowTarget',
        },
      },
    },
    following: {
      on: {
        WHISTLE: {
          // Re-whistling updates the follow target
          actions: 'setFollowTarget',
        },
        DISMISS: {
          target: 'idle',
          actions: 'clearAllTargets',
        },
        ENEMY_NEARBY: {
          target: 'fighting',
          actions: 'setCombatTarget',
        },
      },
    },
    fighting: {
      on: {
        WHISTLE: {
          // Whistle recalls from combat back to following
          target: 'following',
          actions: ['clearCombatTarget', 'setFollowTarget'],
        },
        DISMISS: {
          target: 'idle',
          actions: 'clearAllTargets',
        },
        ENEMY_DEFEATED: {
          // Return to following after combat
          target: 'following',
          actions: 'clearCombatTarget',
        },
      },
    },
  },
});

export type MinionState = 'idle' | 'following' | 'fighting';
