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
  Layers,
  Network,
  Focus,
} from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
}

interface GraphMeshControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedLayer?: string;
  selectedLayers?: string[];
  onLayerSelect?: (layer: string) => void;
  onLayersChange?: (layers: string[]) => void;
  layers?: string[];
  isPhysicsActive: boolean;
  onTogglePhysics: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onAutoCenter?: () => void;
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

const STANDARD_MEDALLION_LAYERS = [
  { id: 'all', label: 'All', color: '#10b981' },
  { id: 'source', label: 'Source', color: '#4ba473' },
  { id: 'bronze', label: 'Bronze', color: '#c98539' },
  { id: 'silver', label: 'Silver', color: '#469bb0' },
  { id: 'gold', label: 'Gold', color: '#cbaf49' },
  { id: 'bi', label: 'BI', color: '#ba5884' },
];

export const GraphMeshControls: React.FC<GraphMeshControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedLayer = 'all',
  selectedLayers,
  onLayerSelect,
  onLayersChange,
  isPhysicsActive,
  onTogglePhysics,
  onZoomIn,
  onZoomOut,
  onResetView,
  onAutoCenter,
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

  // Filter out any legacy 'all' projects; only real projects
  const displayProjects = projects.filter((p) => p.id !== 'all');
  if (!displayProjects.some((p) => p.id === 'PRJ-PELI-BIOTHERMAL')) {
    displayProjects.push({
      id: 'PRJ-PELI-BIOTHERMAL',
      name: 'Peli BioThermal Cold-Chain Platform',
    });
  }

  const activeProject =
    displayProjects.find((p) => p.id === selectedProjectId) || displayProjects[0];
  const activeProjectName = activeProject ? activeProject.name : 'Select Project';

  // Multi-select layer handling
  const currentLayers = selectedLayers || (selectedLayer ? [selectedLayer] : ['all']);

  const handleToggleLayer = (layerId: string) => {
    if (layerId === 'all') {
      if (onLayersChange) onLayersChange(['all']);
      if (onLayerSelect) onLayerSelect('all');
      return;
    }

    let next: string[];
    if (currentLayers.includes('all')) {
      next = [layerId];
    } else if (currentLayers.includes(layerId)) {
      next = currentLayers.filter((l) => l !== layerId);
      if (next.length === 0) next = ['all'];
    } else {
      next = [...currentLayers, layerId];
    }

    if (onLayersChange) onLayersChange(next);
    if (onLayerSelect) onLayerSelect(next.length === 1 ? next[0] : 'all');
  };

  return (
    <>
      {/* 1. TOP BAR: Search on Left, Project Selector in Middle, Medallion Layers on Right */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
        {/* Left: Search Input & Node/Link Stats */}
        <div className="flex items-center gap-2 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-white/12 p-1.5 rounded-xl shadow-xl shadow-black/70">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-200 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search nodes..."
              className="w-44 bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2 border-l border-white/10 text-[11px] text-zinc-200">
            <span className="flex items-center gap-1 font-medium text-zinc-100">
              <Network className="w-3 h-3 text-zinc-200" />
              {stats.total_nodes} nodes
            </span>
            <span className="text-zinc-400">•</span>
            <span className="font-medium text-zinc-300">{stats.total_edges} links</span>
          </div>
        </div>

        {/* Middle: Project Selector Dropdown (Aligned horizontally at the same level) */}
        {displayProjects.length > 0 && onSelectProject && (
          <div
            className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex items-center bg-[#18181b]/95 backdrop-blur-md border border-white/12 p-1.5 rounded-xl shadow-xl shadow-black/70"
            ref={dropdownRef}
          >
            <button
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-xs text-zinc-100 transition-all cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-200 shrink-0" />
              <span className="font-medium text-zinc-100 max-w-[210px] truncate">{activeProjectName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-200 ml-0.5 shrink-0" />
            </button>

            {/* Dropdown Menu (Strictly Real Projects, No 'All projects (Galaxy)') */}
            {isPickerOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#18181b] border border-white/15 rounded-xl shadow-2xl shadow-black/95 p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                <div className="px-2 py-1 mb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Scope Relationship Graph
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {displayProjects.map((p) => {
                    const isSelected = activeProject?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setIsPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left ${
                          isSelected
                            ? 'bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/25'
                            : 'text-zinc-200 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-medium">{p.name || p.id}</div>
                          <div className="text-[10px] text-zinc-400 font-mono truncate">{p.id}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right: Standardized Medallion Layer Filter Chips with Multi-Select */}
        <div className="flex items-center gap-1 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-white/12 p-1.5 rounded-xl shadow-xl shadow-black/70">
          <div className="flex items-center gap-1 text-[11px] text-zinc-200 px-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-zinc-200" />
          </div>
          {STANDARD_MEDALLION_LAYERS.map((layer) => {
            const isAll = layer.id === 'all';
            const isSelected = isAll
              ? currentLayers.includes('all')
              : !currentLayers.includes('all') && currentLayers.includes(layer.id);

            return (
              <button
                key={layer.id}
                onClick={() => handleToggleLayer(layer.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-white/8'
                }`}
              >
                {!isAll && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: layer.color }}
                  />
                )}
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BOTTOM LEFT: Vertical Camera & Zoom Controls Dock */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-auto flex flex-col items-center gap-1 bg-[#18181b]/95 backdrop-blur-md border border-white/12 p-1.5 rounded-xl shadow-2xl shadow-black/80">
        <button
          onClick={onAutoCenter || onResetView}
          title="Auto-center & fit graph"
          className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
        >
          <Focus className="w-4 h-4 text-zinc-200" />
        </button>
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4 text-zinc-200" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4 text-zinc-200" />
        </button>
        <button
          onClick={onResetView}
          title="Reset canvas camera"
          className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-zinc-200" />
        </button>
        <div className="w-4 border-t border-white/10 my-0.5" />
        <button
          onClick={onTogglePhysics}
          title={isPhysicsActive ? 'Pause force physics' : 'Resume force physics'}
          className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
        >
          {isPhysicsActive ? <Pause className="w-4 h-4 text-zinc-200" /> : <Play className="w-4 h-4 text-zinc-200" />}
        </button>
      </div>
    </>
  );
};
