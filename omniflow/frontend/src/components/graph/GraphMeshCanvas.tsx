import React, { useRef, useEffect, useState } from 'react';
import { Simulation } from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';
import { D3SimNode, D3SimLink, createSnowflakeSimulation } from './graphSimulation';
import { renderGraphMesh } from './graphRenderer';

interface GraphMeshCanvasProps {
  nodes: GraphMeshNode[];
  edges: GraphMeshEdge[];
  selectedLayer?: string;
  selectedLayers?: string[];
  searchQuery: string;
  isPhysicsActive: boolean;
  selectedNode: GraphMeshNode | null;
  onSelectNode: (node: GraphMeshNode | null) => void;
  onHoverHighlightedEdge: (edge: GraphMeshEdge | null, clientPos: { x: number; y: number } | null) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  panOffset: { x: number; y: number };
  onPanChange: (pan: { x: number; y: number }) => void;
  autoCenterTrigger?: number;
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
  selectedLayer = 'all',
  selectedLayers,
  searchQuery,
  isPhysicsActive,
  selectedNode,
  onSelectNode,
  onHoverHighlightedEdge,
  zoomLevel,
  onZoomChange,
  panOffset,
  onPanChange,
  autoCenterTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simulationRef = useRef<Simulation<D3SimNode, D3SimLink> | null>(null);
  const simNodesRef = useRef<D3SimNode[]>([]);
  const simLinksRef = useRef<D3SimLink[]>([]);
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<D3SimNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<D3SimNode | null>(null);

  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  const autoCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const activeNodes = simNodesRef.current.filter((n) => n.x !== undefined && n.y !== undefined);
    if (activeNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of activeNodes) {
      if (n.x! < minX) minX = n.x!;
      if (n.x! > maxX) maxX = n.x!;
      if (n.y! < minY) minY = n.y!;
      if (n.y! > maxY) maxY = n.y!;
    }

    const graphWidth = Math.max(120, maxX - minX);
    const graphHeight = Math.max(120, maxY - minY);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const cw = canvas.clientWidth || 1000;
    const ch = canvas.clientHeight || 700;

    const zoomX = (cw - 220) / graphWidth;
    const zoomY = (ch - 160) / graphHeight;
    const fitZoom = Math.max(0.35, Math.min(1.35, Math.min(zoomX, zoomY)));

    onPanChange({ x: -centerX * fitZoom, y: -centerY * fitZoom });
    onZoomChange(fitZoom);
  };

  // Re-center when autoCenterTrigger changes
  useEffect(() => {
    if (autoCenterTrigger !== undefined) {
      autoCenter();
    }
  }, [autoCenterTrigger]);

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
        hoveredNode,
        hoveredEdgeId,
        selectedLayer,
        selectedLayers,
        searchQuery,
        zoomLevel,
        panOffset,
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [edges, selectedLayer, selectedLayers, searchQuery, selectedNode, hoveredNode, hoveredEdgeId, zoomLevel, panOffset]);

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

    const mx = (clientX - rect.left - canvas.clientWidth / 2 - panOffset.x) / zoomLevel;
    const my = (clientY - rect.top - canvas.clientHeight / 2 - panOffset.y) / zoomLevel;

    // Detect hovered node for instant hover-highlighting
    const foundHovered = simNodesRef.current.find(
      (n) => n.x !== undefined && n.y !== undefined && Math.hypot(n.x - mx, n.y - my) <= n.radius + 6
    );

    if (foundHovered?.id !== hoveredNode?.id) {
      setHoveredNode(foundHovered || null);
    }

    const focalNode = selectedNode || foundHovered || hoveredNode;
    if (focalNode) {
      const threshold = 7 / zoomLevel;
      let foundLink: D3SimLink | null = null;

      for (const link of simLinksRef.current) {
        const isConnected = link.source.id === focalNode.id || link.target.id === focalNode.id;
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
        setHoveredNode(null);
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: '#121214' }}
    />
  );
};
