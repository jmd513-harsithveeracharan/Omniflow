import React, { useState } from 'react';
import {
  Layers,
  Network,
  FolderTree,
  Code2,
  Table2,
  FileCode,
  Copy,
  Check,
  Play,
  Maximize2,
  Minimize2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Database,
  Zap,
} from 'lucide-react';
import { IngestionPlan } from '../types';
import { GraphMeshView } from './graph/GraphMeshView';
import { OneLakeTreePane } from './workbench/OneLakeTreePane';
import { CodeEditorPane } from './workbench/CodeEditorPane';
import { DeltaSchemaPane } from './workbench/DeltaSchemaPane';
import { PipelinePane } from './workbench/PipelinePane';

interface MedallionFlowCanvasProps {
  plan?: IngestionPlan | Record<string, unknown> | null;
  onDeploy?: () => void;
  onClose?: () => void;
}

interface DagNode {
  id: string;
  label: string;
  type: 'source' | 'lakehouse' | 'notebook' | 'pipeline' | 'warehouse' | 'semantic_model';
  layer: string;
  folderCategory?: string;
  fullPath?: string;
  sub: string;
  status: 'pending' | 'deploying' | 'live' | 'error';
  x: number;
  y: number;
  code?: string;
  glowColor: string;
  iconSymbol: string;
}

export const MedallionFlowCanvas: React.FC<MedallionFlowCanvasProps> = ({
  plan,
  onDeploy,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wbPipelines' | 'wbDAG' | 'wbMesh' | 'wbTree' | 'wbCode' | 'wbTable' | 'wbJson'>('wbPipelines');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const pipelineCount = React.useMemo(() => {
    if (!plan || typeof plan !== 'object') return 2;
    const items = (plan as any).items as Array<Record<string, unknown>> | undefined;
    if (items) {
      const cnt = items.filter((it) => String(it.type || '').toLowerCase().includes('pipeline')).length;
      if (cnt > 0) return cnt;
    }
    return 2;
  }, [plan]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.flow-node') || target.closest('.dag-inspector')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleFitView = () => {
    setPanOffset({ x: 10, y: 20 });
    setZoomLevel(0.85);
  };

  // Dynamic 9-item Enterprise Medallion DAG computation
  const { dagNodes, dagEdges, treeItems, pysparkCode, qualityCode, sqlCode, jsonSpec, rootFolder, domain } = React.useMemo(() => {
    if (!plan || typeof plan !== 'object') {
      return {
        dagNodes: [],
        dagEdges: [],
        treeItems: [],
        pysparkCode: '# No pipeline code generated yet.\n# Run an architecture prompt or attach an intake spec to synthesize PySpark Delta logic.',
        qualityCode: '',
        sqlCode: '',
        jsonSpec: JSON.stringify(
          {
            status: 'idle',
            message: 'No active plan generated yet.',
          },
          null,
          2
        ),
        rootFolder: 'Postgres_Medallion_Platform',
        domain: 'postgres_medallion',
      };
    }

    const p = plan as Record<string, unknown>;
    const rootF = (p.root_folder as string) || (p.folder as string) || 'Postgres_Medallion_Platform';
    const cleanDomain = String(p.domain || 'postgres_medallion').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const lakehouses = (p.lakehouses as string[]) || [`lh_${cleanDomain}_bronze`, `lh_${cleanDomain}_silver`];
    const notebooks = (p.notebooks as Array<Record<string, unknown>>) || [];
    const pipeline = p.pipeline as Record<string, unknown> | string | undefined;
    const warehouseName =
      (p.warehouse as string) ||
      ((p.items as Array<Record<string, unknown>>)?.find((it) => it.type === 'Warehouse')?.name as string) ||
      `wh_${cleanDomain}_gold`;

    const rawFolder = (p.folders as Record<string, string>)?.raw || '01 Raw';
    const stageFolder = (p.folders as Record<string, string>)?.stage || '02 Stage';
    const silverFolder = (p.folders as Record<string, string>)?.silver || '03 Silver';
    const goldFolder = (p.folders as Record<string, string>)?.gold || '04 Gold';
    const orchFolder = '05 Orchestration';

    const lhBronze = lakehouses.find((l) => l.toLowerCase().includes('bronze')) || lakehouses[0] || `lh_${cleanDomain}_bronze`;
    const lhSilver = lakehouses.find((l) => l.toLowerCase().includes('silver')) || lakehouses[1] || `lh_${cleanDomain}_silver`;
    const plName = typeof pipeline === 'object' ? String(pipeline.name || `pl_${cleanDomain}_bronze_ingest`) : String(pipeline || `pl_${cleanDomain}_bronze_ingest`);
    const nbSilver = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('silver')) || notebooks[0];
    const nbCurateName = String(nbSilver?.name || `nb_${cleanDomain}_curate`);
    const qualityName = `nb_${cleanDomain}_quality_suite`;
    const semanticModelName = `sm_${cleanDomain}_gold_direct_lake`;
    const masterPlName = `pl_master_medallion_orchestration`;

    const pyCurateCode =
      (p.pyspark_code as string) ||
      (nbSilver?.pyspark_code as string) ||
      (nbSilver?.pyspark as string) ||
      (nbSilver?.code as string) ||
      '';
    const qualitySuiteCode = (p.quality_code as string) || '';
    const sqlWarehouseCode = (p.sql_code as string) || '';

    const nodes: DagNode[] = [
      // 0. Source Landing Zone
      {
        id: 'node_source',
        label: `${cleanDomain.replace('_', ' ').toUpperCase()} SOURCE`,
        type: 'source',
        layer: 'SOURCE',
        folderCategory: 'In Scope (12 Tables)',
        fullPath: 'PostgreSQL Platform / Neon CRM Database',
        sub: 'Relational CDC Tables Ingestion',
        status: 'live',
        x: 20,
        y: 95,
        glowColor: '#38bdf8',
        iconSymbol: '🔌',
      },
      // 1. Raw Bronze Layer (01 Raw)
      {
        id: 'node_bronze',
        label: lhBronze,
        type: 'lakehouse',
        layer: '01 RAW',
        folderCategory: '01_lakehouse',
        fullPath: `${rootF}/${rawFolder}/01_lakehouse`,
        sub: 'Delta Lakehouse (Raw Landing)',
        status: 'live',
        x: 270,
        y: 35,
        glowColor: '#f59e0b',
        iconSymbol: '🏢',
      },
      {
        id: 'node_pl_bronze',
        label: plName,
        type: 'pipeline',
        layer: '01 RAW',
        folderCategory: '02_pipelines',
        fullPath: `${rootF}/${rawFolder}/02_pipelines`,
        sub: 'ADF Copy Activity (CDC Watermark)',
        status: 'live',
        x: 270,
        y: 155,
        glowColor: '#f59e0b',
        iconSymbol: '⚡',
      },
      // 2. Stage Curation Layer (02 Stage)
      {
        id: 'node_nb_curate',
        label: `${nbCurateName}.py`,
        type: 'notebook',
        layer: '02 STAGE',
        folderCategory: '01_notebooks',
        fullPath: `${rootF}/${stageFolder}/01_notebooks`,
        sub: 'Delta MERGE & SHA-256 Masking',
        status: 'live',
        x: 520,
        y: 35,
        code: pyCurateCode,
        glowColor: '#c084fc',
        iconSymbol: '📜',
      },
      {
        id: 'node_nb_quality',
        label: `${qualityName}.py`,
        type: 'notebook',
        layer: '02 STAGE',
        folderCategory: '02_quality',
        fullPath: `${rootF}/${stageFolder}/02_quality`,
        sub: 'Great Expectations Anomaly Suite',
        status: 'live',
        x: 520,
        y: 155,
        code: qualitySuiteCode,
        glowColor: '#c084fc',
        iconSymbol: '🛡️',
      },
      // 3. Silver Harmonized Layer (03 Silver)
      {
        id: 'node_silver',
        label: lhSilver,
        type: 'lakehouse',
        layer: '03 SILVER',
        folderCategory: '01_lakehouse',
        fullPath: `${rootF}/${silverFolder}/01_lakehouse`,
        sub: 'Harmonized Clean Delta Lakehouse',
        status: 'live',
        x: 770,
        y: 35,
        glowColor: '#10b981',
        iconSymbol: '🏢',
      },
      {
        id: 'node_nb_silver',
        label: 'nb_silver_transformations.py',
        type: 'notebook',
        layer: '03 SILVER',
        folderCategory: '02_notebooks',
        fullPath: `${rootF}/${silverFolder}/02_notebooks`,
        sub: 'SCD Type 2 History & Lineage',
        status: 'live',
        x: 770,
        y: 155,
        code: pyCurateCode,
        glowColor: '#10b981',
        iconSymbol: '📜',
      },
      // 4. Gold Kimball Warehouse & Semantic Layer (04 Gold)
      {
        id: 'node_gold',
        label: warehouseName,
        type: 'warehouse',
        layer: '04 GOLD',
        folderCategory: '01_warehouse',
        fullPath: `${rootF}/${goldFolder}/01_warehouse`,
        sub: 'Direct Lake T-SQL Warehouse',
        status: 'live',
        x: 1020,
        y: 35,
        code: sqlWarehouseCode,
        glowColor: '#eab308',
        iconSymbol: '🏛️',
      },
      {
        id: 'node_sm_gold',
        label: semanticModelName,
        type: 'semantic_model',
        layer: '04 GOLD',
        folderCategory: '02_semantic_models',
        fullPath: `${rootF}/${goldFolder}/02_semantic_models`,
        sub: 'Direct Lake Power BI Semantic Model',
        status: 'live',
        x: 1020,
        y: 155,
        glowColor: '#eab308',
        iconSymbol: '📊',
      },
      // 5. Master Orchestration Layer (05 Orchestration)
      {
        id: 'node_master_orchestrator',
        label: masterPlName,
        type: 'pipeline',
        layer: '05 ORCHESTRATION',
        folderCategory: '01_pipelines',
        fullPath: `${rootF}/${orchFolder}/01_pipelines`,
        sub: 'Master End-to-End Orchestrator',
        status: 'live',
        x: 1270,
        y: 95,
        glowColor: '#f43f5e',
        iconSymbol: '⚡',
      },
    ];

    const edges: Array<{ from: string; to: string }> = [
      { from: 'node_source', to: 'node_bronze' },
      { from: 'node_source', to: 'node_pl_bronze' },
      { from: 'node_pl_bronze', to: 'node_bronze' },
      { from: 'node_bronze', to: 'node_nb_curate' },
      { from: 'node_nb_curate', to: 'node_nb_quality' },
      { from: 'node_nb_quality', to: 'node_silver' },
      { from: 'node_silver', to: 'node_nb_silver' },
      { from: 'node_silver', to: 'node_gold' },
      { from: 'node_gold', to: 'node_sm_gold' },
      { from: 'node_gold', to: 'node_master_orchestrator' },
      { from: 'node_sm_gold', to: 'node_master_orchestrator' },
    ];

    // Build hierarchical Enterprise Medallion tree with typed subfolders
    const tree: string[] = [
      `📁 ${rootF}/`,
      `├── 📁 ${rawFolder}/`,
      `│   ├── 📁 01_lakehouse/`,
      `│   │   └── 🏢 ${lhBronze} (Delta Lakehouse)`,
      `│   └── 📁 02_pipelines/`,
      `│       └── ⚡ ${plName} (Data Factory Pipeline)`,
      `├── 📁 ${stageFolder}/`,
      `│   ├── 📁 01_notebooks/`,
      `│   │   └── 📜 ${nbCurateName}.py (PySpark Curation & PII Masking)`,
      `│   └── 📁 02_quality/`,
      `│       └── 📜 ${qualityName}.py (Great Expectations Audit Suite)`,
      `├── 📁 ${silverFolder}/`,
      `│   ├── 📁 01_lakehouse/`,
      `│   │   └── 🏢 ${lhSilver} (Harmonized Delta Lakehouse)`,
      `│   └── 📁 02_notebooks/`,
      `│       └── 📜 nb_silver_transformations.py (SCD2 Delta MERGE Upsert)`,
      `├── 📁 ${goldFolder}/`,
      `│   ├── 📁 01_warehouse/`,
      `│   │   └── 🏛️ ${warehouseName} (Direct Lake T-SQL Warehouse)`,
      `│   └── 📁 02_semantic_models/`,
      `│       └── 📊 ${semanticModelName} (Direct Lake Power BI Semantic Model)`,
      `└── 📁 05 Orchestration/`,
      `    └── 📁 01_pipelines/`,
      `        └── ⚡ ${masterPlName} (End-to-End Orchestrator Pipeline)`,
    ];

    return {
      dagNodes: nodes,
      dagEdges: edges,
      treeItems: tree,
      pysparkCode: pyCurateCode || '# PySpark code synthesized by Worker Agent',
      qualityCode: qualitySuiteCode,
      sqlCode: sqlWarehouseCode,
      jsonSpec: JSON.stringify(plan, null, 2),
      rootFolder: rootF,
      domain: cleanDomain,
    };
  }, [plan]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nodeMap = new Map<string, DagNode>();
  dagNodes.forEach((n) => nodeMap.set(n.id, n));

  return (
    <div
      className={`bolt-workbench-pane-inner ${isFullscreen ? 'fullscreen-mode' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      {/* Workbench Header */}
      <div
        className="workbench-header"
        style={{
          background: '#18181b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0 8px',
          height: '46px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          minWidth: 0,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          className="workbench-tab-group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            minWidth: 0,
            flexShrink: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '2px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '7px',
          }}
        >
          <button
            className={`wb-tab ${activeTab === 'wbPipelines' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbPipelines')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Zap width={13} height={13} />
            <span>Pipelines</span>
            {pipelineCount > 0 && (
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, marginLeft: '3px' }}>
                {pipelineCount}
              </span>
            )}
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbDAG' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbDAG')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Layers width={13} height={13} />
            <span>Architecture</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbMesh' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbMesh')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Network width={13} height={13} />
            <span>Graph</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbTree' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbTree')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <FolderTree width={13} height={13} />
            <span>OneLake</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbCode' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbCode')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Code2 width={13} height={13} />
            <span>Notebooks</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbTable' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbTable')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Table2 width={13} height={13} />
            <span>Tables</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbJson' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbJson')}
            type="button"
            style={{ padding: '4px 8px', fontSize: '11.5px', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <FileCode width={13} height={13} />
            <span>JSON</span>
          </button>
        </div>

        <div
          className="workbench-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {onDeploy && (
            <button
              className="btn-xs-action"
              onClick={onDeploy}
              title="Deploy Pipeline to Fabric REST API"
              type="button"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                boxShadow: '0 0 10px rgba(2, 132, 199, 0.25)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                padding: '4px 10px',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
              }}
            >
              <Play width={12} height={12} fill="#fff" />
              <span>Deploy to Fabric</span>
            </button>
          )}
          <button
            className="icon-button-sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
            type="button"
          >
            {isFullscreen ? <Minimize2 width={13} height={13} /> : <Maximize2 width={13} height={13} />}
          </button>
          {onClose && (
            <button
              className="icon-button-sm"
              onClick={onClose}
              title="Close Workbench"
              type="button"
            >
              <X width={13} height={13} />
            </button>
          )}
        </div>
      </div>

      {/* Workbench Tab Content */}
      <div
        className="workbench-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          width: '100%',
          height: 'calc(100% - 46px)',
          minHeight: 0,
          overflow: 'hidden',
          background: '#121214',
        }}
      >
        {/* 0. Dedicated Pipelines View: Activities Table & Activity Flow Canvas */}
        {activeTab === 'wbPipelines' && (
          <PipelinePane plan={plan as any} domain={domain} />
        )}

        {/* Knowledge Mesh Graph RAG */}
        {activeTab === 'wbMesh' && (
          <div className="wb-view-pane active" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '100%', flex: 1, minHeight: 0, background: '#121214' }}>
            <GraphMeshView plan={plan as Record<string, unknown> | null} projectId={(plan as any)?.project_code || (plan as any)?.project_id} />
          </div>
        )}

        {/* 1. Pipeline Flow SVG Canvas */}
        {activeTab === 'wbDAG' && (
          <div className="wb-view-pane active" style={{ position: 'relative', height: '100%', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#121214' }}>
            {dagNodes.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  color: '#94a3b8',
                  textAlign: 'center',
                  padding: '32px',
                  background: '#121214',
                }}
              >
                <Layers width={44} height={44} style={{ opacity: 0.35, marginBottom: '16px', color: '#71717a' }} />
                <h4 style={{ color: '#f1f5f9', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>No Active Architecture Flow</h4>
                <p style={{ maxWidth: '420px', margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#94a3b8' }}>
                  Prompt the agent or create a project to generate a dynamic Medallion DAG, PySpark curation scripts, and Fabric items.
                </p>
              </div>
            ) : (
              <div
                className="dag-canvas-viewport"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  height: '100%',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: isDragging ? 'none' : 'auto',
                  backgroundColor: '#121214',
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.02) 0%, transparent 80%), radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)',
                  backgroundSize: '100% 100%, 26px 26px',
                  padding: '24px 30px',
                }}
              >
                {/* Canvas Zoom & View Controls Pill */}
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '20px',
                    zIndex: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(24, 24, 27, 0.85)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '3px 6px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                    title="Zoom Out"
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <ZoomOut width={13} height={13} />
                  </button>
                  <span style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: 'monospace', minWidth: '36px', textAlign: 'center' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                    title="Zoom In"
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <ZoomIn width={13} height={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                    title="Reset Zoom & Pan"
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex' }}
                  >
                    <RotateCcw width={12} height={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleFitView}
                    title="Fit to Screen"
                    style={{
                      background: 'rgba(56, 189, 248, 0.14)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      marginLeft: '2px',
                    }}
                  >
                    Fit
                  </button>
                </div>

                <div
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'top left',
                    transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                    minWidth: '1540px',
                    minHeight: '280px',
                  }}
                >
                  <svg
                    viewBox="0 0 1520 270"
                    width="1520"
                    height="270"
                    className="flow-svg"
                    style={{ display: 'block' }}
                  >
                    <defs>
                      <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                      </linearGradient>
                      <linearGradient id="nodeBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#222226" />
                        <stop offset="100%" stopColor="#18181b" />
                      </linearGradient>
                      <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="rgba(56, 189, 248, 0.25)" />
                      </filter>
                    </defs>

                    {/* Edges with animated data pulse */}
                    {dagEdges.map((e, idx) => {
                      const fromNode = nodeMap.get(e.from);
                      const toNode = nodeMap.get(e.to);
                      if (!fromNode || !toNode) return null;
                      const x1 = fromNode.x + 210;
                      const y1 = fromNode.y + 38;
                      const x2 = toNode.x;
                      const y2 = toNode.y + 38;
                      const dx = Math.max((x2 - x1) * 0.45, 30);
                      const cx1 = x1 + dx;
                      const cx2 = x2 - dx;

                      return (
                        <g key={idx} className="flow-edge-group">
                          {/* Ambient underlying path */}
                          <path
                            d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.05)"
                            strokeWidth="3.5"
                          />
                          {/* Pulsing gradient flow line */}
                          <path
                            d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                            fill="none"
                            stroke="url(#edgeGrad)"
                            strokeWidth="1.8"
                            strokeDasharray="6, 5"
                            className="flow-edge-line"
                          />
                          <polygon
                            points={`${x2},${y2} ${x2 - 7},${y2 - 3.5} ${x2 - 7},${y2 + 3.5}`}
                            fill="#38bdf8"
                          />
                        </g>
                      );
                    })}

                    {/* All 9 Nodes + Source Node */}
                    {dagNodes.map((n) => {
                      const isSelected = selectedNode?.id === n.id;
                      // Smart non-destructive truncation that preserves layer and file extensions
                      const displayTitle =
                        n.label.length <= 26
                          ? n.label
                          : `${n.label.slice(0, 15)}…${n.label.slice(n.label.includes('.') ? -8 : -7)}`;

                      return (
                        <g
                          key={n.id}
                          className={`flow-node ${isSelected ? 'active' : ''}`}
                          transform={`translate(${n.x},${n.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(n);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Card background with glass gradient */}
                          <rect
                            x="0"
                            y="0"
                            width="210"
                            height="76"
                            rx="10"
                            fill="url(#nodeBgGrad)"
                            stroke={isSelected ? n.glowColor : 'rgba(255,255,255,0.14)'}
                            strokeWidth={isSelected ? '2' : '1'}
                            style={{
                              filter: isSelected ? `drop-shadow(0 0 16px ${n.glowColor}60)` : 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
                              transition: 'all 0.2s ease',
                            }}
                          />

                          {/* Top Colored Layer Strip */}
                          <path
                            d="M 0,10 Q 0,0 10,0 L 200,0 Q 210,0 210,10 L 210,3 L 0,3 Z"
                            fill={n.glowColor}
                            opacity="0.95"
                          />

                          {/* Connection Port Pins (Left Input, Right Output) */}
                          {n.id !== 'node_source' && (
                            <circle cx="0" cy="38" r="3.5" fill="#18181b" stroke={n.glowColor} strokeWidth="2" />
                          )}
                          {n.id !== 'node_master_orchestrator' && (
                            <circle cx="210" cy="38" r="3.5" fill="#18181b" stroke={n.glowColor} strokeWidth="2" />
                          )}

                          {/* Layer Badge & Folder Tag */}
                          <text x="14" y="24" fontSize="9" fontWeight="700" fill={n.glowColor} letterSpacing="0.06em">
                            {n.layer}
                          </text>
                          {n.folderCategory && (
                            <text x="78" y="24" fontSize="8.5" fill="#64748b" fontFamily="monospace">
                              📁 {n.folderCategory}
                            </text>
                          )}

                          {/* Main Asset Label */}
                          <text
                            x="14"
                            y="45"
                            fontSize="12.5"
                            fontWeight="600"
                            fill={isSelected ? '#ffffff' : '#f1f5f9'}
                            fontFamily="monospace"
                          >
                            {displayTitle}
                          </text>

                          {/* Subtitle / Spec */}
                          <text x="14" y="63" fontSize="9.5" fill="#94a3b8">
                            {n.sub.length > 28 ? n.sub.slice(0, 26) + '…' : n.sub}
                          </text>

                          {/* Live Status Indicator Pulse */}
                          <circle cx="194" cy="20" r="3.5" fill="#10b981" />
                          <circle cx="194" cy="20" r="6.5" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Selected Node Interactive Inspector Footer */}
                {selectedNode && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '24px',
                      right: '24px',
                      zIndex: 30,
                      background: 'rgba(13, 17, 26, 0.94)',
                      backdropFilter: 'blur(16px)',
                      border: `1px solid ${selectedNode.glowColor}55`,
                      borderRadius: '10px',
                      padding: '12px 18px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '18px' }}>{selectedNode.iconSymbol}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#f8fafc', fontFamily: 'monospace' }}>
                            {selectedNode.label}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: `${selectedNode.glowColor}20`,
                              color: selectedNode.glowColor,
                            }}
                          >
                            {selectedNode.layer}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          <span>Target: <code>{selectedNode.fullPath}</code></span>
                          <span style={{ margin: '0 6px', color: '#475569' }}>•</span>
                          <span>{selectedNode.sub}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(selectedNode.type === 'notebook' || selectedNode.code) && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('wbCode')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'rgba(192, 132, 252, 0.15)',
                            border: '1px solid rgba(192, 132, 252, 0.3)',
                            color: '#c084fc',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Code2 width={12} height={12} />
                          <span>Inspect Code</span>
                          <ArrowRight width={11} height={11} />
                        </button>
                      )}
                      {selectedNode.type === 'warehouse' && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('wbCode')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'rgba(234, 179, 8, 0.15)',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            color: '#eab308',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Database width={12} height={12} />
                          <span>Inspect SQL DDL</span>
                          <ArrowRight width={11} height={11} />
                        </button>
                      )}
                      {selectedNode.type === 'lakehouse' && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('wbTable')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'rgba(52, 211, 153, 0.15)',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                            color: '#34d399',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Table2 width={12} height={12} />
                          <span>Inspect Schema</span>
                          <ArrowRight width={11} height={11} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveTab('wbTree')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <FolderTree width={12} height={12} />
                        <span>Locate in OneLake</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedNode(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                        }}
                        title="Close Inspector"
                      >
                        <X width={14} height={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. OneLake Tree */}
        {activeTab === 'wbTree' && (
          <OneLakeTreePane
            treeItems={treeItems}
            rootFolder={rootFolder}
            workspaceName={((plan as Record<string, unknown>)?.target_workspace as string) || 'PBT_DATA_AGENT'}
          />
        )}

        {/* 3. PySpark Studio Code Editor */}
        {activeTab === 'wbCode' && (
          <CodeEditorPane
            pysparkCode={pysparkCode}
            qualityCode={qualityCode}
            sqlCode={sqlCode}
            domain={domain}
            selectedLabel={selectedNode?.label}
          />
        )}

        {/* 4. Delta Schema Viewer */}
        {activeTab === 'wbTable' && (
          <DeltaSchemaPane
            schemaContracts={(plan as any)?.schema_contracts}
            tables={(plan as any)?.tables}
            domain={domain}
          />
        )}

        {/* 5. Fabric JSON Spec */}
        {activeTab === 'wbJson' && (
          <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#121214' }}>
            <div className="code-editor-header" style={{ background: '#18181b', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="code-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="wb-code-file-badge">fabric-plan.json</span>
                <span className="wb-layer-pill">Trident Payload</span>
              </div>
              <div className="code-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="wb-code-stat-badge" style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace' }}>{jsonSpec.split('\n').length} lines</span>
                <button
                  className="btn-copy-code"
                  type="button"
                  onClick={() => handleCopy(jsonSpec)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
            <div className="code-editor-view-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px', background: '#121214' }}>
              <pre className="code-editor-view" style={{ background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px', color: '#e2e8f0', margin: 0 }}>
                <code>{jsonSpec}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
