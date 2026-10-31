import React from 'react';
import { Search, Play, Pause, ZoomIn, ZoomOut, RotateCcw, Sparkles, Layers } from 'lucide-react';

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
  stats,
}) => {
  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Search & Stats Bar */}
      <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-xl shadow-black/40">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tables, columns, metrics..."
            className="w-56 bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Stats Pills */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 border-l border-slate-800 text-[11px] text-slate-400">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 font-medium">
            <Sparkles className="w-2.5 h-2.5" />
            {stats.total_nodes} nodes
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-emerald-400 font-medium">
            {stats.total_edges} edges
          </span>
          <span className="hidden md:inline px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-400 font-medium">
            {stats.tables_count} tables
          </span>
          <span className="hidden lg:inline px-1.5 py-0.5 rounded bg-slate-800/80 text-indigo-400 font-medium">
            {stats.columns_count} columns
          </span>
        </div>
      </div>

      {/* Layer Filter Chips */}
      <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-xl shadow-black/40">
        <div className="flex items-center gap-1 text-[11px] text-slate-400 px-2 font-medium">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">Layer:</span>
        </div>
        <button
          onClick={() => onLayerSelect('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            selectedLayer === 'all'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      {/* Canvas View Actions */}
      <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-xl shadow-black/40">
        <button
          onClick={onTogglePhysics}
          title={isPhysicsActive ? 'Pause force physics' : 'Resume force physics'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          {isPhysicsActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onResetView}
          title="Reset canvas camera"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
