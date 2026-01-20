import { RockTypeConfig } from './types';

/** Large boulder - blocks movement, needs minions to break */
export const BOULDER_CONFIG: RockTypeConfig = {
  name: 'Boulder',
  baseHp: 2,
  width: 60,
  height: 50,
  color: 0x666666,
  strokeColor: 0x444444,
  blocksMovement: true,
  essenceDrop: [8, 15],
};

/** Small rock - can walk through, break with dash */
export const SMALL_ROCK_CONFIG: RockTypeConfig = {
  name: 'Small Rock',
  baseHp: 1,
  width: 24,
  height: 20,
  color: 0x888888,
  strokeColor: 0x666666,
  blocksMovement: false,
  essenceDrop: [3, 6],
};
