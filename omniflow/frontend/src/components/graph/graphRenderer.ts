import { D3SimNode, D3SimLink } from './graphSimulation';
import { GraphMeshNode } from '../../types';

export const LAYER_COLORS: Record<string, string> = {
  source: '#10b981',    // vibrant emerald
  bronze: '#f59e0b',    // vibrant amber
  silver: '#06b6d4',    // vibrant cyan
  gold: '#eab308',      // vibrant gold
  bi: '#ec4899',        // vibrant rose/pink
  warehouse: '#3b82f6', // vibrant blue
  shared: '#a855f7',    // vibrant purple
};

const DEFAULT_NODE_COLOR = '#94a3b8';

export interface RenderGraphOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  simNodes: D3SimNode[];
  simLinks: D3SimLink[];
  selectedNode: GraphMeshNode | null;
  hoveredEdgeId: string | null;
  selectedLayer: string;
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
    hoveredEdgeId,
    selectedLayer,
    searchQuery,
    zoomLevel,
    panOffset,
  } = opts;

  ctx.clearRect(0, 0, w, h);

  // Camera Transform
  ctx.save();
  ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);

  const activeId = selectedNode?.id || null;
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

  // 1. Draw Hairline Edges
  for (const link of simLinks) {
    const na = link.source;
    const nb = link.target;
    if (na.x === undefined || na.y === undefined || nb.x === undefined || nb.y === undefined) continue;

    const isLayerVis = selectedLayer === 'all' || na.layer === selectedLayer || nb.layer === selectedLayer;
    if (!isLayerVis) continue;

    const isEdgeConnected = activeId ? connectedEdgeSet.has(link.id) : false;
    const isEdgeHovered = hoveredEdgeId === link.id;
    const isDimmed = activeId && !isEdgeConnected && !isEdgeHovered;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);

    if (isEdgeHovered) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.3;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
      ctx.shadowBlur = 4;
    } else if (isEdgeConnected) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.0;
    } else {
      ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = link.relationship === 'CONTAINS' ? 0.6 : 0.75;
    }

    ctx.stroke();
    ctx.restore();
  }

  // 2. Draw Solid Vibrant Nodes
  for (const n of simNodes) {
    if (n.x === undefined || n.y === undefined) continue;

    const matchesLayer = selectedLayer === 'all' || n.layer === selectedLayer;
    const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
    const isConnected = activeId ? connectedNodeSet.has(n.id) : true;
    const isDimmed = !matchesLayer || !matchesSearch || (activeId && !isConnected);
    const isCurrentActive = n.id === activeId;

    const baseColor = LAYER_COLORS[n.layer] || DEFAULT_NODE_COLOR;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.06 : 1.0;

    if (isCurrentActive) {
      ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
      ctx.shadowBlur = 8;
    }

    // Node Circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = isCurrentActive ? '#ffffff' : baseColor;
    ctx.fill();

    // 3. Crisp Pure White Typography Centered Below Node
    const showLabel =
      isCurrentActive ||
      (activeId && isConnected) ||
      (n.isHub && zoomLevel > 0.8) ||
      zoomLevel > 1.35 ||
      (matchesSearch && searchQuery);

    if (showLabel) {
      ctx.shadowBlur = 0;
      ctx.font = `${isCurrentActive ? '600 10.5px' : '400 9.5px'} -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = isCurrentActive ? '#ffffff' : isDimmed ? 'rgba(255, 255, 255, 0.15)' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(n.label, n.x, n.y + n.radius + 3.5);
    }

    ctx.restore();
  }

  ctx.restore();
}
