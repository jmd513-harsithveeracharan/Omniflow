import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FolderGit2,
  ChevronDown,
  Check,
  Globe,
  Layers,
  Network,
} from 'lucide-react';

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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    if (isPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen]);

  // Ensure Peli BioThermal and all available projects are always selectable
  const displayProjects = [...projects];
  if (!displayProjects.some((p) => p.id === 'PRJ-PELI-BIOTHERMAL')) {
    displayProjects.push({
      id: 'PRJ-PELI-BIOTHERMAL',
      name: 'Peli BioThermal Cold-Chain Platform',
    });
  }

  const activeProjectName =
    selectedProjectId && selectedProjectId !== 'all'
      ? displayProjects.find((p) => p.id === selectedProjectId)?.name || selectedProjectId
      : 'All Projects (Galaxy Overview)';

  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Project Selector & Search Box */}
      <div className="flex items-center gap-2 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-xl shadow-black/70">
        {/* Custom Project Dropdown */}
        {displayProjects.length > 0 && onSelectProject && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-zinc-800 rounded-lg text-xs text-zinc-200 transition-all cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="font-medium text-zinc-100 max-w-[160px] truncate">{activeProjectName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-0.5 shrink-0" />
            </button>

            {/* OmniFlow Modal-Styled Dropdown Card without bright white border */}
            {isPickerOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 bg-[#18181b] border border-zinc-800/90 rounded-xl shadow-2xl shadow-black/95 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                <div className="px-2 py-1 mb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Scope Relationship Graph
                </div>

                {/* Option 1: All Projects Galaxy */}
                <button
                  onClick={() => {
                    onSelectProject('all');
                    setIsPickerOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    !selectedProjectId || selectedProjectId === 'all'
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    <span>All Projects (Overview Galaxy)</span>
                  </div>
                  {(!selectedProjectId || selectedProjectId === 'all') && (
                    <Check className="w-3.5 h-3.5 text-zinc-200" />
                  )}
                </button>

                <div className="my-1 border-t border-zinc-800/80" />

                {/* Project List */}
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {displayProjects.map((p) => {
                    const isSelected = selectedProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setIsPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                          isSelected
                            ? 'bg-white/10 text-white font-medium'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium">{p.name || p.id}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{p.id}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-zinc-200 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes..."
            className="w-40 bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors"
          />
        </div>

        {/* Stats Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 border-l border-white/10 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1 font-medium text-zinc-300">
            <Network className="w-2.5 h-2.5 text-zinc-400" />
            {stats.total_nodes} nodes
          </span>
          <span>•</span>
          <span className="font-medium text-zinc-400">{stats.total_edges} links</span>
        </div>
      </div>

      {/* Layer Filter Chips */}
      <div className="flex items-center gap-1 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl shadow-black/70">
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 px-2 font-medium">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <button
          onClick={() => onLayerSelect('all')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectedLayer === 'all'
              ? 'bg-white/15 text-white border border-white/15'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          All
        </button>
        {layers.map((layer) => (
          <button
            key={layer}
            onClick={() => onLayerSelect(layer)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              selectedLayer === layer
                ? 'bg-white/15 text-white border border-white/15'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      {/* Camera Actions */}
      <div className="flex items-center gap-1 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-xl shadow-black/70">
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
