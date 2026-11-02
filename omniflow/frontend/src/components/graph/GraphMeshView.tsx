import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { IngestionPlan, GraphMeshNode, GraphMeshResponse } from '../../types';
import { fetchGraphMesh } from '../../services/api';
import { GraphMeshCanvas } from './GraphMeshCanvas';
import { GraphMeshControls } from './GraphMeshControls';
import { GraphMeshInspector } from './GraphMeshInspector';

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
    if (onSelectProject) onSelectProject(newPid);
  };

  const handleSelectConnectedNode = (nodeId: string) => {
    if (!data) return;
    const found = data.nodes.find((n) => n.id === nodeId);
    if (found) setSelectedNode(found);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.8, z * 1.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.35, z * 0.8));
  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090d16] text-zinc-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        <span className="text-xs font-medium tracking-wide">Compiling Relationship Graph & Lineage...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#090d16] text-zinc-400 gap-3 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm text-zinc-200 font-semibold">{error || 'Graph unavailable'}</p>
        <button
          onClick={() => loadMesh(selectedProjectId)}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-zinc-200 hover:bg-white/15 transition-colors border border-white/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#090d16]">
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
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        panOffset={panOffset}
        onPanChange={setPanOffset}
      />

      <GraphMeshInspector
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        onSelectConnectedNode={handleSelectConnectedNode}
      />
    </div>
  );
};
