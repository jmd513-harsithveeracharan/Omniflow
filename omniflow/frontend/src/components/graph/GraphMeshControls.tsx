import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
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
import { getLayerColor, formatLayerLabel } from './graphTheme';

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

export const GraphMeshControls: React.FC<GraphMeshControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedLayer = 'all',
  selectedLayers,
  onLayerSelect,
  onLayersChange,
  layers = [],
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
        <div className="flex items-center gap-2 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-xl shadow-black/70">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-300 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search nodes..."
              className="w-44 bg-black/40 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 p-0.5 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2 border-l border-zinc-800 text-[11px] text-zinc-300">
            <span className="flex items-center gap-1 font-medium text-zinc-200">
              <Network className="w-3 h-3 text-zinc-300" />
              {stats.total_nodes} nodes
            </span>
            <span className="text-zinc-500">•</span>
            <span className="font-medium text-zinc-400">{stats.total_edges} links</span>
          </div>
        </div>

        {/* Middle: Project Selector Dropdown (Aligned horizontally at the same level) */}
        {displayProjects.length > 0 && onSelectProject && (
          <div
            className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex items-center bg-[#18181b]/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-xl shadow-black/70"
            ref={dropdownRef}
          >
            <button
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-zinc-800 rounded-lg text-xs text-zinc-100 transition-all cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <span className="font-medium text-zinc-100 max-w-[210px] truncate">{activeProjectName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-300 ml-0.5 shrink-0" />
            </button>

            {/* Dropdown Menu (Strictly Real Projects, No 'All projects (Galaxy)') */}
            {isPickerOpen && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#18181b] border border-zinc-800/90 rounded-xl shadow-2xl shadow-black/95 py-2 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backdropFilter: 'blur(16px)' }}
              >
                <div className="px-3.5 py-1 mb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Scope Relationship Graph
                </div>

                <div className="max-h-60 overflow-y-auto pl-2 pr-1 space-y-0.5">
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

        {/* Right: Dynamic Architecture Layer Filter Chips */}
        <div className="flex items-center gap-1 pointer-events-auto bg-[#18181b]/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-xl shadow-black/70 max-w-[46vw] overflow-x-auto">
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 px-1.5 font-medium shrink-0">
            <Layers className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          {[
            { id: 'all', label: 'All', color: '#e4e4e7' },
            ...layers.map((layerId) => ({
              id: layerId,
              label: formatLayerLabel(layerId),
              color: getLayerColor(layerId),
            })),
          ].map((layer) => {
            const isAll = layer.id === 'all';
            const isSelected = isAll
              ? currentLayers.includes('all')
              : !currentLayers.includes('all') && currentLayers.includes(layer.id);

            return (
              <button
                key={layer.id}
                onClick={() => handleToggleLayer(layer.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
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
      <div className="absolute bottom-6 left-6 z-20 pointer-events-auto flex flex-col items-center gap-1 bg-[#18181b]/95 backdrop-blur-md border border-zinc-800 p-1.5 rounded-xl shadow-2xl shadow-black/80">
        <button
          onClick={onAutoCenter || onResetView}
          title="Auto-center & fit graph"
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          <Focus className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetView}
          title="Reset canvas camera"
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-4 border-t border-zinc-800 my-0.5" />
        <button
          onClick={onTogglePhysics}
          title={isPhysicsActive ? 'Pause force physics' : 'Resume force physics'}
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
        >
          {isPhysicsActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
};
