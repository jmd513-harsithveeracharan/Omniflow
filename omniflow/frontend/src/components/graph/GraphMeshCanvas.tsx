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
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<SimNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);

  // Initialize nodes with planetary orbit layout matching Obsidian galaxy style
  useEffect(() => {
    const tableNodes = nodes.filter((n) => n.type === 'table' || n.type === 'lakehouse' || n.type === 'source');
    const tablePosMap = new Map<string, { x: number; y: number }>();

    tableNodes.forEach((t, i) => {
      let baseAngle = (i / Math.max(1, tableNodes.length)) * Math.PI * 2;
      if (t.layer === 'source') baseAngle = -Math.PI * 0.8;
      else if (t.layer === 'bronze') baseAngle = -Math.PI * 0.4 + (i * 0.2);
      else if (t.layer === 'silver') baseAngle = Math.PI * 0.3 + (i * 0.2);
      else if (t.layer === 'gold') baseAngle = Math.PI * 0.8 + (i * 0.2);

      const clusterDist = t.type === 'source' ? 320 : t.type === 'lakehouse' ? 240 : 180;
      tablePosMap.set(t.id, {
        x: Math.cos(baseAngle) * clusterDist + (Math.random() - 0.5) * 40,
        y: Math.sin(baseAngle) * clusterDist + (Math.random() - 0.5) * 40,
      });
    });

    const colIndexMap = new Map<string, number>();
    const simNodes: SimNode[] = nodes.map((n) => {
      let x = 0;
      let y = 0;
      if (tablePosMap.has(n.id)) {
        const pos = tablePosMap.get(n.id)!;
        x = pos.x;
        y = pos.y;
      } else if (n.parent_id && tablePosMap.has(n.parent_id)) {
        const parentPos = tablePosMap.get(n.parent_id)!;
        const idx = colIndexMap.get(n.parent_id) || 0;
        colIndexMap.set(n.parent_id, idx + 1);
        const colAngle = (idx / 6) * Math.PI * 2;
        const orbitRadius = 42 + (idx % 2) * 16;
        x = parentPos.x + Math.cos(colAngle) * orbitRadius;
        y = parentPos.y + Math.sin(colAngle) * orbitRadius;
      } else {
        const rndAngle = Math.random() * Math.PI * 2;
        const rndDist = 120 + Math.random() * 150;
        x = Math.cos(rndAngle) * rndDist;
        y = Math.sin(rndAngle) * rndDist;
      }
      return { ...n, x, y, vx: 0, vy: 0 };
    });
    simNodesRef.current = simNodes;
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

      // Force Physics Step
      if (isPhysicsActive) {
        const sim = simNodesRef.current;
        const count = sim.length;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const na = sim[i];
            const nb = sim[j];
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.hypot(dx, dy) || 1;
            const minDist = na.parent_id === nb.parent_id ? 100 : 260;
            if (dist < minDist) {
              const rep = (na.type === 'column' && nb.type === 'column' ? 350 : 750) / (dist * dist);
              const fx = (dx / dist) * rep;
              const fy = (dy / dist) * rep;
              na.vx -= fx;
              na.vy -= fy;
              nb.vx += fx;
              nb.vy += fy;
            }
          }
        }

        const nodeMap = new Map(sim.map((n) => [n.id, n]));
        for (const e of edges) {
          const na = nodeMap.get(e.source);
          const nb = nodeMap.get(e.target);
          if (na && nb) {
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.hypot(dx, dy) || 1;
            const idealDist = e.relationship === 'CONTAINS' ? 44 : 115;
            const spring = (dist - idealDist) * 0.007;
            const fx = (dx / dist) * spring;
            const fy = (dy / dist) * spring;
            na.vx += fx;
            na.vy += fy;
            nb.vx -= fx;
            nb.vy -= fy;
          }
        }

        for (const n of sim) {
          if (n === draggedNodeRef.current) continue;
          n.vx -= n.x * 0.0018;
          n.vy -= n.y * 0.0018;
          n.vx *= 0.88;
          n.vy *= 0.88;
          n.x += n.vx;
          n.y += n.vy;
        }
      }

      ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

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

        const isLayerVisible = selectedLayer === 'all' || na.layer === selectedLayer || nb.layer === selectedLayer;
        if (!isLayerVisible) continue;

        const isHighlighted = activeId ? connectedSet.has(na.id) && connectedSet.has(nb.id) : true;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);

        if (e.relationship === 'JOINS_WITH') {
          ctx.strokeStyle = isHighlighted ? 'rgba(236, 72, 153, 0.75)' : 'rgba(236, 72, 153, 0.15)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = isHighlighted ? 1.8 : 0.8;
        } else {
          ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.55)' : 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = isHighlighted ? 1.4 : 0.7;
        }
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(nb.y - na.y, nb.x - na.x);
        const arrowDist = nb.radius + 5;
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
        ctx.globalAlpha = isDimmed ? 0.18 : 1.0;

        if (n.id === activeId || (matchesSearch && searchQuery)) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = 0.25;
          ctx.fill();
          ctx.globalAlpha = isDimmed ? 0.18 : 1.0;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.type === 'column' ? '#0b1120' : baseColor;
        ctx.fill();
        ctx.lineWidth = n.type === 'column' ? 1.4 : 2;
        ctx.strokeStyle = baseColor;
        ctx.stroke();

        if (n.is_primary_key) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const shouldShowLabel = n.radius >= 11 || n.id === activeId || zoomLevel > 1.2 || (matchesSearch && searchQuery);
        if (shouldShowLabel) {
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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.3, Math.min(3.0, zoomLevel * factor));
    onZoomChange(newZoom);
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
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: 'radial-gradient(circle at center, #0f172a 0%, #060913 100%)' }}
    />
  );
};
