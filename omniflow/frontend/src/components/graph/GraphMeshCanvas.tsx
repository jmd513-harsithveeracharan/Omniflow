import React, { useRef, useEffect, useState } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceCenter,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';

export interface D3SimNode extends SimulationNodeDatum, GraphMeshNode {
  id: string;
  radius: number;
  collisionRadius: number;
}

export interface D3SimLink extends SimulationLinkDatum<D3SimNode> {
  id: string;
  source: D3SimNode;
  target: D3SimNode;
  relationship: 'FEEDS' | 'CONTAINS' | 'TRANSFORMS_TO' | 'JOINS_WITH' | 'AGGREGATES' | 'DEPENDS_ON';
  description?: string | null;
}

interface GraphMeshCanvasProps {
  nodes: GraphMeshNode[];
  edges: GraphMeshEdge[];
  selectedLayer: string;
  searchQuery: string;
  isPhysicsActive: boolean;
  selectedNode: GraphMeshNode | null;
  onSelectNode: (node: GraphMeshNode | null) => void;
  onHoverHighlightedEdge: (edge: GraphMeshEdge | null, clientPos: { x: number; y: number } | null) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  panOffset: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
}

// Lively, brighter Obsidian colors matching reference screenshots
const LAYER_COLORS: Record<string, string> = {
  source: '#10b981',     // vibrant emerald
  bronze: '#f59e0b',     // vibrant amber
  silver: '#06b6d4',     // vibrant cyan
  gold: '#eab308',       // vibrant gold
  bi: '#ec4899',         // vibrant rose/pink
  warehouse: '#3b82f6',  // vibrant blue
  shared: '#a855f7',     // vibrant purple
};

const DEFAULT_NODE_COLOR = '#94a3b8';

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
  onHoverHighlightedEdge,
  zoomLevel,
  onZoomChange,
  panOffset,
  onPanChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationRef = useRef<Simulation<D3SimNode, D3SimLink> | null>(null);
  const simNodesRef = useRef<D3SimNode[]>([]);
  const simLinksRef = useRef<D3SimLink[]>([]);
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<D3SimNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  // Intercept Ctrl + Scroll and Wheel natively to prevent full-page browser zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.25, Math.min(3.5, zoomLevelRef.current * factor));
      onZoomChange(newZoom);
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [onZoomChange]);

  // Initialize D3 Force Simulation with unified Node + Text pair physics
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const total = nodes.length;
    const sorted = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const hubs = new Set(sorted.slice(0, Math.max(1, Math.min(4, Math.ceil(total * 0.1)))).map((n) => n.id));

    // Unified Node + Text Collision Geometry
    const simNodes: D3SimNode[] = nodes.map((n, idx) => {
      let r = 5.0; // standard node
      if (hubs.has(n.id)) r = 8.0; // hub node
      else if (n.type === 'column') r = 3.2; // column leaf

      const labelLen = (n.label || '').length;
      // Text centered beneath node: half-width estimation
      const textHalfWidth = Math.min(65, Math.max(12, labelLen * 2.8));
      // Unified pair collision radius prevents text from crossing other nodes
      const collisionRadius = Math.max(r + 14, textHalfWidth + 6);

      const angle = (idx / Math.max(1, total)) * Math.PI * 2;
      const dist = 70 + (idx % 6) * 40;
      return {
        ...n,
        radius: r,
        collisionRadius,
        x: Math.cos(angle) * dist + (Math.random() - 0.5) * 20,
        y: Math.sin(angle) * dist + (Math.random() - 0.5) * 20,
      };
    });

    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: D3SimLink[] = [];
    for (const e of edges) {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (src && tgt) {
        simLinks.push({
          id: e.id,
          source: src,
          target: tgt,
          relationship: e.relationship,
          description: e.description,
        });
      }
    }

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    // D3 Force: Unified Pair Repulsion & Elastic Springs
    const simulation = forceSimulation<D3SimNode>(simNodes)
      // 1. Coulomb Repulsion with stronger push for hub nodes
      .force(
        'charge',
        forceManyBody<D3SimNode>()
          .strength((d) => (hubs.has(d.id) ? -280 : -160))
          .distanceMax(600)
      )
      // 2. Elastic Spring Links
      .force(
        'link',
        forceLink<D3SimNode, D3SimLink>(simLinks)
          .distance((l) => (l.relationship === 'CONTAINS' ? 38 : 85))
          .strength(0.35)
      )
      // 3. Collision Barrier: Treats Node + Text as a single unified object
      .force(
        'collide',
        forceCollide<D3SimNode>()
          .radius((d) => d.collisionRadius)
          .strength(0.9)
          .iterations(3)
      )
      // 4. Gentle Centering
      .force('center', forceCenter<D3SimNode>(0, 0))
      .velocityDecay(0.38);

    if (!isPhysicsActive) {
      simulation.stop();
    }

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  // Handle Play/Pause Physics
  useEffect(() => {
    if (!simulationRef.current) return;
    if (isPhysicsActive) {
      simulationRef.current.alpha(0.25).restart();
    } else {
      simulationRef.current.stop();
    }
  }, [isPhysicsActive]);

  // Main 60 FPS Render Loop
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

      // Camera Transform
      ctx.translate(w / 2 + panOffset.x, h / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      const activeId = selectedNode?.id || null;
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

      // 1. Draw Hairline Edges
      for (const link of simLinksRef.current) {
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
          // Hovered highlighted edge: crisp vibrant green hairline
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.2;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
          ctx.shadowBlur = 4;
        } else if (isEdgeConnected) {
          // Connected to selected node: thin vibrant green hairline
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.0;
        } else {
          // Default Obsidian edge: ultra-thin hairline
          ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.14)';
          ctx.lineWidth = 0.75;
        }

        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Solid Vibrant Nodes
      for (const n of simNodesRef.current) {
        if (n.x === undefined || n.y === undefined) continue;

        const matchesLayer = selectedLayer === 'all' || n.layer === selectedLayer;
        const matchesSearch = !searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase());
        const isConnected = activeId ? connectedNodeSet.has(n.id) : true;
        const isDimmed = !matchesLayer || !matchesSearch || (activeId && !isConnected);
        const isCurrentActive = n.id === activeId;

        const baseColor = LAYER_COLORS[n.layer] || DEFAULT_NODE_COLOR;

        ctx.save();
        ctx.globalAlpha = isDimmed ? 0.06 : 1.0;

        // Active node: soft subtle ring
        if (isCurrentActive) {
          ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
          ctx.shadowBlur = 8;
        }

        // Draw node circle (ABOVE the text)
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentActive ? '#ffffff' : baseColor;
        ctx.fill();

        // 3. Crisp White Typography (CENTERED DIRECTLY BELOW THE NODE)
        const showLabel =
          isCurrentActive ||
          (activeId && isConnected) ||
          zoomLevel > 1.2 ||
          (matchesSearch && searchQuery);

        if (showLabel) {
          ctx.shadowBlur = 0;
          ctx.font = `${isCurrentActive ? '600 10.5px' : '400 10px'} -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.fillStyle = isCurrentActive ? '#ffffff' : isDimmed ? 'rgba(255, 255, 255, 0.15)' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // Node is above and at the horizontal center of the text
          ctx.fillText(n.label, n.x, n.y + n.radius + 4);
        }

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [edges, selectedLayer, searchQuery, selectedNode, hoveredEdgeId, zoomLevel, panOffset]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    // Check if clicked a node
    const clicked = simNodesRef.current.find(
      (n) => n.x !== undefined && n.y !== undefined && Math.hypot(n.x - mx, n.y - my) <= n.radius + 6
    );

    if (clicked) {
      draggedNodeRef.current = clicked;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
      clicked.fx = clicked.x;
      clicked.fy = clicked.y;

      if (selectedNode?.id === clicked.id) {
        onSelectNode(null);
        onHoverHighlightedEdge(null, null);
      } else {
        onSelectNode(clicked);
        onHoverHighlightedEdge(null, null);
      }
    } else {
      // Clicked empty canvas: clear selection
      onSelectNode(null);
      onHoverHighlightedEdge(null, null);
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
      draggedNodeRef.current.fx = mx;
      draggedNodeRef.current.fy = my;
      return;
    }

    if (isDraggingCanvasRef.current) {
      const dx = clientX - lastMousePosRef.current.x;
      const dy = clientY - lastMousePosRef.current.y;
      onPanChange({ x: panOffset.x + dx, y: panOffset.y + dy });
      lastMousePosRef.current = { x: clientX, y: clientY };
      return;
    }

    // Edge Hover Detection: ONLY active when a node is clicked and its edges are highlighted
    if (!selectedNode) {
      if (hoveredEdgeId) {
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }
      return;
    }

    const mx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    // Test proximity ONLY to highlighted connected edges
    const threshold = 6 / zoomLevel;
    let foundLink: D3SimLink | null = null;

    for (const link of simLinksRef.current) {
      const isConnectedToSelected = link.source.id === selectedNode.id || link.target.id === selectedNode.id;
      if (!isConnectedToSelected) continue;

      if (link.source.x === undefined || link.source.y === undefined || link.target.x === undefined || link.target.y === undefined) continue;

      const d = distToSegment(mx, my, link.source.x, link.source.y, link.target.x, link.target.y);
      if (d <= threshold) {
        foundLink = link;
        break;
      }
    }

    if (foundLink) {
      setHoveredEdgeId(foundLink.id);
      const rawEdge: GraphMeshEdge = {
        id: foundLink.id,
        source: foundLink.source.id,
        target: foundLink.target.id,
        relationship: foundLink.relationship,
        description: foundLink.description,
      };
      onHoverHighlightedEdge(rawEdge, { x: clientX, y: clientY });
    } else {
      if (hoveredEdgeId) {
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    }
    isDraggingCanvasRef.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: '#0b0f19' }}
    />
  );
};
