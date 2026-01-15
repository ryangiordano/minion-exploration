/** Visual and stat configuration for different enemy types */
export interface EnemyTypeConfig {
  radius: number;
  color: number;
  strokeColor: number;
  speed: number;
  attackCooldown: number;
  baseStats: {
    maxHp: number;
    maxMp: number;
    strength: number;
    dexterity: number;
    magic: number;
    resilience: number;
  };
  statGrowth: {
    maxHp: number;
    strength: number;
  };
  /** Range of essence dropped on death [min, max] */
  essenceDrop: [number, number];
}

export interface EnemyConfig {
  type?: EnemyTypeConfig;
  level?: number;
  aggroRadius?: number;
  attackRange?: number;
}
