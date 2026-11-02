import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, ArrowUpRight, ArrowDownRight, Key, Copy, Check, GitCommit, Network } from 'lucide-react';
import { GraphMeshNode, BlastZoneResponse } from '../../types';
import { fetchNodeBlastZone } from '../../services/api';

interface GraphMeshInspectorProps {
  selectedNode: GraphMeshNode | null;
  onClose: () => void;
  onSelectConnectedNode: (nodeId: string) => void;
}

export const GraphMeshInspector: React.FC<GraphMeshInspectorProps> = ({
  selectedNode,
  onClose,
  onSelectConnectedNode,
}) => {
  const [blastZone, setBlastZone] = useState<BlastZoneResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedNode) {
      setBlastZone(null);
      return;
    }
    let isCancelled = false;
    setIsLoading(true);

    fetchNodeBlastZone(selectedNode.id)
      .then((data) => {
        if (!isCancelled) setBlastZone(data);
      })
      .catch((err) => console.error('Failed to load blast zone:', err))
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedNode]);

  if (!selectedNode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedNode.label);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getImpactBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="absolute top-20 right-4 bottom-4 w-84 z-20 flex flex-col bg-[#0d1117]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 truncate">
            Relationship Lineage
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Node Identity */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider mb-1 bg-white/10 text-cyan-400 border border-white/10">
                {selectedNode.type}
              </span>
              <h2 className="text-sm font-semibold text-white break-words">{selectedNode.label}</h2>
            </div>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
              title="Copy name"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {selectedNode.description && (
            <p className="mt-1.5 text-zinc-400 text-[11px] leading-relaxed">{selectedNode.description}</p>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-black/40 border border-white/10">
          <div>
            <span className="text-[10px] text-zinc-500 font-medium">Layer</span>
            <p className="text-[11px] font-medium text-zinc-200 capitalize">{selectedNode.layer}</p>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-medium">Degree</span>
            <p className="text-[11px] font-medium text-zinc-200">{selectedNode.degree} links</p>
          </div>
          {selectedNode.data_type && (
            <div className="col-span-2">
              <span className="text-[10px] text-zinc-500 font-medium">Data Type</span>
              <p className="text-[11px] font-mono text-indigo-300">{selectedNode.data_type}</p>
            </div>
          )}
          {(selectedNode.is_primary_key || selectedNode.is_foreign_key) && (
            <div className="col-span-2 flex items-center gap-1.5 pt-1">
              {selectedNode.is_primary_key && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] flex items-center gap-1">
                  <Key className="w-2.5 h-2.5" /> Primary Key
                </span>
              )}
              {selectedNode.is_foreign_key && (
                <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] flex items-center gap-1">
                  <GitCommit className="w-2.5 h-2.5" /> Foreign Key
                </span>
              )}
            </div>
          )}
        </div>

        {/* Blast Zone Analysis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Blast Zone Impact
            </span>
            {blastZone && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getImpactBadge(blastZone.impact_level)}`}>
                {blastZone.impact_level}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="p-3 text-center text-zinc-500 bg-black/30 rounded-lg border border-white/10">
              Traversing Network Lineage...
            </div>
          ) : blastZone ? (
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-2">
              <p className="text-[11px] text-zinc-300 leading-normal">{blastZone.explanation}</p>

              {blastZone.downstream_nodes.length > 0 && (
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium flex items-center gap-1 mb-1">
                    <ArrowDownRight className="w-3 h-3 text-amber-400" />
                    Downstream Cascade ({blastZone.downstream_nodes.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {blastZone.downstream_nodes.map((nid) => (
                      <button
                        key={nid}
                        onClick={() => onSelectConnectedNode(nid)}
                        className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                      >
                        {nid}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {blastZone.upstream_nodes.length > 0 && (
                <div>
                  <span className="text-[10px] text-zinc-500 font-medium flex items-center gap-1 mb-1">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    Upstream Lineage ({blastZone.upstream_nodes.length})
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {blastZone.upstream_nodes.map((nid) => (
                      <button
                        key={nid}
                        onClick={() => onSelectConnectedNode(nid)}
                        className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                      >
                        {nid}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
