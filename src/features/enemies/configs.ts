import { EnemyTypeConfig } from './types';

/** Critter: Tiny, fragile - early floor fodder for learning mechanics */
export const CRITTER_CONFIG: EnemyTypeConfig = {
  radius: 12,
  color: 0x88aa66,
  strokeColor: 0x556633,
  speed: 70,
  attackCooldown: 2500,
  baseStats: {
    maxHp: 3,
    maxMp: 0,
    strength: 1,
    dexterity: 1,
    magic: 1,
    resilience: 0,
  },
  statGrowth: {
    maxHp: 1,
    strength: 0.1,
  },
  essenceDrop: [1, 1],
};

/** Lackey: Small, fast, weak - swarm fodder */
export const LACKEY_CONFIG: EnemyTypeConfig = {
  radius: 20,
  color: 0xff6666,
  strokeColor: 0xcc3333,
  speed: 100,
  attackCooldown: 2000,
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
  attackCooldown: 3000,
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

/** Spitter: Ranged enemy that fires slow, dodgeable projectiles - fragile glass cannon */
export const SPITTER_CONFIG: EnemyTypeConfig = {
  radius: 12,
  color: 0xffaa44,
  strokeColor: 0xcc7722,
  speed: 45,
  // DEBUG: Fast fire rate for testing (was 2500)
  attackCooldown: 800,
  baseStats: {
    maxHp: 3,
    maxMp: 0,
    strength: 1,
    dexterity: 1,
    magic: 1,
    resilience: 0,
  },
  statGrowth: {
    maxHp: 1,
    strength: 0.3,
  },
  essenceDrop: [2, 3],
};
