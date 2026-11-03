import { D3SimNode, D3SimLink } from './graphSimulation';
import { GraphMeshNode } from '../../types';

// Half-bright, shaded Obsidian tones matching user reference screenshots
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

export interface RenderGraphOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  simNodes: D3SimNode[];
  simLinks: D3SimLink[];
  selectedNode: GraphMeshNode | null;
  hoveredNode?: GraphMeshNode | null;
  hoveredEdgeId: string | null;
  selectedLayer?: string;
  selectedLayers?: string[] | string;
  searchQuery: string;
  zoomLevel: number;
  panOffset: { x: number; y: number };
}

export function renderGraphMesh(opts: RenderGraphOptions): void {
  const {
    ctx,
    width: w,
    height: h,
    simNodes,
    simLinks,
    selectedNode,
    hoveredNode = null,
    hoveredEdgeId,
    searchQuery,
    zoomLevel,
    panOffset,
  } = opts;

  const isLayerVisible = (layer: string) => {
    const layers = opts.selectedLayers ?? opts.selectedLayer ?? 'all';
    if (Array.isArray(layers)) {
      return layers.includes('all') || layers.includes(layer);
    }
    return layers === 'all' || layers === layer;
  };

  ctx.clearRect(0, 0, w, h);

  // Camera Transform
  ctx.save();
  ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);

  const activeId = selectedNode?.id || hoveredNode?.id || null;
  const connectedNodeSet = new Set<string>();
  const connectedEdgeSet = new Set<string>();

  if (activeId) {
    connectedNodeSet.add(activeId);
    for (const link of simLinks) {
      if (link.source.id === activeId) {
        connectedNodeSet.add(link.target.id);
        connectedEdgeSet.add(link.id);
      } else if (link.target.id === activeId) {
        connectedNodeSet.add(link.source.id);
        connectedEdgeSet.add(link.id);
      }
    }
  }

  // 1. Draw Directional & Categorized Lineage Edges
  for (const link of simLinks) {
    const na = link.source;
    const nb = link.target;
    if (na.x === undefined || na.y === undefined || nb.x === undefined || nb.y === undefined) continue;

    const isLayerVis = isLayerVisible(na.layer) || isLayerVisible(nb.layer);
    if (!isLayerVis) continue;

    const isEdgeConnected = activeId ? connectedEdgeSet.has(link.id) : false;
    const isEdgeHovered = hoveredEdgeId === link.id;
    const isDimmed = activeId && !isEdgeConnected && !isEdgeHovered;
    const isFlowEdge = link.relationship !== 'CONTAINS';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);

    if (isEdgeHovered) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
      ctx.shadowBlur = 7;
    } else if (isEdgeConnected) {
      ctx.strokeStyle = '#4ba473';
      ctx.lineWidth = 1.25;
      ctx.shadowColor = 'rgba(75, 164, 115, 0.35)';
      ctx.shadowBlur = 3.5;
    } else if (isDimmed) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 0.5;
    } else if (isFlowEdge) {
      // Semantic coloring for cross-table and cross-layer flows
      switch (link.relationship) {
        case 'FEEDS':
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.38)';
          break;
        case 'TRANSFORMS_TO':
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
          break;
        case 'JOINS_WITH':
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.38)';
          break;
        case 'AGGREGATES':
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.38)';
          break;
        default:
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      }
      ctx.lineWidth = 0.85;
    } else {
      // Subtle intra-table column containment spokes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.55;
    }

    ctx.stroke();

    // Draw directional arrowhead for data flow edges (FEEDS, TRANSFORMS_TO, JOINS_WITH, AGGREGATES)
    if (isFlowEdge && !isDimmed) {
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 18) {
        const angle = Math.atan2(dy, dx);
        const targetR = nb.radius || 3.0;
        const arrowDist = dist - (targetR + 3);
        const ax = na.x + Math.cos(angle) * arrowDist;
        const ay = na.y + Math.sin(angle) * arrowDist;
        const arrowSize = isEdgeHovered || isEdgeConnected ? 5.0 : 3.5;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - Math.cos(angle - Math.PI / 6) * arrowSize,
          ay - Math.sin(angle - Math.PI / 6) * arrowSize
        );
        ctx.lineTo(
          ax - Math.cos(angle + Math.PI / 6) * arrowSize,
          ay - Math.sin(angle + Math.PI / 6) * arrowSize
        );
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 2. Draw Solid Half-Bright Nodes (Never washed out to pure white)
  for (const n of simNodes) {
    if (n.x === undefined || n.y === undefined) continue;

    const matchesLayer = isLayerVisible(n.layer);
    const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
    const isConnected = activeId ? connectedNodeSet.has(n.id) : true;
    const isDimmed = !matchesLayer || !matchesSearch || (activeId && !isConnected);
    const isCurrentActive = n.id === selectedNode?.id;
    const isCurrentHovered = n.id === hoveredNode?.id;

    const baseColor = LAYER_COLORS[n.layer] || DEFAULT_NODE_COLOR;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.06 : 1.0;

    // Node Circle: retains its distinct medallion layer color!
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Vibrant accent ring & halo when active or hovered (instead of coloring the node white)
    if (isCurrentActive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    } else if (isCurrentHovered) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 2.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Proportional, 2-Liner Typography Below Node
    const showLabel =
      isCurrentActive ||
      isCurrentHovered ||
      (activeId && isConnected) ||
      (n.isHub && zoomLevel > 0.75) ||
      zoomLevel > 1.45 ||
      (matchesSearch && searchQuery);

    if (showLabel) {
      ctx.shadowBlur = 0;

      // Font size relative to node size
      let fontSize = 7.8;
      let fontWeight = '400';
      if (n.radius >= 7.0) {
        fontSize = 10.5;
        fontWeight = isCurrentActive || isCurrentHovered ? '600' : '500';
      } else if (n.radius >= 5.0) {
        fontSize = 9.2;
        fontWeight = isCurrentActive || isCurrentHovered ? '600' : '500';
      } else {
        fontSize = 7.8;
        fontWeight = '400';
      }

      let fontColor = '#cbd5e1';
      if (isCurrentActive || isCurrentHovered) {
        fontColor = '#f8fafc';
      } else if (n.type === 'column') {
        fontColor = '#94a3b8';
      } else if (isDimmed) {
        fontColor = 'rgba(203, 213, 225, 0.15)';
      }

      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const lines = wrapLabel(n.label, n.isHub ? 16 : 12);
      const lineHeight = fontSize * 1.2;
      const startY = n.y + n.radius + 3.0;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], n.x, startY + i * lineHeight);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}
