// omniflow/frontend/src/components/graph/graphTheme.ts
// Medallion Layer Colors & Typography Formatter for Relationship Graph

export const LAYER_COLORS: Record<string, string> = {
  source: '#4ba473',    // half-bright muted sage/emerald
  bronze: '#c98539',    // half-bright warm bronze/amber
  silver: '#469bb0',    // half-bright muted slate cyan
  gold: '#cbaf49',      // half-bright soft straw gold
  bi: '#ba5884',        // half-bright muted rose/mauve
  warehouse: '#507eb3', // half-bright steel blue
  shared: '#8c6ebd',    // half-bright soft lavender
};

export const DEFAULT_NODE_COLOR = '#788290';

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

