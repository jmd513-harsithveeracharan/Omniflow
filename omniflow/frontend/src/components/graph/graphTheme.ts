// omniflow/frontend/src/components/graph/graphTheme.ts
// Medallion Layer Colors & Typography Formatter for Relationship Graph

export const LAYER_COLORS: Record<string, string> = {
  source: '#4ba473',
  raw: '#52a878',
  landing: '#52a878',
  staging: '#c98539',
  stg: '#c98539',
  bronze: '#c98539',
  silver: '#469bb0',
  curated: '#469bb0',
  gold: '#cbaf49',
  mart: '#cbaf49',
  reporting: '#a96fd1',
  bi: '#ba5884',
  warehouse: '#507eb3',
  lakehouse: '#3d9a8b',
  orchestration: '#8c6ebd',
  workspace: '#6d83a3',
  shared: '#8c6ebd',
};

export const DEFAULT_NODE_COLOR = '#788290';

const DYNAMIC_LAYER_PALETTE = [
  '#4ba473',
  '#c98539',
  '#469bb0',
  '#cbaf49',
  '#a96fd1',
  '#ba5884',
  '#507eb3',
  '#3d9a8b',
  '#d47b5c',
];

/**
 * Resolves a consistent muted color for any dynamic architecture layer name.
 */
export function getLayerColor(layer: string): string {
  const key = (layer || '').trim().toLowerCase();
  if (LAYER_COLORS[key]) {
    return LAYER_COLORS[key];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return DYNAMIC_LAYER_PALETTE[hash % DYNAMIC_LAYER_PALETTE.length];
}

/**
 * Formats any backend layer slug into a concise UI chip label.
 */
export function formatLayerLabel(layer: string): string {
  const key = (layer || '').trim().toLowerCase();
  if (key === 'bi') return 'BI';
  if (key === 'stg') return 'Staging';
  if (!key) return 'Layer';
  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => (part.toUpperCase() === 'BI' ? 'BI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export type GraphShapeType = 'source' | 'schema' | 'lakehouse' | 'warehouse' | 'table' | 'column' | 'notebook' | 'pipeline' | 'metric';

export function isSchemaContainerNode(type: GraphShapeType): boolean {
  return type === 'schema' || type === 'source' || type === 'lakehouse' || type === 'warehouse';
}

export function drawRoundedSquarePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfSize: number,
  cornerRadius: number
): void {
  const x = cx - halfSize;
  const y = cy - halfSize;
  const size = halfSize * 2;
  const r = Math.min(cornerRadius, halfSize);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function traceNodeOutline(ctx: CanvasRenderingContext2D, type: GraphShapeType, x: number, y: number, r: number): void {
  if (type === 'table') {
    drawRoundedSquarePath(ctx, x, y, r, Math.max(2.2, r * 0.28));
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function computeDynamicLayerDepths(
  nodes: Array<{ id: string; layer: string }>,
  edges: Array<{ source: string; target: string; relationship: string }>,
  nodeMap: Map<string, { id: string; layer: string }>
): { layerDepths: Map<string, number>; maxLayerDepth: number } {
  const layerDepths = new Map<string, number>();
  const uniqueLayers = Array.from(new Set(nodes.map((n) => n.layer.toLowerCase()).filter(Boolean)));
  uniqueLayers.forEach((l) => layerDepths.set(l, 0));
  for (let pass = 0; pass < Math.max(1, uniqueLayers.length); pass++) {
    for (const e of edges) {
      if (e.relationship === 'CONTAINS') continue;
      const su = nodeMap.get(e.source);
      const tv = nodeMap.get(e.target);
      if (!su || !tv) continue;
      const lu = su.layer.toLowerCase();
      const lv = tv.layer.toLowerCase();
      if (lu !== lv) {
        const candidate = (layerDepths.get(lu) ?? 0) + 1;
        if (candidate > (layerDepths.get(lv) ?? 0) && candidate <= uniqueLayers.length + 1) {
          layerDepths.set(lv, candidate);
        }
      }
    }
  }
  const maxLayerDepth = Math.max(1, ...Array.from(layerDepths.values()));
  return { layerDepths, maxLayerDepth };
}

/**
 * Wraps long identifiers and note titles into at most 2 lines.
 * Splits cleanly on spaces, underscores, or dots.
 */
export function wrapLabel(text: string, maxLineChars = 14): string[] {
  if (!text || text.length <= maxLineChars) {
    return [text || ''];
  }

  // 1. Split on space if present
  if (text.includes(' ')) {
    const words = text.split(' ');
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    if (line1.length <= maxLineChars * 1.6 && line2.length <= maxLineChars * 1.6) {
      return [line1, line2];
    }
  }

  // 2. Split on underscore for database identifiers (e.g. customer_name, order_item_id)
  if (text.includes('_')) {
    const parts = text.split('_');
    const mid = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, mid).join('_') + '_';
    const line2 = parts.slice(mid).join('_');
    return [line1, line2];
  }

  // 3. Split on dot (e.g. bronze.orders)
  if (text.includes('.')) {
    const parts = text.split('.');
    return [parts[0] + '.', parts.slice(1).join('.')];
  }

  // 4. Fallback midpoint split
  const half = Math.ceil(text.length / 2);
  return [text.slice(0, half) + '-', text.slice(half)];
}

/**
 * Calculates perpendicular distance from point (px, py) to line segment (x1, y1) - (x2, y2).
 */
export function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

