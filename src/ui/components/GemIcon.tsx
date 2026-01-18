/** Converts a hex number to CSS color string */
function hexToColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

interface GemIconProps {
  color: number;
  size?: number;
}

/** A circular gem icon with color and border */
export function GemIcon({ color, size = 16 }: GemIconProps) {
  return (
    <div
      className="gem-icon"
      style={{
        width: size,
        height: size,
        backgroundColor: hexToColor(color),
        borderRadius: '50%',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        flexShrink: 0,
      }}
    />
  );
}
