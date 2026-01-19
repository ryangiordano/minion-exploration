import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useGameStore, GemSlotType } from '../store/gameStore';
import { Panel, Section, EmptyText, Hint } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { GemRow } from '../components/GemRow';
import type { EquippedGemState, NanobotState, InventoryGemState } from '../../shared/types';

const GEMS_PER_PAGE = 3;

/** Animation variants for staggered enter/exit */
const containerVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
      when: 'afterChildren',
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

/** Color constants */
const COLORS = {
  hp: '#ff6666',
  mp: '#6666ff',
  personal: '#ffaa44',
  nanobot: '#44aaff',
};

export function PartyUpgradeMenu() {
  const robot = useGameStore((s) => s.robot);
  const nanobots = useGameStore((s) => s.nanobots);
  const inventoryGems = useGameStore((s) => s.inventoryGems);
  const closeMenu = useGameStore((s) => s.closeMenu);
  const equipRobotGem = useGameStore((s) => s.equipRobotGem);
  const removeRobotGem = useGameStore((s) => s.removeRobotGem);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        closeMenu();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu]);

  // Handle click outside to close
  const handleBackdropClick = () => {
    closeMenu();
  };

  if (!robot) return null;

  return (
    <motion.div
      className="party-menu"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div
        className="party-backdrop"
        onClick={handleBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.15 } }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className="party-panels"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Robot Panel - Equipment */}
        <motion.div variants={panelVariants}>
          <RobotPanel
            robot={robot}
            inventoryGems={inventoryGems}
            equipRobotGem={equipRobotGem}
            removeRobotGem={removeRobotGem}
          />
        </motion.div>

        {/* Nanobot Overview Panel */}
        <motion.div variants={panelVariants}>
          <NanobotOverviewPanel nanobots={nanobots} />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Hint>ESC or C to close</Hint>
      </motion.div>
    </motion.div>
  );
}

interface RobotPanelProps {
  robot: NonNullable<ReturnType<typeof useGameStore.getState>['robot']>;
  inventoryGems: InventoryGemState[];
  equipRobotGem: (slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => void;
  removeRobotGem: (slotType: GemSlotType, slotIndex: number) => void;
}

function RobotPanel({
  robot,
  inventoryGems,
  equipRobotGem,
  removeRobotGem,
}: RobotPanelProps) {
  const [inventoryPage, setInventoryPage] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ type: GemSlotType; index: number } | null>(null);
  const [selectedGemId, setSelectedGemId] = useState<string | null>(null);

  // Get all equipped gem IDs to filter inventory
  const equippedGemIds = new Set<string>();
  robot.personalGemSlots.forEach(gem => {
    if (gem) equippedGemIds.add(gem.id);
  });
  robot.nanobotGemSlots.forEach(gem => {
    if (gem) equippedGemIds.add(gem.id);
  });

  const availableGems = inventoryGems.filter(g => !equippedGemIds.has(g.gemId));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(availableGems.length / GEMS_PER_PAGE));
  const currentPage = Math.min(inventoryPage, totalPages - 1);
  const pagedGems = availableGems.slice(
    currentPage * GEMS_PER_PAGE,
    (currentPage + 1) * GEMS_PER_PAGE
  );

  const handleSlotClick = (type: GemSlotType, index: number, gem: EquippedGemState | null) => {
    if (gem) {
      // Remove gem from slot
      removeRobotGem(type, index);
      setSelectedGemId(null);
    } else if (selectedGemId) {
      // Gem is selected, equip it to this slot
      equipRobotGem(type, index, selectedGemId);
      setSelectedGemId(null);
      setSelectedSlot(null);
    } else {
      // Toggle slot selection
      const isAlreadySelected = selectedSlot?.type === type && selectedSlot?.index === index;
      setSelectedSlot(isAlreadySelected ? null : { type, index });
    }
  };

  const handleGemRowClick = (gemInstanceId: string) => {
    if (selectedSlot) {
      // Slot is selected, equip this gem to it
      equipRobotGem(selectedSlot.type, selectedSlot.index, gemInstanceId);
      setSelectedSlot(null);
      setSelectedGemId(null);
    } else {
      // Toggle gem selection
      setSelectedGemId(selectedGemId === gemInstanceId ? null : gemInstanceId);
    }
  };

  return (
    <Panel title="ROBOT">
      {/* Robot Stats */}
      <Section title="STATUS">
        <StatBar label="HP" current={robot.hp} max={robot.maxHp} color={COLORS.hp} />
        <StatBar label="MP" current={robot.mp} max={robot.maxMp} color={COLORS.mp} />
      </Section>

      {/* Personal Gem Slots */}
      <Section title="ROBOT GEMS">
        <div className="gem-slots">
          {robot.personalGemSlots.map((gem, index) => (
            <GemSlot
              key={`personal-${index}`}
              gem={gem}
              slotType="personal"
              slotIndex={index}
              isSelected={selectedSlot?.type === 'personal' && selectedSlot?.index === index}
              onClick={() => handleSlotClick('personal', index, gem)}
              color={COLORS.personal}
            />
          ))}
        </div>
        <div className="slot-hint">Click empty slot to equip, click gem to remove</div>
      </Section>

      {/* Nanobot Gem Slots */}
      <Section title="NANOBOT GEMS">
        <div className="gem-slots">
          {robot.nanobotGemSlots.map((gem, index) => (
            <GemSlot
              key={`nanobot-${index}`}
              gem={gem}
              slotType="nanobot"
              slotIndex={index}
              isSelected={selectedSlot?.type === 'nanobot' && selectedSlot?.index === index}
              onClick={() => handleSlotClick('nanobot', index, gem)}
              color={COLORS.nanobot}
            />
          ))}
        </div>
        <div className="slot-hint">Nanobot gems affect all nanobots</div>
      </Section>

      {/* Inventory */}
      <Section
        title={selectedSlot ? `SELECT GEM FOR ${selectedSlot.type.toUpperCase()} SLOT` : 'INVENTORY'}
        rightContent={
          totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPrev={() => setInventoryPage((p) => Math.max(0, p - 1))}
              onNext={() => setInventoryPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          )
        }
      >
        {availableGems.length === 0 ? (
          <EmptyText>No gems available</EmptyText>
        ) : (
          pagedGems.map((gem) => (
            <GemRow
              key={gem.instanceId}
              name={gem.name}
              description={gem.description}
              color={gem.color}
              isSelected={selectedGemId === gem.instanceId}
              onClick={() => handleGemRowClick(gem.instanceId)}
            />
          ))
        )}
        {!selectedSlot && !selectedGemId && availableGems.length > 0 && (
          <div className="slot-hint">Click a gem or slot to begin equipping</div>
        )}
        {selectedGemId && (
          <div className="slot-hint">Now click an empty slot to equip</div>
        )}
      </Section>
    </Panel>
  );
}

interface GemSlotProps {
  gem: EquippedGemState | null;
  slotType: GemSlotType;
  slotIndex: number;
  isSelected: boolean;
  onClick: () => void;
  color: string;
}

function GemSlot({ gem, slotType, slotIndex, isSelected, onClick, color }: GemSlotProps) {
  const slotLabel = `${slotType === 'personal' ? 'R' : 'N'}${slotIndex + 1}`;

  return (
    <div
      className={`gem-slot ${gem ? 'filled' : 'empty'} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{
        borderColor: isSelected ? '#ffffff' : color,
        backgroundColor: gem ? `#${gem.color.toString(16).padStart(6, '0')}33` : 'transparent',
      }}
    >
      <div className="slot-label">{slotLabel}</div>
      {gem ? (
        <div className="slot-gem">
          <div
            className="gem-icon"
            style={{ backgroundColor: `#${gem.color.toString(16).padStart(6, '0')}` }}
          />
          <div className="gem-name">{gem.name}</div>
        </div>
      ) : (
        <div className="slot-empty">Empty</div>
      )}
    </div>
  );
}

interface NanobotOverviewPanelProps {
  nanobots: NanobotState[];
}

function NanobotOverviewPanel({ nanobots }: NanobotOverviewPanelProps) {
  const totalHp = nanobots.reduce((sum, n) => sum + n.hp, 0);
  const totalMaxHp = nanobots.reduce((sum, n) => sum + n.maxHp, 0);
  const aliveCount = nanobots.filter(n => n.hp > 0).length;

  return (
    <Panel title="NANOBOTS">
      <Section title="OVERVIEW">
        <div className="nanobot-summary">
          <div className="summary-stat">
            <span className="stat-label">Active:</span>
            <span className="stat-value">{aliveCount}/{nanobots.length}</span>
          </div>
          {totalMaxHp > 0 && (
            <StatBar
              label="Total HP"
              current={totalHp}
              max={totalMaxHp}
              color={COLORS.hp}
            />
          )}
        </div>
      </Section>

      <Section title="INDIVIDUAL STATUS">
        {nanobots.length === 0 ? (
          <EmptyText>No nanobots spawned</EmptyText>
        ) : (
          <div className="nanobot-grid">
            {nanobots.map((nanobot) => (
              <div
                key={nanobot.id}
                className={`nanobot-cell ${nanobot.hp <= 0 ? 'defeated' : ''}`}
              >
                <div
                  className="nanobot-hp-fill"
                  style={{
                    width: `${(nanobot.hp / nanobot.maxHp) * 100}%`,
                    backgroundColor: nanobot.hp > 0 ? COLORS.hp : '#444444',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Section>
    </Panel>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="pagination">
      <button className="pagination-btn" onClick={onPrev} disabled={page === 0}>
        {'<'}
      </button>
      <span className="pagination-text">
        {page + 1}/{totalPages}
      </span>
      <button className="pagination-btn" onClick={onNext} disabled={page >= totalPages - 1}>
        {'>'}
      </button>
    </div>
  );
}
