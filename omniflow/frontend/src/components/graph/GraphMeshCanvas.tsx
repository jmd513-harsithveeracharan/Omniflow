import React, { useRef, useEffect, useState } from 'react';
import { GraphMeshNode, GraphMeshEdge } from '../../types';

interface SimNode extends GraphMeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
}

interface GraphMeshCanvasProps {
  nodes: GraphMeshNode[];
  edges: GraphMeshEdge[];
  selectedLayer: string;
  searchQuery: string;
  isPhysicsActive: boolean;
  selectedNode: GraphMeshNode | null;
  onSelectNode: (node: GraphMeshNode | null) => void;
  onHoverNode: (node: GraphMeshNode | null, clientPos: { x: number; y: number } | null) => void;
  onHoverEdge: (edge: GraphMeshEdge | null, clientPos: { x: number; y: number } | null) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  panOffset: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
}

// Obsidian-style refined palette: soft monochromatic & muted layer accents
const LAYER_COLORS: Record<string, string> = {
  source: '#34d399',     // soft mint
  bronze: '#fbbf24',     // soft amber
  silver: '#38bdf8',     // soft sky blue
  gold: '#facc15',       // soft gold
  bi: '#f472b6',         // soft rose
  warehouse: '#60a5fa',  // soft blue
  shared: '#a78bfa',     // soft lavender
};

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const GraphMeshCanvas: React.FC<GraphMeshCanvasProps> = ({
  nodes,
  edges,
  selectedLayer,
  searchQuery,
  isPhysicsActive,
  selectedNode,
  onSelectNode,
  onHoverNode,
  onHoverEdge,
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
  const [internalHoveredNode, setInternalHoveredNode] = useState<SimNode | null>(null);
  const [internalHoveredEdge, setInternalHoveredEdge] = useState<GraphMeshEdge | null>(null);

  // Initialize nodes in an organic Obsidian galaxy constellation
  useEffect(() => {
    const total = nodes.length;
    // Identify top connected nodes as central hubs (like 'Graph view' in Obsidian)
    const sorted = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const hubs = new Set(sorted.slice(0, Math.max(1, Math.min(3, Math.ceil(total * 0.1)))).map((n) => n.id));

    const simNodes: SimNode[] = nodes.map((n, idx) => {
      let r = 8.0;
      if (hubs.has(n.id)) r = 14.0;
      else if (n.type === 'table' || n.type === 'lakehouse' || n.type === 'warehouse') r = 10.0;
      else if (n.type === 'column') r = 5.0;

      // Radial galaxy distribution around center (0, 0)
      let initX = 0;
      let initY = 0;
      if (hubs.has(n.id)) {
        initX = (idx - (hubs.size - 1) / 2) * 60;
        initY = 0;
      } else {
        const angle = (idx / Math.max(1, total)) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 110 + (idx % 4) * 45 + (Math.random() - 0.5) * 30;
        initX = Math.cos(angle) * dist;
        initY = Math.sin(angle) * dist;
      }

      return {
        ...n,
        radius: r,
        x: initX,
        y: initY,
        vx: 0,
        vy: 0,
        targetX: initX,
        targetY: initY,
      };
    });

    simNodesRef.current = simNodes;
    alphaRef.current = 1.0; // Reset cooling energy
  }, [nodes]);

  // Main 60 FPS Physics & Obsidian Render Loop
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

      // Stable Organic Force Physics
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
            if (dist < 260) {
              const rep = 480 / (dist * dist + 700);
              const fx = (dx / dist) * rep * alpha;
              const fy = (dy / dist) * rep * alpha;
              na.vx -= fx;
              na.vy -= fy;
              nb.vx += fx;
              nb.vy += fy;
            }
          }
        }

        // Soft elastic springs on edges
        const nodeMap = new Map(sim.map((n) => [n.id, n]));
        for (const e of edges) {
          const na = nodeMap.get(e.source);
          const nb = nodeMap.get(e.target);
          if (na && nb) {
            const dx = nb.x - na.x;
            const dy = nb.y - na.y;
            const dist = Math.hypot(dx, dy) || 1;
            const idealDist = 95;
            const spring = (dist - idealDist) * 0.018 * alpha;
            const fx = (dx / dist) * spring;
            const fy = (dy / dist) * spring;
            na.vx += fx;
            na.vy += fy;
            nb.vx -= fx;
            nb.vy -= fy;
          }
        }

        // Damping, subtle center gravitation, and velocity clamping
        for (const n of sim) {
          if (n === draggedNodeRef.current) continue;
          n.vx -= n.x * 0.002 * alpha;
          n.vy -= n.y * 0.002 * alpha;
          n.vx = Math.max(-4.5, Math.min(4.5, n.vx * 0.85));
          n.vy = Math.max(-4.5, Math.min(4.5, n.vy * 0.85));
          n.x += n.vx;
          n.y += n.vy;
        }

        alphaRef.current *= 0.988; // Settle gracefully
      }

      // Camera Transform
      ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      const activeId = selectedNode?.id || internalHoveredNode?.id;
      const connectedNodeSet = new Set<string>();
      const connectedEdgeSet = new Set<string>();
      if (activeId) {
        connectedNodeSet.add(activeId);
        for (const e of edges) {
          if (e.source === activeId) {
            connectedNodeSet.add(e.target);
            connectedEdgeSet.add(e.id);
          }
          if (e.target === activeId) {
            connectedNodeSet.add(e.source);
            connectedEdgeSet.add(e.id);
          }
        }
      }

      // 1. Draw Obsidian Hairline Edges
      const nodeMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
      for (const e of edges) {
        const na = nodeMap.get(e.source);
        const nb = nodeMap.get(e.target);
        if (!na || !nb) continue;

        const isLayerVis = selectedLayer === 'all' || na.layer === selectedLayer || nb.layer === selectedLayer;
        if (!isLayerVis) continue;

        const isEdgeConnected = activeId ? connectedEdgeSet.has(e.id) : false;
        const isEdgeHovered = internalHoveredEdge?.id === e.id;
        const isDimmed = activeId && !isEdgeConnected && !isEdgeHovered;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);

        if (isEdgeHovered) {
          // Hovered edge: luminous vibrant cyan stroke
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
          ctx.shadowBlur = 8;
        } else if (isEdgeConnected) {
          // Connected to selected node: crisp silver-white
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
          ctx.lineWidth = 1.5;
        } else {
          // Default Obsidian edge: ultra-thin hairline
          ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 0.75;
        }

        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Obsidian Solid Circular Nodes
      for (const n of simNodesRef.current) {
        const matchesLayer = selectedLayer === 'all' || n.layer === selectedLayer;
        const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
        const isConnected = activeId ? connectedNodeSet.has(n.id) : true;
        const isDimmed = !matchesLayer || !matchesSearch || (activeId && !isConnected);
        const isCurrentActive = n.id === activeId;

        const baseColor = LAYER_COLORS[n.layer] || '#d1d5db';

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.08 : 1.0;

        // Active/connected node glow
        if (isCurrentActive) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
          ctx.shadowBlur = 14;
        }

        // Solid circular node (Obsidian graph style)
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentActive ? '#ffffff' : baseColor;
        ctx.fill();

        // 3. Crisp Obsidian Typography (Beside the node)
        const showLabel =
          n.radius >= 10.0 ||
          isCurrentActive ||
          (activeId && isConnected) ||
          zoomLevel > 1.25 ||
          (matchesSearch && searchQuery);

        if (showLabel) {
          ctx.shadowBlur = 0;
          ctx.font = `${isCurrentActive ? '600 11px' : '400 10.5px'} -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.fillStyle = isCurrentActive ? '#ffffff' : isDimmed ? 'rgba(255, 255, 255, 0.2)' : 'rgba(226, 232, 240, 0.9)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.label, n.x + n.radius + 6, n.y);
        }

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [edges, selectedLayer, searchQuery, isPhysicsActive, selectedNode, internalHoveredNode, internalHoveredEdge, zoomLevel, panOffset]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    onZoomChange(Math.max(0.3, Math.min(3.2, zoomLevel * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    // Check if clicked a node
    const clicked = simNodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.radius + 5);
    if (clicked) {
      draggedNodeRef.current = clicked;
      alphaRef.current = 0.2;
      // Toggle node selection: if clicking the already selected node, deselect
      if (selectedNode?.id === clicked.id) {
        onSelectNode(null);
      } else {
        onSelectNode(clicked);
      }
    } else {
      // Clicked empty canvas: clear selection
      onSelectNode(null);
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (draggedNodeRef.current) {
      const mx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
      const my = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;
      draggedNodeRef.current.x = mx;
      draggedNodeRef.current.y = my;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      alphaRef.current = 0.2;
      return;
    }

    if (isDraggingCanvasRef.current) {
      const dx = clientX - lastMousePosRef.current.x;
      const dy = clientY - lastMousePosRef.current.y;
      onPanChange({ x: panOffset.x + dx, y: panOffset.y + dy });
      lastMousePosRef.current = { x: clientX, y: clientY };
      return;
    }

    // Hover Detection
    const mx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    // 1. Check Node Hover first
    const hoveredNode = simNodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.radius + 4) || null;
    setInternalHoveredNode(hoveredNode);
    if (hoveredNode) {
      onHoverNode(hoveredNode, { x: clientX, y: clientY });
      setInternalHoveredEdge(null);
      onHoverEdge(null, null);
      return;
    } else {
      onHoverNode(null, null);
    }

    // 2. Check Edge Hover (distance to edge segment)
    const nodeMap = new Map(simNodesRef.current.map((n) => [n.id, n]));
    const threshold = 6 / zoomLevel;
    let foundEdge: GraphMeshEdge | null = null;

    for (const edge of edges) {
      const na = nodeMap.get(edge.source);
      const nb = nodeMap.get(edge.target);
      if (!na || !nb) continue;
      const d = distToSegment(mx, my, na.x, na.y, nb.x, nb.y);
      if (d <= threshold) {
        foundEdge = edge;
        break;
      }
    }

    setInternalHoveredEdge(foundEdge);
    if (foundEdge) {
      onHoverEdge(foundEdge, { x: clientX, y: clientY });
    } else {
      onHoverEdge(null, null);
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
      onMouseLeave={() => {
        handleMouseUp();
        onHoverNode(null, null);
        onHoverEdge(null, null);
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: '#111111' }}
    />
  );
};
