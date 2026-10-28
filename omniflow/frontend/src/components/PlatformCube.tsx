import React from 'react';

const CUBE_PALETTES: Record<string, { top: string; right: string; left: string }> = {
  fabric: { top: '#00d2a0', right: '#00a88f', left: '#008272' }, // emerald / teal
  databricks: { top: '#ff5a43', right: '#ff3621', left: '#b32010' }, // flame red / orange
  snowflake: { top: '#68d5f8', right: '#29b5e8', left: '#147a9f' }, // snowflake ice cyan / blue
  dbt: { top: '#ff8970', right: '#ff694b', left: '#bf3b22' }, // dbt warm coral / orange
};

interface PlatformCubeProps {
  platformId?: string;
  size?: number;
  className?: string;
}

export const PlatformCube: React.FC<PlatformCubeProps> = ({
  platformId = 'fabric',
  size = 20,
  className = '',
}) => {
  const p = CUBE_PALETTES[platformId.toLowerCase()] || CUBE_PALETTES.fabric;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* Left Face (Shadowed) */}
      <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill={p.left} />
      {/* Right Face (Mid-tone) */}
      <path d="M16 3L29 10.5V21.5L16 29V3Z" fill={p.right} />
      {/* Top Face (Highlight) */}
      <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill={p.top} />
    </svg>
  );
};

