import React from 'react';
import { Search, Play, Pause, ZoomIn, ZoomOut, RotateCcw, FolderGit2, Layers, Network } from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
}

interface GraphMeshControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedLayer: string;
  onLayerSelect: (layer: string) => void;
  layers: string[];
  isPhysicsActive: boolean;
  onTogglePhysics: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  projects?: ProjectOption[];
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  stats: {
    total_nodes: number;
    total_edges: number;
    tables_count: number;
    columns_count: number;
    notebooks_count: number;
    metrics_count: number;
  };
}

export const GraphMeshControls: React.FC<GraphMeshControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedLayer,
  onLayerSelect,
  layers,
  isPhysicsActive,
  onTogglePhysics,
  onZoomIn,
  onZoomOut,
  onResetView,
  projects = [],
  selectedProjectId,
  onSelectProject,
  stats,
}) => {
  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Project Selector & Search Box */}
      <div className="flex items-center gap-2 pointer-events-auto bg-[#0d1117]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl shadow-black/50">
        {/* Project Dropdown */}
        {projects.length > 0 && onSelectProject && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] border border-white/10 rounded-lg text-xs text-zinc-200">
            <FolderGit2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-transparent text-xs text-zinc-100 font-medium focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">
                All Projects (Overview Galaxy)
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-200">
                  {p.name || p.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tables, columns, metrics..."
            className="w-52 bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
          />
        </div>

        {/* Stats Summary Pills */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 border-l border-white/10 text-[11px]">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20">
            <Network className="w-2.5 h-2.5" />
            {stats.total_nodes} nodes
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20">
            {stats.total_edges} edges
          </span>
          <span className="hidden xl:inline px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
            {stats.tables_count} tables
          </span>
        </div>
      </div>

      {/* Layer Filter Pills */}
      <div className="flex items-center gap-1 pointer-events-auto bg-[#0d1117]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl shadow-black/50">
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 px-2 font-medium">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden md:inline">Layer:</span>
        </div>
        <button
          onClick={() => onLayerSelect('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            selectedLayer === 'all'
              ? 'bg-white/15 text-white border border-white/20 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          All
        </button>
        {layers.map((layer) => (
          <button
            key={layer}
            onClick={() => onLayerSelect(layer)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
              selectedLayer === layer
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      {/* View & Physics Controls */}
      <div className="flex items-center gap-1 pointer-events-auto bg-[#0d1117]/90 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl shadow-black/50">
        <button
          onClick={onTogglePhysics}
          title={isPhysicsActive ? 'Pause force physics' : 'Resume force physics'}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
        >
          {isPhysicsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onResetView}
          title="Reset canvas camera"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
