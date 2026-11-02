import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Layers } from 'lucide-react';
import { FabricWorkspaceSummary } from '../../types';

interface WorkspaceSelectorDropdownProps {
  workspaces: FabricWorkspaceSummary[];
  selectedWorkspace: FabricWorkspaceSummary | null;
  onSelectWorkspace: (ws: FabricWorkspaceSummary) => void;
  isLoading?: boolean;
}

export const WorkspaceSelectorDropdown: React.FC<WorkspaceSelectorDropdownProps> = ({
  workspaces,
  selectedWorkspace,
  onSelectWorkspace,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filtered = workspaces.filter(
    (w) =>
      w.displayName.toLowerCase().includes(query.toLowerCase().trim()) ||
      w.id.toLowerCase().includes(query.toLowerCase().trim()) ||
      (w.description && w.description.toLowerCase().includes(query.toLowerCase().trim()))
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/70 text-zinc-100 transition-all cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title="Switch Microsoft Fabric Workspace"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 text-emerald-400">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-semibold text-zinc-100 group-hover:text-white max-w-[240px] truncate">
            {selectedWorkspace?.displayName || 'Select Fabric Workspace'}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 rounded-xl bg-[#18181b] border border-zinc-700/80 shadow-[0_20px_48px_rgba(0,0,0,0.9)] backdrop-blur-xl p-2 animate-in fade-in zoom-in-95 duration-100"
          style={{ maxHeight: '380px' }}
        >
          <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search workspaces by name or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs text-zinc-100 placeholder-zinc-500"
              autoFocus
            />
          </div>

          <div className="mt-1 overflow-y-auto max-h-64 flex flex-col gap-0.5 pr-0.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-zinc-500">
                No matching workspaces found
              </div>
            ) : (
              filtered.map((ws) => {
                const isSelected = selectedWorkspace?.id === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-zinc-200 hover:bg-zinc-800/80 hover:text-white border border-transparent'
                    }`}
                    onClick={() => {
                      onSelectWorkspace(ws);
                      setIsOpen(false);
                      setQuery('');
                    }}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{ws.displayName}</span>
                        {ws.type && ws.type !== 'Workspace' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {ws.type}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                        {ws.id}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

