import { EnemyTypeConfig, CRITTER_CONFIG, LACKEY_CONFIG, BRUTE_CONFIG } from '../../features/enemies';

/** Describes a single enemy to spawn */
export interface EnemySpawn {
  type: EnemyTypeConfig;
  level: number;
  /** Position offset from pack center (0-1 normalized, will be scaled) */
  offsetX: number;
  offsetY: number;
}

/** Describes a pack of enemies to spawn together */
export interface EnemyPack {
  enemies: EnemySpawn[];
}

/** Output of level generation */
export interface LevelData {
  floor: number;
  packs: EnemyPack[];
}

/** Configuration for difficulty scaling */
export interface LevelGeneratorConfig {
  /** Base number of packs on floor 1 */
  basePackCount: number;
  /** Additional packs per floor */
  packsPerFloor: number;
  /** Base lackeys per pack */
  baseLackeysPerPack: number;
  /** Additional lackeys per pack per floor */
  lackeysPerFloor: number;
  /** Floor at which brutes start appearing */
  bruteStartFloor: number;
  /** Chance of a brute per pack (0-1), scales with floor */
  baseBruteChance: number;
  /** Additional brute chance per floor */
  bruteChancePerFloor: number;
  /** Enemy level = floor * this multiplier (floored) */
  enemyLevelMultiplier: number;
  /** Last floor where critters appear */
  critterEndFloor: number;
  /** Floor where lackeys start appearing */
  lackeyStartFloor: number;
}

const DEFAULT_CONFIG: LevelGeneratorConfig = {
  basePackCount: 2,
  packsPerFloor: 0.5,
  baseLackeysPerPack: 3,
  lackeysPerFloor: 0.5,
  bruteStartFloor: 3,
  baseBruteChance: 0.3,
  bruteChancePerFloor: 0.1,
  enemyLevelMultiplier: 1,
  critterEndFloor: 2,
  lackeyStartFloor: 2,
};

/**
 * Generates enemy compositions for each floor.
 * Encapsulates all difficulty scaling logic.
 */
export class LevelGenerator {
  private config: LevelGeneratorConfig;

  constructor(config: Partial<LevelGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Generate level data for the given floor */
  generate(floor: number): LevelData {
    const packCount = this.getPackCount(floor);
    const packs: EnemyPack[] = [];

    for (let i = 0; i < packCount; i++) {
      packs.push(this.generatePack(floor));
    }

    return { floor, packs };
  }

  private getPackCount(floor: number): number {
    return Math.floor(this.config.basePackCount + (floor - 1) * this.config.packsPerFloor);
  }

  private generatePack(floor: number): EnemyPack {
    const enemies: EnemySpawn[] = [];
    const enemyLevel = Math.max(1, Math.floor(floor * this.config.enemyLevelMultiplier));

    // Determine if this pack has a brute
    const hasBrute = floor >= this.config.bruteStartFloor &&
      Math.random() < this.getBruteChance(floor);

    // Add brute at center if applicable
    if (hasBrute) {
      enemies.push({
        type: BRUTE_CONFIG,
        level: enemyLevel,
        offsetX: 0,
        offsetY: 0,
      });
    }

    // Determine fodder type based on floor
    const fodderType = this.getFodderType(floor);
    const fodderCount = this.getLackeyCount(floor);

    // Add fodder enemies around
    for (let i = 0; i < fodderCount; i++) {
      const angle = (i / fodderCount) * Math.PI * 2;
      // Fodder spread out from center (or from brute if present)
      const distance = hasBrute ? 0.6 + Math.random() * 0.4 : Math.random() * 0.5;
      enemies.push({
        type: fodderType,
        level: enemyLevel,
        offsetX: Math.cos(angle) * distance,
        offsetY: Math.sin(angle) * distance,
      });
    }

    return { enemies };
  }

  /** Get the appropriate fodder enemy type for this floor */
  private getFodderType(floor: number): EnemyTypeConfig {
    const hasCritters = floor <= this.config.critterEndFloor;
    const hasLackeys = floor >= this.config.lackeyStartFloor;

    // Floor 1: only critters
    if (hasCritters && !hasLackeys) {
      return CRITTER_CONFIG;
    }

    // Transition floors (e.g., floor 2): mix of critters and lackeys
    if (hasCritters && hasLackeys) {
      return Math.random() < 0.5 ? CRITTER_CONFIG : LACKEY_CONFIG;
    }

    // Later floors: only lackeys
    return LACKEY_CONFIG;
  }

  private getLackeyCount(floor: number): number {
    return Math.floor(this.config.baseLackeysPerPack + (floor - 1) * this.config.lackeysPerFloor);
  }

  private getBruteChance(floor: number): number {
    const floorsSinceBrutes = floor - this.config.bruteStartFloor;
    return Math.min(0.9, this.config.baseBruteChance + floorsSinceBrutes * this.config.bruteChancePerFloor);
  }
}
