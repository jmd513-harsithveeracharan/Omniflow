import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
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
  const [selectedLayers, setSelectedLayers] = useState<string[]>(['all']);
  const [isPhysicsActive, setIsPhysicsActive] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphMeshNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [autoCenterTrigger, setAutoCenterTrigger] = useState(0);

  // Highlighted Edge Hover Tooltip State
  const [hoveredHighlightedEdge, setHoveredHighlightedEdge] = useState<GraphMeshEdge | null>(null);
  const [edgeTooltipPos, setEdgeTooltipPos] = useState<{ x: number; y: number } | null>(null);

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
        // Automatically center the graph after data arrives
        setTimeout(() => {
          setAutoCenterTrigger((prev) => prev + 1);
        }, 150);
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
    setSelectedProjectId(newPid);
    setSelectedNode(null);
    setHoveredHighlightedEdge(null);
    if (onSelectProject) onSelectProject(newPid);
  };

  const handleHoverHighlightedEdge = (edge: GraphMeshEdge | null, pos: { x: number; y: number } | null) => {
    setHoveredHighlightedEdge(edge);
    setEdgeTooltipPos(pos);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.2, z * 1.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.3, z * 0.8));
  const handleAutoCenter = () => {
    setAutoCenterTrigger((prev) => prev + 1);
  };
  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
    setHoveredHighlightedEdge(null);
    setAutoCenterTrigger((prev) => prev + 1);
  };

  if (isLoading && !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#121214] text-zinc-400 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-zinc-200" />
        <span className="text-xs font-medium tracking-wide text-zinc-300">Loading Relationship Graph...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#121214] text-zinc-400 gap-3 p-6 text-center">
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
    <div className="relative w-full h-full overflow-hidden select-none bg-[#121214]">
      {isLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-2xl text-xs text-zinc-200 backdrop-blur-md pointer-events-none animate-in fade-in duration-150">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>Updating project graph...</span>
        </div>
      )}

      {/* Top and Bottom Controls */}
      <GraphMeshControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedLayers={selectedLayers}
        onLayersChange={setSelectedLayers}
        layers={data.layers}
        isPhysicsActive={isPhysicsActive}
        onTogglePhysics={() => setIsPhysicsActive((p) => !p)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onAutoCenter={handleAutoCenter}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        stats={data.stats}
      />

      {/* Interactive Graph Canvas */}
      <GraphMeshCanvas
        nodes={data.nodes}
        edges={data.edges}
        selectedLayers={selectedLayers}
        searchQuery={searchQuery}
        isPhysicsActive={isPhysicsActive}
        selectedNode={selectedNode}
        onSelectNode={(node) => {
          setSelectedNode(node);
          if (!node) setHoveredHighlightedEdge(null);
        }}
        onHoverHighlightedEdge={handleHoverHighlightedEdge}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        panOffset={panOffset}
        onPanChange={setPanOffset}
        autoCenterTrigger={autoCenterTrigger}
      />

      {/* Sleek Single-Point-of-Info Relationship Card (Redesigned) */}
      {hoveredHighlightedEdge && edgeTooltipPos && (
        <div
          className="pointer-events-none fixed z-50 p-2.5 bg-[#18181b]/95 border border-zinc-800/90 rounded-xl shadow-2xl shadow-black/95 text-xs text-zinc-100 animate-in fade-in zoom-in-95 duration-100 min-w-[240px] max-w-sm backdrop-blur-xl"
          style={{
            left: Math.min(typeof window !== 'undefined' ? window.innerWidth - 300 : 800, Math.max(16, edgeTooltipPos.x + 16)),
            top: Math.min(typeof window !== 'undefined' ? window.innerHeight - 100 : 600, Math.max(16, edgeTooltipPos.y - 20)),
          }}
        >
          {/* Hero Lineage Path: Source ➔ Target */}
          <div className="flex items-center gap-2 mb-1.5 font-mono text-[11.5px]">
            <span className="font-semibold text-zinc-100 truncate">
              {hoveredHighlightedEdge.source.split('.').pop()}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-zinc-100 truncate">
              {hoveredHighlightedEdge.target.split('.').pop()}
            </span>
          </div>

          {/* Unified Relationship Meta Row */}
          <div className="flex items-center gap-2 pt-1.5 border-t border-zinc-800/80 text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[9.5px] font-semibold uppercase tracking-wider border border-emerald-500/25 shrink-0">
              {hoveredHighlightedEdge.relationship.replace(/_/g, ' ')}
            </span>
            {hoveredHighlightedEdge.description && (
              <span className="text-zinc-300 truncate text-[11px]">
                {hoveredHighlightedEdge.description}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
