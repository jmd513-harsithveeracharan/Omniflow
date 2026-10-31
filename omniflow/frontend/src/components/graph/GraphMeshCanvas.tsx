import React, { useRef, useEffect, useState } from 'react';
import { GraphMeshNode, GraphMeshEdge } from '../../types';

interface SimNode extends GraphMeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

export const GraphMeshCanvas: React.FC<GraphMeshCanvasProps> = ({
  nodes,
  edges,
  selectedLayer,
  searchQuery,
  isPhysicsActive,
  selectedNode,
  onSelectNode,
  zoomLevel,
  panOffset,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<SimNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);

  // Initialize node positions circularly
  useEffect(() => {
    const total = nodes.length;
    const simNodes: SimNode[] = nodes.map((n, i) => {
      const angle = (i / total) * Math.PI * 2;
      const dist = 140 + (n.type === 'column' ? 120 : 0) + Math.random() * 80;
      return {
        ...n,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
      };
    });
    simNodesRef.current = simNodes;
  }, [nodes]);

  // Main Physics & Render Animation Loop
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

      // Force Physics Step
      if (isPhysicsActive) {
        const sim = simNodesRef.current;
        const count = sim.length;
        // 1. Repulsion between all node pairs
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const na = sim[i];
            const nb = sim[j];
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 350) {
              const rep = 800 / (dist * dist);
              const fx = (dx / dist) * rep;
              const fy = (dy / dist) * rep;
              na.vx -= fx;
              na.vy -= fy;
              nb.vx += fx;
              nb.vy += fy;
            }
          }
        }

        // 2. Spring Hooke attraction along edges
        const nodeMap = new Map(sim.map((n) => [n.id, n]));
        for (const e of edges) {
          const na = nodeMap.get(e.source);
          const nb = nodeMap.get(e.target);
          if (na && nb) {
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.hypot(dx, dy) || 1;
            const idealDist = e.relationship === 'CONTAINS' ? 45 : 120;
            const spring = (dist - idealDist) * 0.008;
            const fx = (dx / dist) * spring;
            const fy = (dy / dist) * spring;
            na.vx += fx;
            na.vy += fy;
            nb.vx -= fx;
            nb.vy -= fy;
          }
        }

        // 3. Center gravity & velocity damping
        for (const n of sim) {
          if (n === draggedNodeRef.current) continue;
          n.vx -= n.x * 0.002;
          n.vy -= n.y * 0.002;
          n.vx *= 0.86;
          n.vy *= 0.86;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      // Camera Transform
      ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      // Connected nodes set for selective highlighting
      const activeId = selectedNode?.id || hoveredNode?.id;
      const connectedSet = new Set<string>();
      if (activeId) {
        connectedSet.add(activeId);
        for (const e of edges) {
          if (e.source === activeId) connectedSet.add(e.target);
          if (e.target === activeId) connectedSet.add(e.source);
        }
      }

      // Draw Edges with Directional Arrows
      const nodeMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
      for (const e of edges) {
        const na = nodeMap.get(e.source);
        const nb = nodeMap.get(e.target);
        if (!na || !nb) continue;

        const isLayerVisible =
          selectedLayer === 'all' || na.layer === selectedLayer || nb.layer === selectedLayer;
        if (!isLayerVisible) continue;

        const isHighlighted = activeId ? connectedSet.has(na.id) && connectedSet.has(nb.id) : true;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);

        if (e.relationship === 'JOINS_WITH') {
          ctx.strokeStyle = isHighlighted ? 'rgba(236, 72, 153, 0.7)' : 'rgba(236, 72, 153, 0.15)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = isHighlighted ? 1.8 : 0.8;
        } else {
          ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.5)' : 'rgba(100, 116, 139, 0.15)';
          ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
        }
        ctx.stroke();

        // Directional Arrowhead
        const angle = Math.atan2(nb.y - na.y, nb.x - na.x);
        const arrowDist = nb.radius + 6;
        const arrowX = nb.x - Math.cos(angle) * arrowDist;
        const arrowY = nb.y - Math.sin(angle) * arrowDist;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 6 * Math.cos(angle - Math.PI / 6), arrowY - 6 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 6 * Math.cos(angle + Math.PI / 6), arrowY - 6 * Math.sin(angle + Math.PI / 6));
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
        ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

        // Outer Glow for Selected or Hovered
        if (n.id === activeId || matchesSearch && searchQuery) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = isDimmed ? 0.2 : 1.0;
        }

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.type === 'column' ? '#0f172a' : baseColor;
        ctx.fill();
        ctx.lineWidth = n.type === 'column' ? 1.5 : 2;
        ctx.strokeStyle = baseColor;
        ctx.stroke();

        // PK / FK Indicator Rings
        if (n.is_primary_key) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Node Label Typography
        if (n.radius >= 10 || n.id === activeId || zoomLevel > 1.2 || (matchesSearch && searchQuery)) {
          ctx.font = `${n.radius >= 14 ? 'bold 11px' : '9px'} sans-serif`;
          ctx.fillStyle = '#f8fafc';
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

  // Mouse & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    const clicked = simNodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.radius + 4);
    if (clicked) {
      draggedNodeRef.current = clicked;
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: 'radial-gradient(circle at center, #0f172a 0%, #060913 100%)' }}
    />
  );
};
