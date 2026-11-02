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

  // Highlighted Edge Hover Tooltip State (Active ONLY when a node is selected)
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
    setHoveredHighlightedEdge(null);
    if (onSelectProject) onSelectProject(newPid);
  };

  const handleHoverHighlightedEdge = (edge: GraphMeshEdge | null, pos: { x: number; y: number } | null) => {
    setHoveredHighlightedEdge(edge);
    setEdgeTooltipPos(pos);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.2, z * 1.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.3, z * 0.8));
  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
    setHoveredHighlightedEdge(null);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#111111] text-zinc-400 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
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
        onSelectNode={(node) => {
          setSelectedNode(node);
          if (!node) setHoveredHighlightedEdge(null);
        }}
        onHoverHighlightedEdge={handleHoverHighlightedEdge}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        panOffset={panOffset}
        onPanChange={setPanOffset}
      />

      {/* Edge Relationship Modal Card — Shown ONLY when a node is clicked and hovering its highlighted edge */}
      {hoveredHighlightedEdge && edgeTooltipPos && selectedNode && (
        <div
          className="pointer-events-none fixed z-50 p-3 bg-[#18181b] border border-zinc-800/90 rounded-xl shadow-2xl shadow-black/95 text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-100 max-w-sm"
          style={{
            left: edgeTooltipPos.x + 16,
            top: edgeTooltipPos.y - 16,
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-white/8 flex items-center justify-center text-zinc-300">
                <GitBranch className="w-3 h-3" />
              </div>
              <span className="font-semibold text-zinc-100 text-xs">Relationship Link</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-white/8 text-[10px] font-mono font-medium text-zinc-300 border border-white/10 uppercase">
              {hoveredHighlightedEdge.relationship}
            </span>
          </div>

          {/* Description / Casting */}
          {hoveredHighlightedEdge.description && (
            <div className="text-[11px] text-zinc-300 leading-relaxed mb-2.5 bg-black/40 p-2 rounded-lg border border-white/5">
              {hoveredHighlightedEdge.description}
            </div>
          )}

          {/* Source -> Target Path */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 bg-white/[0.03] px-2 py-1.5 rounded-md border border-white/5">
            <span className="text-zinc-200 truncate">{hoveredHighlightedEdge.source.split('.').pop()}</span>
            <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="text-zinc-200 truncate">{hoveredHighlightedEdge.target.split('.').pop()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
