interface StatBarProps {
  label: string;
  current: number;
  max: number;
  color: string;
  /** If true, renders a smaller version without the value text */
  compact?: boolean;
}

/** A compact stat bar with label, fill bar, and value display */
export function StatBar({ label, current, max, color, compact = false }: StatBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <div className={`stat-bar ${compact ? 'compact' : ''}`}>
      {label && <span className="stat-bar-label">{label}</span>}
      <div className="stat-bar-track">
        <div
          className="stat-bar-fill"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      {!compact && (
        <span className="stat-bar-value" style={{ color }}>
          {current}/{max}
        </span>
      )}
    </div>
  );
}

interface StatLineProps {
  label: string;
  value: number | string;
  color?: string;
}

/** A simple label: value line for stats */
export function StatLine({ label, value, color = '#ffffff' }: StatLineProps) {
  return (
    <div className="stat-line">
      <span className="stat-line-label">{label}</span>
      <span className="stat-line-value" style={{ color, fontWeight: 'bold' }}>
        {value}
      </span>
    </div>
  );
}

/** Visual divider between sections */
export function Divider() {
  return <div className="panel-divider" />;
}
