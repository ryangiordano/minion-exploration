import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useGameStore, GemSlotType } from '../store/gameStore';
import { Panel, Section, EmptyText, Hint } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { GemRow } from '../components/GemRow';
import type { EquippedGemState, NanobotState, InventoryGemState } from '../../shared/types';

/** Combined component for gem slots and inventory with equip/remove/sell */
interface GemEquipmentSectionProps {
  gemSlots: (EquippedGemState | null)[];
  slotType: GemSlotType;
  slotColor: string;
  inventoryGems: InventoryGemState[];
  onEquip: (slotIndex: number, gemInstanceId: string) => void;
  onRemove: (slotIndex: number) => void;
  onSell: (gemInstanceId: string) => void;
}

function GemEquipmentSection({
  gemSlots,
  slotType,
  slotColor,
  inventoryGems,
  onEquip,
  onRemove,
  onSell,
}: GemEquipmentSectionProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedGemId, setSelectedGemId] = useState<string | null>(null);

  const handleSlotClick = (index: number, gem: EquippedGemState | null) => {
    if (gem) {
      // Slot has a gem - remove it
      onRemove(index);
      setSelectedSlot(null);
      setSelectedGemId(null);
    } else if (selectedGemId) {
      // Empty slot clicked with gem selected - equip it (free)
      onEquip(index, selectedGemId);
      setSelectedSlot(null);
      setSelectedGemId(null);
    } else {
      // Toggle slot selection for equipping
      setSelectedSlot(selectedSlot === index ? null : index);
    }
  };

  const handleGemRowClick = (gemInstanceId: string) => {
    if (selectedSlot !== null) {
      // Slot is selected - equip this gem to it (free)
      onEquip(selectedSlot, gemInstanceId);
      setSelectedSlot(null);
      setSelectedGemId(null);
    } else {
      // Toggle gem selection
      setSelectedGemId(selectedGemId === gemInstanceId ? null : gemInstanceId);
    }
  };

  const slotLabel = slotType === 'personal' ? 'ROBOT' : 'NANOBOT';
  const hasSelection = selectedSlot !== null || selectedGemId !== null;

  return (
    <>
      <Section title={selectedGemId ? `SELECT ${slotLabel} SLOT` : 'EQUIPPED GEMS'}>
        <div className="gem-slots">
          {gemSlots.map((gem, index) => (
            <GemSlot
              key={`${slotType}-${index}`}
              gem={gem}
              slotType={slotType}
              slotIndex={index}
              isSelected={selectedSlot === index}
              onClick={() => handleSlotClick(index, gem)}
              color={slotColor}
            />
          ))}
        </div>
        <div className="slot-hint">
          {selectedGemId
            ? 'Click an empty slot to equip'
            : 'Click empty slot to equip, filled slot to remove'}
        </div>
      </Section>

      <Section title={selectedSlot !== null ? `SELECT GEM FOR SLOT` : 'INVENTORY'}>
        {inventoryGems.length === 0 ? (
          <EmptyText>No gems in inventory</EmptyText>
        ) : (
          <div className="inventory-scroll">
            {inventoryGems.map((gem) => (
              <GemRow
                key={gem.instanceId}
                name={gem.name}
                description={`${gem.description} • Sell: ◆${gem.sellValue}`}
                color={gem.color}
                isSelected={selectedGemId === gem.instanceId}
                onClick={() => handleGemRowClick(gem.instanceId)}
                action={{
                  label: `SELL`,
                  onClick: () => onSell(gem.instanceId),
                  color: '#ffd700',
                }}
              />
            ))}
          </div>
        )}
        {!hasSelection && inventoryGems.length > 0 && (
          <div className="slot-hint">Click gem to select, or use SELL button</div>
        )}
      </Section>
    </>
  );
}

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
  const sellGem = useGameStore((s) => s.sellGem);

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
            sellGem={sellGem}
          />
        </motion.div>

        {/* Nanobot Overview Panel */}
        <motion.div variants={panelVariants}>
          <NanobotOverviewPanel
            nanobots={nanobots}
            nanobotGemSlots={robot.nanobotGemSlots}
            inventoryGems={inventoryGems}
            equipRobotGem={equipRobotGem}
            removeRobotGem={removeRobotGem}
            sellGem={sellGem}
          />
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
  sellGem: (gemInstanceId: string) => void;
}

function RobotPanel({ robot, inventoryGems, equipRobotGem, removeRobotGem, sellGem }: RobotPanelProps) {
  return (
    <Panel title="ROBOT">
      <Section title="STATUS">
        <StatBar label="HP" current={robot.hp} max={robot.maxHp} color={COLORS.hp} />
        <StatBar label="MP" current={robot.mp} max={robot.maxMp} color={COLORS.mp} />
      </Section>

      <GemEquipmentSection
        gemSlots={robot.personalGemSlots}
        slotType="personal"
        slotColor={COLORS.personal}
        inventoryGems={inventoryGems}
        onEquip={(slotIndex, gemId) => equipRobotGem('personal', slotIndex, gemId)}
        onRemove={(slotIndex) => removeRobotGem('personal', slotIndex)}
        onSell={sellGem}
      />
    </Panel>
  );
}

interface GemSlotProps {
  gem: EquippedGemState | null;
  slotType: GemSlotType;
  slotIndex: number;
  isSelected?: boolean;
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
        cursor: 'pointer',
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
  nanobotGemSlots: (EquippedGemState | null)[];
  inventoryGems: InventoryGemState[];
  equipRobotGem: (slotType: GemSlotType, slotIndex: number, gemInstanceId: string) => void;
  removeRobotGem: (slotType: GemSlotType, slotIndex: number) => void;
  sellGem: (gemInstanceId: string) => void;
}

function NanobotOverviewPanel({
  nanobots,
  nanobotGemSlots,
  inventoryGems,
  equipRobotGem,
  removeRobotGem,
  sellGem,
}: NanobotOverviewPanelProps) {
  const totalHp = nanobots.reduce((sum, n) => sum + n.hp, 0);
  const totalMaxHp = nanobots.reduce((sum, n) => sum + n.maxHp, 0);
  const aliveCount = nanobots.filter((n) => n.hp > 0).length;

  return (
    <Panel title="NANOBOTS">
      <Section title="STATUS">
        {totalMaxHp > 0 && (
          <StatBar label="HP" current={totalHp} max={totalMaxHp} color={COLORS.hp} />
        )}
        <div className="summary-stat">
          <span className="stat-label">Active:</span>
          <span className="stat-value">
            {aliveCount}/{nanobots.length}
          </span>
        </div>
        {nanobots.length > 0 && (
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

      <GemEquipmentSection
        gemSlots={nanobotGemSlots}
        slotType="nanobot"
        slotColor={COLORS.nanobot}
        inventoryGems={inventoryGems}
        onEquip={(slotIndex, gemId) => equipRobotGem('nanobot', slotIndex, gemId)}
        onRemove={(slotIndex) => removeRobotGem('nanobot', slotIndex)}
        onSell={sellGem}
      />
    </Panel>
  );
}

