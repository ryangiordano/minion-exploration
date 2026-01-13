import { setup, assign } from 'xstate';
import { Combatable } from '../../../core/types/interfaces';

/**
 * Context for the minion state machine
 */
export interface MinionContext {
  /** Destination point for move commands */
  destination: { x: number; y: number } | null;
  /** Current combat target */
  combatTarget: Combatable | null;
  /** Original destination to return to after auto-combat */
  returnDestination: { x: number; y: number } | null;
}

/**
 * Events that can be sent to the minion state machine
 */
export type MinionEvent =
  | { type: 'MOVE_TO'; x: number; y: number }      // Click to move to location
  | { type: 'ATTACK'; target: Combatable }         // Click to attack enemy
  | { type: 'ENEMY_NEARBY'; enemy: Combatable }    // Auto-aggro while moving
  | { type: 'ENEMY_DEFEATED' }                     // Combat target died
  | { type: 'ARRIVED' };                           // Reached destination

/**
 * State machine for minion behavior.
 *
 * States:
 * - idle: Standing still, waiting for commands
 * - moving: Moving to a destination, will auto-attack nearby enemies
 * - fighting: Actively in combat with a specific enemy
 */
export const minionMachine = setup({
  types: {
    context: {} as MinionContext,
    events: {} as MinionEvent,
  },
  actions: {
    setDestination: assign(({ event }) => {
      if (event.type === 'MOVE_TO') {
        return { destination: { x: event.x, y: event.y } };
      }
      return {};
    }),
    setCombatTarget: assign(({ event, context }) => {
      if (event.type === 'ATTACK') {
        return { combatTarget: event.target };
      }
      if (event.type === 'ENEMY_NEARBY') {
        // Save current destination to return to after combat
        return {
          combatTarget: event.enemy,
          returnDestination: context.destination,
        };
      }
      return {};
    }),
    clearCombatTarget: assign({
      combatTarget: null,
    }),
    restoreDestination: assign(({ context }) => ({
      destination: context.returnDestination,
      returnDestination: null,
      combatTarget: null,
    })),
    clearAll: assign({
      destination: null,
      combatTarget: null,
      returnDestination: null,
    }),
    clearDestination: assign({
      destination: null,
    }),
  },
}).createMachine({
  id: 'minion',
  initial: 'idle',
  context: {
    destination: null,
    combatTarget: null,
    returnDestination: null,
  },
  states: {
    idle: {
      on: {
        MOVE_TO: {
          target: 'moving',
          actions: 'setDestination',
        },
        ATTACK: {
          target: 'fighting',
          actions: 'setCombatTarget',
        },
      },
    },
    moving: {
      on: {
        MOVE_TO: {
          // New move command overrides current
          actions: 'setDestination',
        },
        ATTACK: {
          target: 'fighting',
          actions: 'setCombatTarget',
        },
        ENEMY_NEARBY: {
          target: 'fighting',
          actions: 'setCombatTarget',
        },
        ARRIVED: {
          target: 'idle',
          actions: 'clearDestination',
        },
      },
    },
    fighting: {
      on: {
        MOVE_TO: {
          // Move command cancels combat
          target: 'moving',
          actions: ['clearCombatTarget', 'setDestination'],
        },
        ATTACK: {
          // New attack target
          actions: 'setCombatTarget',
        },
        ENEMY_DEFEATED: {
          // Return to moving if we had a destination, otherwise idle
          target: 'moving',
          actions: 'restoreDestination',
        },
      },
    },
  },
});

export type MinionState = 'idle' | 'moving' | 'fighting';
