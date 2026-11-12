import React, { useRef, useEffect, useState } from 'react';
import { Simulation } from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';
import { D3SimNode, D3SimLink, createSnowflakeSimulation } from './graphSimulation';
import { renderGraphMesh } from './graphRenderer';
import { distToSegment } from './graphTheme';

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

  // Hover Intent / Debounce refs to prevent jitter on cursor sweeps
  const hoverTimeoutRef = useRef<number | null>(null);
  const currentHoveredIdRef = useRef<string | null>(null);
  const pendingCandidateRef = useRef<D3SimNode | null>(null);

  // Smooth "Ooze Out" Focus Animation (0.0 to 1.0)
  const focusTransitionRef = useRef<number>(0.0);
  const focalNodeRef = useRef<GraphMeshNode | null>(null);
  const lastRenderTimeRef = useRef<number>(performance.now());

  // Ultra-fast mutable refs for 60/120 FPS continuous panning & zooming without React state churn
  const panRef = useRef({ x: panOffset.x, y: panOffset.y });
  const zoomRef = useRef(zoomLevel);
  const wheelTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    panRef.current = { x: panOffset.x, y: panOffset.y };
  }, [panOffset.x, panOffset.y]);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const hoveredNodeRef = useRef(hoveredNode);
  hoveredNodeRef.current = hoveredNode;

  const hoveredEdgeIdRef = useRef(hoveredEdgeId);
  hoveredEdgeIdRef.current = hoveredEdgeId;

  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const selectedLayerRef = useRef(selectedLayer);
  selectedLayerRef.current = selectedLayer;

  const selectedLayersRef = useRef(selectedLayers);
  selectedLayersRef.current = selectedLayers;

  // Cleanup pending hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const autoCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const activeNodes = simNodesRef.current.filter((n) => n.x !== undefined && n.y !== undefined);
    if (activeNodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;

    for (const n of activeNodes) {
      const nx = n.x!;
      const ny = n.y!;
      if (nx < minX) minX = nx;
      if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny;
      if (ny > maxY) maxY = ny;
      sumX += nx;
      sumY += ny;
    }

    const boundCenterX = (minX + maxX) / 2;
    const boundCenterY = (minY + maxY) / 2;
    const avgX = sumX / activeNodes.length;
    const avgY = sumY / activeNodes.length;

    // Harmonized visual center: 60% center of mass + 40% bounding center
    const centerX = avgX * 0.6 + boundCenterX * 0.4;
    const centerY = avgY * 0.6 + boundCenterY * 0.4;

    const graphWidth = Math.max(120, maxX - minX);
    const graphHeight = Math.max(120, maxY - minY);

    const cw = canvas.clientWidth || 1000;
    const ch = canvas.clientHeight || 700;

    const zoomX = (cw - 180) / graphWidth;
    const zoomY = (ch - 140) / graphHeight;
    const fitZoom = Math.max(0.40, Math.min(1.25, Math.min(zoomX, zoomY)));
    const newPan = { x: -centerX * fitZoom, y: -centerY * fitZoom };

    panRef.current = newPan;
    zoomRef.current = fitZoom;
    onPanChange(newPan);
    onZoomChange(fitZoom);
  };

  // Auto-center on nodes load and trigger changes
  useEffect(() => {
    if (autoCenterTrigger !== undefined) {
      autoCenter();
    }
  }, [autoCenterTrigger]);

  useEffect(() => {
    if (nodes.length > 0) {
      const t1 = setTimeout(autoCenter, 50);
      const t2 = setTimeout(autoCenter, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [nodes]);

  // Auto-focus matched nodes when search query changes
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    const matches = simNodesRef.current.filter(
      (n) =>
        n.x !== undefined &&
        n.y !== undefined &&
        (n.label.toLowerCase().includes(query) || n.id.toLowerCase().includes(query))
    );
    if (matches.length > 0 && matches.length <= 4) {
      const avgX = matches.reduce((sum, n) => sum + (n.x || 0), 0) / matches.length;
      const avgY = matches.reduce((sum, n) => sum + (n.y || 0), 0) / matches.length;
      const targetZoom = Math.max(0.95, Math.min(1.35, zoomRef.current));
      const newPan = { x: -avgX * targetZoom, y: -avgY * targetZoom };
      panRef.current = newPan;
      zoomRef.current = targetZoom;
      onPanChange(newPan);
      onZoomChange(targetZoom);
    }
  }, [searchQuery]);

  // Intercept Ctrl + Scroll and Wheel to prevent full-page browser zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.09 : 0.91;
      const newZoom = Math.max(0.25, Math.min(3.5, zoomRef.current * factor));
      zoomRef.current = newZoom;

      if (wheelTimeoutRef.current) {
        window.clearTimeout(wheelTimeoutRef.current);
      }
      wheelTimeoutRef.current = window.setTimeout(() => {
        onZoomChange(zoomRef.current);
        wheelTimeoutRef.current = null;
      }, 100);
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
      if (wheelTimeoutRef.current) {
        window.clearTimeout(wheelTimeoutRef.current);
      }
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
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastRenderTimeRef.current) / 1000);
      lastRenderTimeRef.current = now;

      const curSelected = selectedNodeRef.current;
      const curHovered = hoveredNodeRef.current;
      const hasActive = Boolean(curSelected || curHovered);

      if (hasActive) {
        focalNodeRef.current = curSelected || curHovered;
        focusTransitionRef.current = Math.min(1.0, focusTransitionRef.current + dt * 3.6);
      } else {
        focusTransitionRef.current = Math.max(0.0, focusTransitionRef.current - dt * 5.0);
        if (focusTransitionRef.current === 0.0) {
          focalNodeRef.current = null;
        }
      }

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
        selectedNode: curSelected,
        hoveredNode: curHovered,
        activeFocalNode: focalNodeRef.current,
        hoveredEdgeId: hoveredEdgeIdRef.current,
        selectedLayer: selectedLayerRef.current,
        selectedLayers: selectedLayersRef.current,
        searchQuery: searchQueryRef.current,
        zoomLevel: zoomRef.current,
        panOffset: panRef.current,
        focusProgress: focusTransitionRef.current,
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - canvas.clientWidth / 2 - panRef.current.x) / zoomRef.current;
    const my = (e.clientY - rect.top - canvas.clientHeight / 2 - panRef.current.y) / zoomRef.current;

    const isHitNode = (n: (typeof simNodesRef.current)[number], mx: number, my: number, pad: number) => {
      if (n.x === undefined || n.y === undefined) return false;
      if (n.type === 'table') {
        return Math.abs(n.x - mx) <= n.radius + pad && Math.abs(n.y - my) <= n.radius + pad;
      }
      return Math.hypot(n.x - mx, n.y - my) <= n.radius + pad;
    };

    const clicked = simNodesRef.current.find((n) => isHitNode(n, mx, my, 6));

    if (clicked) {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      currentHoveredIdRef.current = clicked.id;
      pendingCandidateRef.current = clicked;
      setHoveredNode(clicked);

      draggedNodeRef.current = clicked;
      if (simulationRef.current && isPhysicsActive) {
        simulationRef.current.alphaTarget(0.12).restart();
      }
      clicked.fx = clicked.x;
      clicked.fy = clicked.y;

      if (selectedNodeRef.current?.id === clicked.id) {
        onSelectNode(null);
        onHoverHighlightedEdge(null, null);
      } else {
        onSelectNode(clicked);
        onHoverHighlightedEdge(null, null);
      }
    } else {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      currentHoveredIdRef.current = null;
      pendingCandidateRef.current = null;
      setHoveredNode(null);
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
      const fx = (clientX - rect.left - canvas.clientWidth / 2 - panRef.current.x) / zoomRef.current;
      const fy = (clientY - rect.top - canvas.clientHeight / 2 - panRef.current.y) / zoomRef.current;
      draggedNodeRef.current.fx = fx;
      draggedNodeRef.current.fy = fy;
      draggedNodeRef.current.x = fx;
      draggedNodeRef.current.y = fy;
      return;
    }

    if (isDraggingCanvasRef.current) {
      const dx = clientX - lastMousePosRef.current.x;
      const dy = clientY - lastMousePosRef.current.y;
      panRef.current.x += dx;
      panRef.current.y += dy;
      lastMousePosRef.current = { x: clientX, y: clientY };
      return;
    }

    const mx = (clientX - rect.left - canvas.clientWidth / 2 - panRef.current.x) / zoomRef.current;
    const my = (clientY - rect.top - canvas.clientHeight / 2 - panRef.current.y) / zoomRef.current;

    // Detect hovered node with Hover Intent Debounce (~90ms dwell) to eliminate sweep jitter
    const foundHovered = simNodesRef.current.find((n) => {
      if (n.x === undefined || n.y === undefined) return false;
      if (n.type === 'table') {
        return Math.abs(n.x - mx) <= n.radius + 5 && Math.abs(n.y - my) <= n.radius + 5;
      }
      return Math.hypot(n.x - mx, n.y - my) <= n.radius + 5;
    }) || null;

    const foundId = foundHovered?.id || null;
    const activeHoverId = hoveredNode?.id || null;

    if (foundId === activeHoverId) {
      if (hoverTimeoutRef.current && pendingCandidateRef.current?.id !== foundId) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
        pendingCandidateRef.current = null;
      }
    } else if (foundHovered) {
      // User hovered over a new node: require ~90ms dwell to trigger focus bloom
      if (hoverTimeoutRef.current && pendingCandidateRef.current?.id !== foundId) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      pendingCandidateRef.current = foundHovered;
      if (!hoverTimeoutRef.current) {
        hoverTimeoutRef.current = window.setTimeout(() => {
          currentHoveredIdRef.current = foundId;
          setHoveredNode(foundHovered);
          hoverTimeoutRef.current = null;
          pendingCandidateRef.current = null;
        }, 90);
      }
    } else {
      // User moved off into empty space: immediately release hover so reverse animation runs at once!
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      pendingCandidateRef.current = null;
      currentHoveredIdRef.current = null;
      if (hoveredNodeRef.current) {
        setHoveredNode(null);
      }
      if (hoveredEdgeId) {
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }
    }

    const focalNode = selectedNodeRef.current || hoveredNode;
    if (focalNode) {
      const threshold = 7 / zoomRef.current;
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
    if (isDraggingCanvasRef.current) {
      isDraggingCanvasRef.current = false;
      onPanChange({ ...panRef.current });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        if (hoverTimeoutRef.current) {
          window.clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        pendingCandidateRef.current = null;
        currentHoveredIdRef.current = null;
        setHoveredNode(null);
        setHoveredEdgeId(null);
        onHoverHighlightedEdge(null, null);
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing block"
      style={{ background: '#121214' }}
    />
  );
};
