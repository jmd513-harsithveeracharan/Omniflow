import { D3SimNode, D3SimLink } from './graphSimulation';
import { GraphMeshNode } from '../../types';
import {
  getLayerColor,
  isSchemaContainerNode,
  traceNodeOutline,
  wrapLabel,
} from './graphTheme';
export { LAYER_COLORS, DEFAULT_NODE_COLOR, getLayerColor, wrapLabel } from './graphTheme';

export interface RenderGraphOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  simNodes: D3SimNode[];
  simLinks: D3SimLink[];
  selectedNode: GraphMeshNode | null;
  hoveredNode?: GraphMeshNode | null;
  activeFocalNode?: GraphMeshNode | null;
  hoveredEdgeId: string | null;
  selectedLayer?: string;
  selectedLayers?: string[] | string;
  searchQuery: string;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  focusProgress?: number;
}

export function renderGraphMesh(opts: RenderGraphOptions): void {
  const {
    ctx, width: w, height: h, simNodes, simLinks, selectedNode,
    hoveredNode = null, activeFocalNode, hoveredEdgeId, searchQuery,
    zoomLevel, panOffset, focusProgress,
  } = opts;

  const isLayerVisible = (layer: string) => {
    const layers = opts.selectedLayers ?? opts.selectedLayer ?? 'all';
    return Array.isArray(layers) ? layers.includes('all') || layers.includes(layer) : layers === 'all' || layers === layer;
  };

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);

  // Viewport Frustum Culling bounds with safety padding for labels & halos
  const pad = 65 / Math.max(0.2, zoomLevel);
  const minX = (-w / 2 - panOffset.x) / zoomLevel - pad;
  const maxX = (w / 2 - panOffset.x) / zoomLevel + pad;
  const minY = (-h / 2 - panOffset.y) / zoomLevel - pad;
  const maxY = (h / 2 - panOffset.y) / zoomLevel + pad;

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

  const activeNode = activeFocalNode !== undefined ? activeFocalNode : (selectedNode || hoveredNode || null);
  const activeId = activeNode?.id || null;
  const connectedNodeSet = new Set<string>();
  const connectedEdgeSet = new Set<string>();
  const rawT = focusProgress !== undefined ? focusProgress : (activeId ? 1.0 : 0.0);
  const t = Math.max(0.0, Math.min(1.0, rawT * rawT * (3 - 2 * rawT)));

  if (activeId && !hasSearch) {
    connectedNodeSet.add(activeId);
    for (const link of simLinks) {
      if (link.source.id === activeId) {
        connectedNodeSet.add(link.target.id); connectedEdgeSet.add(link.id);
      } else if (link.target.id === activeId) {
        connectedNodeSet.add(link.source.id); connectedEdgeSet.add(link.id);
      }
    }
  }

  // 1. Draw Directional Lineage Edges (with Frustum Culling)
  for (const link of simLinks) {
    const na = link.source;
    const nb = link.target;
    if (na.x === undefined || na.y === undefined || nb.x === undefined || nb.y === undefined) continue;

    const naX = na.x, naY = na.y, nbX = nb.x, nbY = nb.y;
    // Frustum Cull: Skip link if both endpoints are entirely offscreen on same quadrant
    if ((naX < minX && nbX < minX) || (naX > maxX && nbX > maxX) || (naY < minY && nbY < minY) || (naY > maxY && nbY > maxY)) {
      continue;
    }

    if (!isLayerVisible(na.layer) && !isLayerVisible(nb.layer)) continue;
    if (hasSearch && !searchConnectedEdgeIds.has(link.id)) continue;

    const isEdgeHovered = hoveredEdgeId === link.id;
    const isEdgeConnected = !hasSearch && activeId ? connectedEdgeSet.has(link.id) : false;
    const isSearchEdge = hasSearch && searchConnectedEdgeIds.has(link.id);
    const isFlowEdge = link.relationship !== 'CONTAINS';

    let strokeColor = '';
    let lineWidth = 0.85;
    let hasGlow = false;

    if (isEdgeHovered) {
      strokeColor = '#f4f4f5';
      lineWidth = 2.0;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
      ctx.shadowBlur = 8;
      hasGlow = true;
    } else if (hasSearch) {
      strokeColor = isSearchEdge ? 'rgba(244, 244, 245, 0.75)' : '';
      lineWidth = 1.35;
    } else if (isEdgeConnected) {
      const alpha = 0.28 + t * 0.50;
      lineWidth = 0.85 + t * 0.55;
      strokeColor = `rgba(244, 244, 245, ${alpha.toFixed(3)})`;
      if (t > 0.25) {
        ctx.shadowColor = `rgba(255, 255, 255, ${(t * 0.25).toFixed(3)})`;
        ctx.shadowBlur = t * 4;
        hasGlow = true;
      }
    } else if (isFlowEdge) {
      lineWidth = 0.85 - t * 0.30;
      strokeColor = `rgba(161, 161, 170, ${(0.28 - t * 0.21).toFixed(3)})`;
    } else {
      lineWidth = 0.65;
      strokeColor = `rgba(255, 255, 255, ${(0.13 - t * 0.08).toFixed(3)})`;
    }
    if (!strokeColor) continue;

    ctx.beginPath();
    ctx.moveTo(naX, naY);
    ctx.lineTo(nbX, nbY);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (hasGlow) {
      ctx.shadowBlur = 0;
    }

    // Directional Arrowhead for data flows
    if (isFlowEdge) {
      const dx = nbX - naX;
      const dy = nbY - naY;
      const dist = Math.hypot(dx, dy);
      if (dist > 18) {
        const angle = Math.atan2(dy, dx);
        const targetR = nb.radius || 3.0;
        const arrowDist = dist - (targetR + 3);
        const ax = naX + Math.cos(angle) * arrowDist;
        const ay = naY + Math.sin(angle) * arrowDist;
        const arrowSize = isEdgeHovered ? 5.2 : isEdgeConnected ? 3.8 + t * 1.4 : Math.max(2.5, 3.8 - t * 1.0);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(angle - Math.PI / 6) * arrowSize, ay - Math.sin(angle - Math.PI / 6) * arrowSize);
        ctx.lineTo(ax - Math.cos(angle + Math.PI / 6) * arrowSize, ay - Math.sin(angle + Math.PI / 6) * arrowSize);
        ctx.closePath();
        ctx.fillStyle = strokeColor;
        ctx.fill();
      }
    }
  }

  // 2. Draw Nodes (with Frustum Culling & Memoized Labels)
  for (const n of simNodes) {
    if (n.x === undefined || n.y === undefined) continue;

    // Frustum Cull: Skip node if outside camera frustum (unless active or searched)
    if (
      (n.x < minX || n.x > maxX || n.y < minY || n.y > maxY) &&
      n.id !== activeId && n.id !== hoveredNode?.id && !matchingNodeIds.has(n.id)
    ) {
      continue;
    }

    if (!isLayerVisible(n.layer)) continue;

    const isDirectMatch = hasSearch && matchingNodeIds.has(n.id);
    const isSearchNeighbor = hasSearch && searchNeighborNodeIds.has(n.id);
    const isClickConnected = activeId ? connectedNodeSet.has(n.id) : true;

    let opacity = 1.0;
    if (hasSearch) {
      opacity = isDirectMatch ? 1.0 : isSearchNeighbor ? 0.65 : 0.03;
    } else if (activeId) {
      opacity = isClickConnected ? 1.0 : 1.0 - t * 0.78;
    }

    const isCurrentActive = n.id === selectedNode?.id;
    const isCurrentHovered = n.id === hoveredNode?.id;
    const baseColor = getLayerColor(n.layer);

    ctx.globalAlpha = Math.max(0.04, opacity);

    // Node Shape: Schema/Container = Big Circle, Table = Square, Column = Small Circle
    traceNodeOutline(ctx, n.type, n.x, n.y, n.radius);
    ctx.fillStyle = baseColor;
    ctx.fill();

    if (isSchemaContainerNode(n.type)) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.lineWidth = 1.0;
      ctx.stroke();
    } else if (n.type === 'table') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }

    // Vibrant accent outline & halo matching node shape on hover, active, or search match
    if (isDirectMatch) {
      traceNodeOutline(ctx, n.type, n.x, n.y, n.radius + 4.5);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
      ctx.shadowBlur = 10;
      ctx.stroke();

      traceNodeOutline(ctx, n.type, n.x, n.y, n.radius + 1.8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (isCurrentActive) {
      traceNodeOutline(ctx, n.type, n.x, n.y, n.radius + 3.2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if ((isCurrentHovered || (n.id === activeId && !selectedNode)) && t > 0.02) {
      const ringExpand = 1.0 + t * 2.2;
      const ringAlpha = Math.min(1.0, t * 0.9);
      const blurAmount = t * 8.0;

      traceNodeOutline(ctx, n.type, n.x, n.y, n.radius + ringExpand);
      ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = 1.1 + t * 0.4;
      if (blurAmount > 1) {
        ctx.shadowColor = `rgba(255, 255, 255, ${(t * 0.4).toFixed(3)})`;
        ctx.shadowBlur = blurAmount;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Proportional Typography Below Node (LOD Throttling)
    const showLabel =
      isDirectMatch || isSearchNeighbor || isCurrentActive || isCurrentHovered ||
      (activeId && isClickConnected) || (n.isHub && zoomLevel > 0.70) || zoomLevel > 1.40;

    if (showLabel) {
      const fontSize = isDirectMatch ? 11.5 : (isCurrentActive || isCurrentHovered) ? 10.5 : n.radius >= 7.0 ? 10.0 : n.radius >= 5.0 ? 9.0 : 7.8;
      const fontWeight = isDirectMatch ? '700' : (isCurrentActive || isCurrentHovered) ? '600' : n.radius >= 5.0 ? '500' : '400';
      const fontColor = isDirectMatch ? '#ffffff' : (isCurrentActive || isCurrentHovered) ? '#f8fafc' : n.type === 'column' ? '#94a3b8' : '#cbd5e1';

      const textDimAlpha = activeId && !isClickConnected ? Math.max(0.12, 1.0 - t * 0.88) : 1.0;
      ctx.globalAlpha = textDimAlpha * opacity;
      ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const lines = n._wrappedLines || wrapLabel(n.label, n.isHub ? 16 : 12);
      const lineHeight = fontSize * 1.25;
      const startY = n.y + n.radius + 3.5;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], n.x, startY + i * lineHeight);
      }
    }
  }
  ctx.restore();
}
