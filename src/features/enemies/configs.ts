import { EnemyTypeConfig } from './types';

/** Lackey: Small, fast, weak - swarm fodder */
export const LACKEY_CONFIG: EnemyTypeConfig = {
  radius: 20,
  color: 0xff6666,
  strokeColor: 0xcc3333,
  speed: 100,
  attackCooldown: 1500,
  baseStats: {
    maxHp: 6,
    maxMp: 0,
    strength: 1,
    dexterity: 1,
    magic: 1,
    resilience: 1,
  },
  statGrowth: {
    maxHp: 2,
    strength: 0.2,
  },
  essenceDrop: [1, 2],
};

/** Brute: Large, slow, tanky - mini-boss feel */
export const BRUTE_CONFIG: EnemyTypeConfig = {
  radius: 40,
  color: 0xaa2222,
  strokeColor: 0x660000,
  speed: 50,
  attackCooldown: 2500,
  baseStats: {
    maxHp: 20,
    maxMp: 0,
    strength: 2,
    dexterity: 1,
    magic: 1,
    resilience: 2,
  },
  statGrowth: {
    maxHp: 6,
    strength: 0.5,
  },
  essenceDrop: [3, 5],
};
