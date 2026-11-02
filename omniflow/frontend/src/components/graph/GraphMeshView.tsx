import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, ArrowRight, GitBranch } from 'lucide-react';
import { IngestionPlan, GraphMeshNode, GraphMeshEdge, GraphMeshResponse } from '../../types';
import { fetchGraphMesh } from '../../services/api';
import { GraphMeshCanvas } from './GraphMeshCanvas';
import { GraphMeshControls } from './GraphMeshControls';

interface ProjectOption {
  id: string;
  name: string;
}

interface GraphMeshViewProps {
  plan?: IngestionPlan | Record<string, unknown> | null;
  projectId?: string | null;
  projects?: ProjectOption[];
  onSelectProject?: (projectId: string) => void;
  onClose?: () => void;
}

export const GraphMeshView: React.FC<GraphMeshViewProps> = ({
  plan,
  projectId,
  projects = [],
  onSelectProject,
}) => {
  const [data, setData] = useState<GraphMeshResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId || null);

  // Filter & Camera Controls State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayer, setSelectedLayer] = useState('all');
  const [isPhysicsActive, setIsPhysicsActive] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphMeshNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Lightweight Obsidian Hover Tooltips
  const [hoveredNode, setHoveredNode] = useState<GraphMeshNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphMeshEdge | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Sync external projectId changes
  useEffect(() => {
    if (projectId !== undefined) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  const loadMesh = (pId: string | null = selectedProjectId) => {
    setIsLoading(true);
    setError(null);
    fetchGraphMesh(plan, pId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load Relationship Graph.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadMesh(selectedProjectId);
  }, [plan, selectedProjectId]);

  const handleSelectProject = (newPid: string) => {
    const val = newPid === 'all' ? null : newPid;
    setSelectedProjectId(val);
    setSelectedNode(null);
    if (onSelectProject) onSelectProject(newPid);
  };

  const handleHoverNode = (node: GraphMeshNode | null, pos: { x: number; y: number } | null) => {
    setHoveredNode(node);
    if (node && pos) {
      setTooltipPos(pos);
    } else if (!hoveredEdge) {
      setTooltipPos(null);
    }
  };

  const handleHoverEdge = (edge: GraphMeshEdge | null, pos: { x: number; y: number } | null) => {
    setHoveredEdge(edge);
    if (edge && pos) {
      setTooltipPos(pos);
    } else if (!hoveredNode) {
      setTooltipPos(null);
    }
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.2, z * 1.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.3, z * 0.8));
  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#111111] text-zinc-400 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-zinc-300" />
        <span className="text-xs font-medium tracking-wide text-zinc-400">Loading Relationship Graph...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#111111] text-zinc-400 gap-3 p-6 text-center">
        <AlertCircle className="w-7 h-7 text-rose-500" />
        <p className="text-sm text-zinc-300 font-semibold">{error || 'Graph unavailable'}</p>
        <button
          onClick={() => loadMesh(selectedProjectId)}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors border border-zinc-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#111111]">
      <GraphMeshControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedLayer={selectedLayer}
        onLayerSelect={setSelectedLayer}
        layers={data.layers}
        isPhysicsActive={isPhysicsActive}
        onTogglePhysics={() => setIsPhysicsActive((p) => !p)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        stats={data.stats}
      />

      <GraphMeshCanvas
        nodes={data.nodes}
        edges={data.edges}
        selectedLayer={selectedLayer}
        searchQuery={searchQuery}
        isPhysicsActive={isPhysicsActive}
        selectedNode={selectedNode}
        onSelectNode={setSelectedNode}
        onHoverNode={handleHoverNode}
        onHoverEdge={handleHoverEdge}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        panOffset={panOffset}
        onPanChange={setPanOffset}
      />

      {/* Edge Hover Tooltip */}
      {hoveredEdge && tooltipPos && (
        <div
          className="pointer-events-none fixed z-50 px-3 py-2 bg-[#18181b]/95 border border-white/20 rounded-lg shadow-2xl shadow-black/90 backdrop-blur-md text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 12 }}
        >
          <div className="flex items-center gap-1.5 font-semibold text-[11px] text-cyan-400 mb-0.5">
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span className="uppercase tracking-wider">{hoveredEdge.relationship}</span>
          </div>
          {hoveredEdge.description && (
            <div className="text-[11px] text-zinc-200 font-normal leading-tight max-w-xs">
              {hoveredEdge.description}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1.5 font-mono pt-1 border-t border-white/10">
            <span className="text-zinc-300">{hoveredEdge.source.split('.').pop()}</span>
            <ArrowRight className="w-2.5 h-2.5 text-zinc-500" />
            <span className="text-zinc-300">{hoveredEdge.target.split('.').pop()}</span>
          </div>
        </div>
      )}

      {/* Node Hover Tooltip (when not hovering an edge) */}
      {hoveredNode && !hoveredEdge && tooltipPos && (
        <div
          className="pointer-events-none fixed z-50 px-2.5 py-1.5 bg-[#18181b]/95 border border-white/20 rounded-lg shadow-2xl shadow-black/90 backdrop-blur-md text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: tooltipPos.x + 14, top: tooltipPos.y - 12 }}
        >
          <div className="font-semibold text-white text-xs">{hoveredNode.label}</div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5 capitalize font-medium">
            <span className="capitalize">{hoveredNode.layer}</span>
            <span>•</span>
            <span className="capitalize">{hoveredNode.type}</span>
            <span>•</span>
            <span>{hoveredNode.degree} links</span>
          </div>
        </div>
      )}
    </div>
  );
};
