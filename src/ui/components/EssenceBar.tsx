interface EssenceDisplayProps {
  /** Total essence amount */
  essence: number;
  /** Maximum essence to display (default 100) */
  max?: number;
}

const SEGMENT_COUNT = 50; // Each segment represents 2 essence

/** Vertical essence bar with segments */
export function EssenceDisplay({ essence, max = 100 }: EssenceDisplayProps) {
  const essencePerSegment = max / SEGMENT_COUNT;
  const filledSegments = Math.floor(essence / essencePerSegment);

  return (
    <div className="essence-display-vertical">
      <div className="essence-bar-vertical">
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => {
          // With column-reverse, index 0 renders at bottom
          const isFilled = i < filledSegments;

          return (
            <div
              key={i}
              className={`essence-segment ${isFilled ? 'filled' : ''}`}
            />
          );
        })}
      </div>
      <div className="essence-label">{essence}</div>
    </div>
  );
}

// Keep EssenceBar export for backwards compatibility, but it's now unused
export function EssenceBar() {
  return null;
}
