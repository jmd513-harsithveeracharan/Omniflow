import React, { useRef, useEffect, useState } from 'react';
import { Simulation } from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';
import { D3SimNode, D3SimLink, createSnowflakeSimulation } from './graphSimulation';
import { renderGraphMesh } from './graphRenderer';

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

  // Intercept Ctrl + Scroll and Wheel to prevent full-page browser zoom
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

  // Initialize Snowflake Simulation with Circular Boundary
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const dynamicBoundary = Math.max(340, Math.round(Math.sqrt(nodes.length) * 32));
    const { simulation, simNodes, simLinks } = createSnowflakeSimulation(nodes, edges, dynamicBoundary);
    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

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
      simulationRef.current.alpha(0.2).restart();
    } else {
      simulationRef.current.stop();
    }
  }, [isPhysicsActive]);

  // 60 FPS Canvas Render Loop
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

      renderGraphMesh({
        ctx,
        width: w,
        height: h,
        simNodes: simNodesRef.current,
        simLinks: simLinksRef.current,
        selectedNode,
        hoveredEdgeId,
        selectedLayer,
        searchQuery,
        zoomLevel,
        panOffset,
      });

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
      draggedNodeRef.current.fx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
      draggedNodeRef.current.fy = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;
      return;
    }

    if (isDraggingCanvasRef.current) {
      const dx = clientX - lastMousePosRef.current.x;
      const dy = clientY - lastMousePosRef.current.y;
      onPanChange({ x: panOffset.x + dx, y: panOffset.y + dy });
      lastMousePosRef.current = { x: clientX, y: clientY };
      return;
    }

    if (!selectedNode) {
      if (hoveredEdgeId) {
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }
      return;
    }

    const mx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;
    const threshold = 6 / zoomLevel;
    let foundLink: D3SimLink | null = null;

    for (const link of simLinksRef.current) {
      const isConnected = link.source.id === selectedNode.id || link.target.id === selectedNode.id;
      if (!isConnected) continue;
      if (link.source.x === undefined || link.source.y === undefined || link.target.x === undefined || link.target.y === undefined) continue;

      if (distToSegment(mx, my, link.source.x, link.source.y, link.target.x, link.target.y) <= threshold) {
        foundLink = link;
        break;
      }
    }

    if (foundLink) {
      setHoveredEdgeId(foundLink.id);
      onHoverHighlightedEdge(
        {
          id: foundLink.id,
          source: foundLink.source.id,
          target: foundLink.target.id,
          relationship: foundLink.relationship,
          description: foundLink.description,
        },
        { x: clientX, y: clientY }
      );
    } else if (hoveredEdgeId) {
      setHoveredEdgeId(null);
      onHoverHighlightedEdge(null, null);
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
      style={{ background: '#121214' }}
    />
  );
};
