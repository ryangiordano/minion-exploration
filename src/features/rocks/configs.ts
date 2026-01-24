import { RockTypeConfig } from './types';

/** Large boulder - blocks movement, needs minions to break */
export const BOULDER_CONFIG: RockTypeConfig = {
  name: 'Boulder',
  baseHp: 5,
  size: 80,
  blocksMovement: true,
  essenceDrop: [8, 15],
};

/** Small rock - can walk through, break with dash */
export const SMALL_ROCK_CONFIG: RockTypeConfig = {
  name: 'Small Rock',
  baseHp: 1,
  size: 40,
  blocksMovement: false,
  essenceDrop: [3, 6],
};
