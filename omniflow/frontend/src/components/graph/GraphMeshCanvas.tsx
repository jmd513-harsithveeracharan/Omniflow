import React, { useRef, useEffect, useState } from 'react';
import { GraphMeshNode, GraphMeshEdge } from '../../types';

interface SimNode extends GraphMeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
}

interface GraphMeshCanvasProps {
  nodes: GraphMeshNode[];
  edges: GraphMeshEdge[];
  selectedLayer: string;
  searchQuery: string;
  isPhysicsActive: boolean;
  selectedNode: GraphMeshNode | null;
  onSelectNode: (node: GraphMeshNode | null) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  panOffset: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
}

const LAYER_COLORS: Record<string, string> = {
  source: '#10b981',
  bronze: '#f59e0b',
  silver: '#06b6d4',
  gold: '#eab308',
  bi: '#ec4899',
  warehouse: '#3b82f6',
  shared: '#a855f7',
};

const LAYER_X_OFFSETS: Record<string, number> = {
  source: -420,
  bronze: -210,
  silver: 0,
  gold: 210,
  warehouse: 260,
  bi: 440,
  shared: -100,
};

export const GraphMeshCanvas: React.FC<GraphMeshCanvasProps> = ({
  nodes,
  edges,
  selectedLayer,
  searchQuery,
  isPhysicsActive,
  selectedNode,
  onSelectNode,
  zoomLevel,
  onZoomChange,
  panOffset,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const alphaRef = useRef<number>(1.0);
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<SimNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);

  // Initialize nodes into clean, structured Medallion columns
  useEffect(() => {
    const layerGroups: Record<string, GraphMeshNode[]> = {};
    nodes.forEach((n) => {
      const l = n.layer || 'shared';
      if (!layerGroups[l]) layerGroups[l] = [];
      layerGroups[l].push(n);
    });

    const tablePosMap = new Map<string, { x: number; y: number }>();
    Object.entries(layerGroups).forEach(([layer, group]) => {
      const baseX = LAYER_X_OFFSETS[layer] ?? 0;
      const count = group.length;
      const spacing = Math.max(48, Math.min(84, 460 / Math.max(1, count)));
      group.forEach((node, idx) => {
        const y = (idx - (count - 1) / 2) * spacing;
        tablePosMap.set(node.id, { x: baseX, y });
      });
    });

    const colIndexMap = new Map<string, number>();
    const simNodes: SimNode[] = nodes.map((n) => {
      let x = 0;
      let y = 0;
      const targetX = LAYER_X_OFFSETS[n.layer] ?? 0;

      if (n.parent_id && tablePosMap.has(n.parent_id)) {
        const pPos = tablePosMap.get(n.parent_id)!;
        const idx = colIndexMap.get(n.parent_id) || 0;
        colIndexMap.set(n.parent_id, idx + 1);
        const angle = (idx / 8) * Math.PI * 2;
        const r = 36 + (idx % 2) * 14;
        x = pPos.x + Math.cos(angle) * r;
        y = pPos.y + Math.sin(angle) * r;
      } else if (tablePosMap.has(n.id)) {
        const pos = tablePosMap.get(n.id)!;
        x = pos.x + (Math.random() - 0.5) * 16;
        y = pos.y + (Math.random() - 0.5) * 16;
      } else {
        x = targetX + (Math.random() - 0.5) * 40;
        y = (Math.random() - 0.5) * 200;
      }
      return { ...n, x, y, vx: 0, vy: 0, targetX };
    });

    simNodesRef.current = simNodes;
    alphaRef.current = 1.0; // Reset cooling energy
  }, [nodes]);

  // Main 60 FPS Physics & Render Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Stable Plummer Force Simulation
      if (isPhysicsActive && alphaRef.current > 0.008) {
        const alpha = alphaRef.current;
        const sim = simNodesRef.current;
        const count = sim.length;

        // Bounded repulsion with softening radius
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const na = sim[i];
            const nb = sim[j];
            let dx = nb.x - na.x;
            let dy = nb.y - na.y;
            if (Math.abs(dx) < 0.01) dx = (Math.random() - 0.5) * 4;
            const dist = Math.hypot(dx, dy) || 1;
            const softDistSq = dist * dist + 625; // Plummer softening
            const rep = (na.type === 'column' && nb.type === 'column' ? 400 : 950) / softDistSq;
            const fx = (dx / dist) * rep * alpha;
            const fy = (dy / dist) * rep * alpha;
            na.vx -= fx;
            na.vy -= fy;
            nb.vx += fx;
            nb.vy += fy;
          }
        }

        // Soft Hooke spring on active edges
        const nodeMap = new Map(sim.map((n) => [n.id, n]));
        for (const e of edges) {
          const na = nodeMap.get(e.source);
          const nb = nodeMap.get(e.target);
          if (na && nb) {
            let dx = nb.x - na.x;
            let dy = nb.y - na.y;
            if (Math.abs(dx) < 0.01) dx = (Math.random() - 0.5) * 2;
            const dist = Math.hypot(dx, dy) || 1;
            const idealDist = e.relationship === 'CONTAINS' ? 38 : 105;
            const spring = (dist - idealDist) * 0.022 * alpha;
            const fx = (dx / dist) * spring;
            const fy = (dy / dist) * spring;
            na.vx += fx;
            na.vy += fy;
            nb.vx -= fx;
            nb.vy -= fy;
          }
        }

        // Medallion column anchor & velocity clamping
        for (const n of sim) {
          if (n === draggedNodeRef.current) continue;
          n.vx += (n.targetX - n.x) * 0.012 * alpha;
          n.vy -= n.y * 0.005 * alpha;
          // Strict velocity clamping prevents explosions
          n.vx = Math.max(-5.0, Math.min(5.0, n.vx * 0.82));
          n.vy = Math.max(-5.0, Math.min(5.0, n.vy * 0.82));
          n.x += n.vx;
          n.y += n.vy;
        }

        alphaRef.current *= 0.988; // Cool down smoothly
      }

      // Camera Transform
      ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      // Draw faint blueprint background grid
      const gridSize = 40;
      const viewLeft = (-w / 2 - panOffset.x) / zoomLevel;
      const viewRight = (w / 2 - panOffset.x) / zoomLevel;
      const viewTop = (-h / 2 - panOffset.y) / zoomLevel;
      const viewBottom = (h / 2 - panOffset.y) / zoomLevel;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      const startX = Math.floor(viewLeft / gridSize) * gridSize;
      const startY = Math.floor(viewTop / gridSize) * gridSize;
      for (let x = startX; x < viewRight; x += gridSize) {
        for (let y = startY; y < viewBottom; y += gridSize) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      const activeId = selectedNode?.id || hoveredNode?.id;
      const connectedSet = new Set<string>();
      if (activeId) {
        connectedSet.add(activeId);
        for (const e of edges) {
          if (e.source === activeId) connectedSet.add(e.target);
          if (e.target === activeId) connectedSet.add(e.source);
        }
      }

      // Draw Edges
      const nodeMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
      for (const e of edges) {
        const na = nodeMap.get(e.source);
        const nb = nodeMap.get(e.target);
        if (!na || !nb) continue;

        const isLayerVis = selectedLayer === 'all' || na.layer === selectedLayer || nb.layer === selectedLayer;
        if (!isLayerVis) continue;

        const isHighlighted = activeId ? connectedSet.has(na.id) && connectedSet.has(nb.id) : true;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);

        if (e.relationship === 'JOINS_WITH') {
          ctx.strokeStyle = isHighlighted ? 'rgba(236, 72, 153, 0.85)' : 'rgba(236, 72, 153, 0.15)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = isHighlighted ? 2.0 : 0.8;
        } else {
          ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.65)' : 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = isHighlighted ? 1.6 : 0.7;
        }
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(nb.y - na.y, nb.x - na.x);
        const arrowDist = nb.radius + 4;
        const arrowX = nb.x - Math.cos(angle) * arrowDist;
        const arrowY = nb.y - Math.sin(angle) * arrowDist;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 5 * Math.cos(angle - Math.PI / 6), arrowY - 5 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 5 * Math.cos(angle + Math.PI / 6), arrowY - 5 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw Nodes
      for (const n of simNodesRef.current) {
        const matchesLayer = selectedLayer === 'all' || n.layer === selectedLayer;
        const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
        const isDimmed = (activeId && !connectedSet.has(n.id)) || !matchesLayer || !matchesSearch;
        const baseColor = LAYER_COLORS[n.layer] || '#94a3b8';

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

        // Glow ring for active/searched node
        if (n.id === activeId || (matchesSearch && searchQuery)) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 7, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = 0.22;
          ctx.fill();
          ctx.globalAlpha = isDimmed ? 0.15 : 1.0;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.type === 'column' ? '#0f172a' : baseColor;
        ctx.fill();
        ctx.lineWidth = n.type === 'column' ? 1.2 : 2.0;
        ctx.strokeStyle = baseColor;
        ctx.stroke();

        if (n.is_primary_key) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const showLabel = n.radius >= 11 || n.id === activeId || zoomLevel > 1.2 || (matchesSearch && searchQuery);
        if (showLabel) {
          ctx.font = `${n.radius >= 15 ? '600 11px' : '500 9px'} -apple-system, sans-serif`;
          ctx.fillStyle = '#f1f5f9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(n.label, n.x, n.y + n.radius + 4);
        }
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [edges, selectedLayer, searchQuery, isPhysicsActive, selectedNode, hoveredNode, zoomLevel, panOffset]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    onZoomChange(Math.max(0.3, Math.min(3.0, zoomLevel * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    const clicked = simNodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.radius + 4);
    if (clicked) {
      draggedNodeRef.current = clicked;
      alphaRef.current = 0.25;
      onSelectNode(clicked);
    } else {
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (draggedNodeRef.current) {
      const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
      const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      alphaRef.current = 0.25;
    } else if (isDraggingCanvasRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      onPanChange({ x: panOffset.x + dx, y: panOffset.y + dy });
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
      const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;
      const hovered = simNodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.radius + 4) || null;
      setHoveredNode(hovered);
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingCanvasRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: '#090d16' }}
    />
  );
};
