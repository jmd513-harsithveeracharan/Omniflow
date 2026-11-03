import { D3SimNode, D3SimLink } from './graphSimulation';
import { GraphMeshNode } from '../../types';

export { LAYER_COLORS, DEFAULT_NODE_COLOR, wrapLabel } from './graphTheme';
import { LAYER_COLORS, DEFAULT_NODE_COLOR, wrapLabel } from './graphTheme';

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

  const cleanQuery = (searchQuery || '').trim().toLowerCase();
  const hasSearch = cleanQuery.length > 0;

  const matchingNodeIds = new Set<string>();
  const searchNeighborNodeIds = new Set<string>();
  const searchConnectedEdgeIds = new Set<string>();

  if (hasSearch) {
    for (const n of simNodes) {
      if (n.label.toLowerCase().includes(cleanQuery) || n.id.toLowerCase().includes(cleanQuery)) {
        matchingNodeIds.add(n.id);
      }
    }
    for (const link of simLinks) {
      const srcMatch = matchingNodeIds.has(link.source.id);
      const tgtMatch = matchingNodeIds.has(link.target.id);
      if (srcMatch || tgtMatch) {
        searchConnectedEdgeIds.add(link.id);
        if (srcMatch) searchNeighborNodeIds.add(link.target.id);
        if (tgtMatch) searchNeighborNodeIds.add(link.source.id);
      }
    }
  }

  const activeId = selectedNode?.id || hoveredNode?.id || null;
  const connectedNodeSet = new Set<string>();
  const connectedEdgeSet = new Set<string>();

  if (activeId && !hasSearch) {
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

  // 1. Draw Directional & Neutral Grey Lineage Edges (Never Multi-Colored)
  for (const link of simLinks) {
    const na = link.source;
    const nb = link.target;
    if (na.x === undefined || na.y === undefined || nb.x === undefined || nb.y === undefined) continue;

    const isLayerVis = isLayerVisible(na.layer) || isLayerVisible(nb.layer);
    if (!isLayerVis) continue;

    // Search Mode: strictly skip any edge not connected to a matching node
    if (hasSearch && !searchConnectedEdgeIds.has(link.id)) {
      continue;
    }

    const isEdgeHovered = hoveredEdgeId === link.id;
    const isEdgeConnected = !hasSearch && activeId ? connectedEdgeSet.has(link.id) : false;
    const isSearchEdge = hasSearch && searchConnectedEdgeIds.has(link.id);
    const isDimmed = !hasSearch && activeId && !isEdgeConnected && !isEdgeHovered;
    if (isDimmed) continue;

    const isFlowEdge = link.relationship !== 'CONTAINS';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(na.x, na.y);
    ctx.lineTo(nb.x, nb.y);

    if (isEdgeHovered) {
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 8;
    } else if (isEdgeConnected || isSearchEdge) {
      ctx.strokeStyle = 'rgba(244, 244, 245, 0.75)';
      ctx.lineWidth = 1.35;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 4;
    } else if (isFlowEdge) {
      // Neutral clean grey for all cross-table and pipeline flows
      ctx.strokeStyle = 'rgba(161, 161, 170, 0.28)';
      ctx.lineWidth = 0.85;
    } else {
      // Subtle intra-table column containment spokes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.5;
    }

    ctx.stroke();

    // Directional Arrowhead for data flows
    if (isFlowEdge) {
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 18) {
        const angle = Math.atan2(dy, dx);
        const targetR = nb.radius || 3.0;
        const arrowDist = dist - (targetR + 3);
        const ax = na.x + Math.cos(angle) * arrowDist;
        const ay = na.y + Math.sin(angle) * arrowDist;
        const arrowSize = isEdgeHovered || isEdgeConnected || isSearchEdge ? 5.2 : 3.8;

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

  // 2. Draw Solid Half-Bright Nodes (Preserving Layer Palette)
  for (const n of simNodes) {
    if (n.x === undefined || n.y === undefined) continue;

    const matchesLayer = isLayerVisible(n.layer);
    if (!matchesLayer) continue;

    const isDirectMatch = hasSearch && matchingNodeIds.has(n.id);
    const isSearchNeighbor = hasSearch && searchNeighborNodeIds.has(n.id);
    const isClickConnected = activeId ? connectedNodeSet.has(n.id) : true;

    let opacity = 1.0;
    let isDimmed = false;

    if (hasSearch) {
      if (isDirectMatch) {
        opacity = 1.0;
      } else if (isSearchNeighbor) {
        opacity = 0.65;
      } else {
        opacity = 0.03;
        isDimmed = true;
      }
    } else if (activeId) {
      if (isClickConnected) {
        opacity = 1.0;
      } else {
        opacity = 0.05;
        isDimmed = true;
      }
    }

    const isCurrentActive = n.id === selectedNode?.id;
    const isCurrentHovered = n.id === hoveredNode?.id;
    const baseColor = LAYER_COLORS[n.layer] || DEFAULT_NODE_COLOR;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Node Circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Vibrant accent ring & halo on hover, active, or search match
    if (isDirectMatch) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
      ctx.shadowBlur = 10;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    } else if (isCurrentActive) {
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Proportional, 2-Liner Typography Below Node
    const showLabel =
      isDirectMatch ||
      isSearchNeighbor ||
      isCurrentActive ||
      isCurrentHovered ||
      (activeId && isClickConnected) ||
      (n.isHub && zoomLevel > 0.75) ||
      zoomLevel > 1.45;

    if (showLabel && !isDimmed) {
      let fontSize = 7.8;
      let fontWeight = '400';
      if (isDirectMatch) {
        fontSize = 11.5;
        fontWeight = '700';
      } else if (isCurrentActive || isCurrentHovered) {
        fontSize = 10.5;
        fontWeight = '600';
      } else if (n.radius >= 7.0) {
        fontSize = 10.0;
        fontWeight = '500';
      } else if (n.radius >= 5.0) {
        fontSize = 9.0;
        fontWeight = '500';
      }

      let fontColor = '#cbd5e1';
      if (isDirectMatch) {
        fontColor = '#ffffff';
      } else if (isCurrentActive || isCurrentHovered) {
        fontColor = '#f8fafc';
      } else if (n.type === 'column') {
        fontColor = '#94a3b8';
      }

      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const lines = wrapLabel(n.label, n.isHub ? 16 : 12);
      const lineHeight = fontSize * 1.25;
      const startY = n.y + n.radius + 3.5;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], n.x, startY + i * lineHeight);
      }
    }

    ctx.restore();
  }

  ctx.restore();
}
