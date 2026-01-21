import { setup, assign } from 'xstate';
import { Combatable } from '../../../core/types/interfaces';

/**
 * Context for the nanobot behavior state machine
 */
export interface NanobotContext {
  /** Current combat target */
  target: Combatable | null;
  /** Destination for move commands */
  moveDestination: { x: number; y: number } | null;
  /** List of nearby enemies for auto-targeting */
  nearbyEnemies: Combatable[];
}

/**
 * Events that can be sent to the nanobot behavior machine
 */
export type NanobotEvent =
  | { type: 'COMMAND_ATTACK'; target: Combatable }
  | { type: 'COMMAND_MOVE'; x: number; y: number }
  | { type: 'COMMAND_RECALL' }
  | { type: 'FREEZE' }
  | { type: 'UNFREEZE' }
  | { type: 'ENEMY_DETECTED'; enemy: Combatable }
  | { type: 'TARGET_DEFEATED' }
  | { type: 'TARGET_OUT_OF_RANGE' }
  | { type: 'ARRIVED_AT_DESTINATION' }
  | { type: 'UPDATE_NEARBY_ENEMIES'; enemies: Combatable[] };

/**
 * XState machine for nanobot behavior.
 *
 * States:
 * - following: Orbiting around the robot
 * - moving: Moving to a commanded location
 * - fighting.commanded: Attacking a target that was explicitly commanded (respects attack range)
 * - fighting.auto: Attacking a target found via auto-aggro (closes to melee range)
 * - frozen: Paused for transitions (portal, etc.)
 */
export const nanobotBehaviorMachine = setup({
  types: {
    context: {} as NanobotContext,
    events: {} as NanobotEvent,
  },
  actions: {
    setTarget: assign({
      target: (_, params: { target: Combatable }) => params.target,
    }),
    clearTarget: assign({
      target: () => null,
    }),
    setMoveDestination: assign({
      moveDestination: (_, params: { x: number; y: number }) => ({ x: params.x, y: params.y }),
    }),
    clearMoveDestination: assign({
      moveDestination: () => null,
    }),
    updateNearbyEnemies: assign({
      nearbyEnemies: (_, params: { enemies: Combatable[] }) => params.enemies,
    }),
  },
  guards: {
    hasTarget: ({ context }) => context.target !== null && !context.target.isDefeated(),
    targetIsDefeated: ({ context }) => context.target !== null && context.target.isDefeated(),
  },
}).createMachine({
  id: 'nanobotBehavior',
  initial: 'following',
  context: {
    target: null,
    moveDestination: null,
    nearbyEnemies: [],
  },
  on: {
    // Global event to update nearby enemies (can happen in any state)
    UPDATE_NEARBY_ENEMIES: {
      actions: [
        {
          type: 'updateNearbyEnemies',
          params: ({ event }) => ({ enemies: event.enemies }),
        },
      ],
    },
  },
  states: {
    following: {
      on: {
        COMMAND_ATTACK: {
          target: 'fighting.commanded',
          actions: [
            {
              type: 'setTarget',
              params: ({ event }) => ({ target: event.target }),
            },
          ],
        },
        COMMAND_MOVE: {
          target: 'moving',
          actions: [
            {
              type: 'setMoveDestination',
              params: ({ event }) => ({ x: event.x, y: event.y }),
            },
          ],
        },
        ENEMY_DETECTED: {
          target: 'fighting.auto',
          actions: [
            {
              type: 'setTarget',
              params: ({ event }) => ({ target: event.enemy }),
            },
          ],
        },
        FREEZE: {
          target: 'frozen',
        },
      },
    },

    moving: {
      on: {
        COMMAND_ATTACK: {
          target: 'fighting.commanded',
          actions: [
            { type: 'clearMoveDestination' },
            {
              type: 'setTarget',
              params: ({ event }) => ({ target: event.target }),
            },
          ],
        },
        COMMAND_MOVE: {
          // Update destination while moving
          actions: [
            {
              type: 'setMoveDestination',
              params: ({ event }) => ({ x: event.x, y: event.y }),
            },
          ],
        },
        COMMAND_RECALL: {
          target: 'following',
          actions: [{ type: 'clearMoveDestination' }],
        },
        ENEMY_DETECTED: {
          target: 'fighting.auto',
          actions: [
            { type: 'clearMoveDestination' },
            {
              type: 'setTarget',
              params: ({ event }) => ({ target: event.enemy }),
            },
          ],
        },
        ARRIVED_AT_DESTINATION: {
          target: 'following',
          actions: [{ type: 'clearMoveDestination' }],
        },
        FREEZE: {
          target: 'frozen',
          actions: [{ type: 'clearMoveDestination' }],
        },
      },
    },

    fighting: {
      initial: 'auto',
      states: {
        /** Fighting via explicit command - respects attack range for positioning */
        commanded: {
          on: {
            TARGET_DEFEATED: {
              target: '#nanobotBehavior.following',
              actions: [{ type: 'clearTarget' }],
            },
            COMMAND_ATTACK: {
              // Re-targeting to a new commanded target
              actions: [
                {
                  type: 'setTarget',
                  params: ({ event }) => ({ target: event.target }),
                },
              ],
            },
            COMMAND_MOVE: {
              // Move command cancels fighting
              target: '#nanobotBehavior.moving',
              actions: [
                { type: 'clearTarget' },
                {
                  type: 'setMoveDestination',
                  params: ({ event }) => ({ x: event.x, y: event.y }),
                },
              ],
            },
            COMMAND_RECALL: {
              target: '#nanobotBehavior.following',
              actions: [{ type: 'clearTarget' }],
            },
            FREEZE: {
              target: '#nanobotBehavior.frozen',
              actions: [{ type: 'clearTarget' }],
            },
          },
        },

        /** Fighting via auto-aggro - closes to melee range */
        auto: {
          on: {
            // Always return to following when target defeated - let updateFollowing handle re-aggro with distance checks
            TARGET_DEFEATED: {
              target: '#nanobotBehavior.following',
              actions: [{ type: 'clearTarget' }],
            },
            COMMAND_ATTACK: {
              // Explicit command overrides auto-aggro
              target: 'commanded',
              actions: [
                {
                  type: 'setTarget',
                  params: ({ event }) => ({ target: event.target }),
                },
              ],
            },
            COMMAND_MOVE: {
              // Move command cancels fighting
              target: '#nanobotBehavior.moving',
              actions: [
                { type: 'clearTarget' },
                {
                  type: 'setMoveDestination',
                  params: ({ event }) => ({ x: event.x, y: event.y }),
                },
              ],
            },
            COMMAND_RECALL: {
              target: '#nanobotBehavior.following',
              actions: [{ type: 'clearTarget' }],
            },
            TARGET_OUT_OF_RANGE: {
              // Lost aggro, return to following
              target: '#nanobotBehavior.following',
              actions: [{ type: 'clearTarget' }],
            },
            FREEZE: {
              target: '#nanobotBehavior.frozen',
              actions: [{ type: 'clearTarget' }],
            },
          },
        },
      },
    },

    frozen: {
      on: {
        UNFREEZE: {
          target: 'following',
        },
      },
    },
  },
});

/** Helper type for the machine's state value */
export type NanobotStateValue =
  | 'following'
  | 'moving'
  | 'frozen'
  | { fighting: 'commanded' | 'auto' };

/** Check if a state value represents fighting.commanded */
export function isFightingCommanded(stateValue: NanobotStateValue): boolean {
  return typeof stateValue === 'object' && 'fighting' in stateValue && stateValue.fighting === 'commanded';
}

/** Check if a state value represents fighting.auto */
export function isFightingAuto(stateValue: NanobotStateValue): boolean {
  return typeof stateValue === 'object' && 'fighting' in stateValue && stateValue.fighting === 'auto';
}

/** Check if a state value represents any fighting state */
export function isFighting(stateValue: NanobotStateValue): boolean {
  return typeof stateValue === 'object' && 'fighting' in stateValue;
}
