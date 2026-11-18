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
} from 'lucide-react';
import { IngestionPlan } from '../types';
import { GraphMeshView } from './graph/GraphMeshView';
import { OneLakeTreePane } from './workbench/OneLakeTreePane';
import { CodeEditorPane } from './workbench/CodeEditorPane';
import { DeltaSchemaPane } from './workbench/DeltaSchemaPane';

interface MedallionFlowCanvasProps {
  plan?: IngestionPlan | Record<string, unknown> | null;
  onDeploy?: () => void;
  onClose?: () => void;
}

interface DagNode {
  id: string;
  label: string;
  type: 'source' | 'lakehouse' | 'notebook' | 'pipeline';
  layer: string;
  sub: string;
  status: 'pending' | 'deploying' | 'live' | 'error';
  x: number;
  y: number;
  code?: string;
}


export const MedallionFlowCanvas: React.FC<MedallionFlowCanvasProps> = ({
  plan,
  onDeploy,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wbDAG' | 'wbMesh' | 'wbTree' | 'wbCode' | 'wbTable' | 'wbJson'>('wbDAG');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(null);

  // Dynamic DAG Computation from plan
  const { dagNodes, dagEdges, treeItems, pysparkCode, sqlCode, jsonSpec, rootFolder, domain } = React.useMemo(() => {
    if (!plan || typeof plan !== 'object') {
      return {
        dagNodes: [],
        dagEdges: [],
        treeItems: [],
        pysparkCode: '# No pipeline code generated yet.\n# Run an architecture prompt or attach an intake spec to synthesize PySpark Delta logic.',
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

    const nodes: DagNode[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    // Source Node
    nodes.push({
      id: 'node_source',
      label: `${rootF} (Source Stream)`,
      type: 'source',
      layer: 'SOURCE',
      sub: 'OneLake Landing Zone',
      status: 'live',
      x: 40,
      y: 120,
    });

    // Lakehouses & Notebooks
    const lhBronze = lakehouses.find((l) => l.toLowerCase().includes('bronze')) || lakehouses[0] || `lh_${cleanDomain}_bronze`;
    const lhSilver = lakehouses.find((l) => l.toLowerCase().includes('silver')) || lakehouses[1] || `lh_${cleanDomain}_silver`;

    const nbBronze = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('bronze'));
    const nbSilver = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('silver')) || notebooks[0];

    nodes.push({
      id: 'node_bronze',
      label: lhBronze,
      type: 'lakehouse',
      layer: 'BRONZE',
      sub: 'Raw Ingestion Zone',
      status: 'live',
      x: 320,
      y: 50,
    });

    if (nbBronze) {
      nodes.push({
        id: 'node_nb_bronze',
        label: String(nbBronze.name || 'nb_bronze_ingest'),
        type: 'notebook',
        layer: 'PYSPARK',
        sub: String(nbBronze.description || 'Source -> Bronze Ingest'),
        status: 'live',
        x: 320,
        y: 180,
        code: (nbBronze.pyspark_code as string) || (nbBronze.pyspark as string) || '',
      });
      edges.push({ from: 'node_source', to: 'node_bronze' });
      edges.push({ from: 'node_source', to: 'node_nb_bronze' });
    }

    nodes.push({
      id: 'node_silver',
      label: lhSilver,
      type: 'lakehouse',
      layer: 'SILVER',
      sub: 'Delta MERGE Deduplication',
      status: 'live',
      x: 600,
      y: 50,
    });

    const pyCurateCode =
      (p.pyspark_code as string) ||
      (nbSilver?.pyspark_code as string) ||
      (nbSilver?.pyspark as string) ||
      (nbSilver?.code as string) ||
      '';

    const sqlWarehouseCode = (p.sql_code as string) || '';

    if (nbSilver || pyCurateCode) {
      nodes.push({
        id: 'node_nb_silver',
        label: String(nbSilver?.name || `nb_${cleanDomain}_curate`),
        type: 'notebook',
        layer: 'PYSPARK',
        sub: 'Bronze -> Silver MERGE & Masking',
        status: 'live',
        x: 600,
        y: 180,
        code: pyCurateCode,
      });
      edges.push({ from: 'node_bronze', to: 'node_silver' });
      edges.push({ from: 'node_bronze', to: 'node_nb_silver' });
    }

    nodes.push({
      id: 'node_gold',
      label: warehouseName,
      type: 'lakehouse',
      layer: 'GOLD',
      sub: 'Kimball Star Schema & Direct Lake',
      status: 'live',
      x: 880,
      y: 50,
    });
    edges.push({ from: 'node_silver', to: 'node_gold' });

    if (pipeline) {
      const plName = typeof pipeline === 'object' ? String(pipeline.name || `pl_${cleanDomain}_bronze_ingest`) : String(pipeline);
      const schedStr =
        typeof pipeline === 'object' && typeof pipeline.schedule === 'object'
          ? String((pipeline.schedule as Record<string, unknown>).human || 'Hourly Micro-Batch CDC')
          : 'Hourly Micro-Batch CDC';

      nodes.push({
        id: 'node_pipeline',
        label: plName,
        type: 'pipeline',
        layer: 'PIPELINE',
        sub: schedStr,
        status: 'live',
        x: 1140,
        y: 120,
      });
      edges.push({ from: 'node_bronze', to: 'node_pipeline' });
    }

    // Build hierarchical 5-item Medallion tree
    const rawFolder = (p.folders as Record<string, string>)?.raw || '01 Raw';
    const stageFolder = (p.folders as Record<string, string>)?.stage || '02 Stage';
    const silverFolder = (p.folders as Record<string, string>)?.silver || '03 Silver';
    const goldFolder = (p.folders as Record<string, string>)?.gold || '04 Gold';
    const plName = typeof pipeline === 'object' ? String(pipeline.name || `pl_${cleanDomain}_bronze_ingest`) : String(pipeline || `pl_${cleanDomain}_bronze_ingest`);
    const nbName = String(nbSilver?.name || `nb_${cleanDomain}_curate`);

    const tree: string[] = [
      `📁 ${rootF}/`,
      `├── 📁 ${rawFolder}/`,
      `│   ├── 🏢 ${lhBronze} (Delta Lakehouse)`,
      `│   └── ⚡ ${plName} (Data Factory Pipeline)`,
      `├── 📁 ${stageFolder}/`,
      `│   └── 📜 ${nbName}.py [PySpark Delta Curation]`,
      `├── 📁 ${silverFolder}/`,
      `│   └── 🏢 ${lhSilver} (Delta Lakehouse)`,
      `└── 📁 ${goldFolder}/`,
      `    └── 🏛️ ${warehouseName} (Direct Lake T-SQL Warehouse)`,
    ];

    return {
      dagNodes: nodes,
      dagEdges: edges,
      treeItems: tree,
      pysparkCode: pyCurateCode || '# PySpark code synthesized by Worker Agent',
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
    <div className={`bolt-workbench-pane-inner ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Workbench Header */}
      <div className="workbench-header">
        <div className="workbench-tab-group">
          <button
            className={`wb-tab ${activeTab === 'wbDAG' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbDAG')}
            type="button"
          >
            <Layers width={13} height={13} />
            <span>Pipeline Flow</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbMesh' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbMesh')}
            type="button"
          >
            <Network width={13} height={13} />
            <span>Relationship Graph</span>
            <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600, marginLeft: '4px' }}>Lineage</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbTree' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbTree')}
            type="button"
          >
            <FolderTree width={13} height={13} />
            <span>OneLake Tree</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbCode' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbCode')}
            type="button"
          >
            <Code2 width={13} height={13} />
            <span>PySpark Studio</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbTable' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbTable')}
            type="button"
          >
            <Table2 width={13} height={13} />
            <span>Delta Schema</span>
          </button>
          <button
            className={`wb-tab ${activeTab === 'wbJson' ? 'active' : ''}`}
            onClick={() => setActiveTab('wbJson')}
            type="button"
          >
            <FileCode width={13} height={13} />
            <span>Fabric JSON</span>
          </button>
        </div>

        <div className="workbench-actions">
          {onDeploy && (
            <button
              className="btn-xs-action"
              onClick={onDeploy}
              title="Deploy Pipeline to Fabric REST API"
              type="button"
            >
              <Play width={12} height={12} />
              <span>Deploy</span>
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
      <div className="workbench-content">
        {/* Knowledge Mesh Graph RAG */}
        {activeTab === 'wbMesh' && (
          <div className="wb-view-pane active" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '100%', minHeight: '480px' }}>
            <GraphMeshView plan={plan as Record<string, unknown> | null} projectId={(plan as any)?.project_code || (plan as any)?.project_id} />
          </div>
        )}

        {/* 1. Pipeline Flow SVG Canvas */}
        {activeTab === 'wbDAG' && (
          <div className="wb-view-pane active">
            {dagNodes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '340px', color: '#94a3b8', textAlign: 'center', padding: '32px' }}>
                <Layers width={36} height={36} style={{ opacity: 0.35, marginBottom: '12px' }} />
                <h4 style={{ color: '#e2e8f0', margin: '0 0 6px 0', fontSize: '15px' }}>No Active Architecture Flow</h4>
                <p style={{ maxWidth: '380px', margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
                  Prompt the agent or create a project to generate a dynamic Medallion DAG, PySpark curation scripts, and Fabric items.
                </p>
              </div>
            ) : (
            <div className="dag-canvas-viewport">
              <svg
                viewBox="0 0 1180 320"
                width="100%"
                height="100%"
                className="flow-svg"
                style={{ minHeight: '340px' }}
              >
                <defs>
                  <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="nodeGrad_source" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0b1d3a" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#061325" stopOpacity="0.98" />
                  </linearGradient>
                  <linearGradient id="nodeGrad_lakehouse" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#092642" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#051627" stopOpacity="0.98" />
                  </linearGradient>
                  <linearGradient id="nodeGrad_notebook" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#33220b" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#1c1205" stopOpacity="0.98" />
                  </linearGradient>
                  <linearGradient id="nodeGrad_pipeline" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b0f1d" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#1f060d" stopOpacity="0.98" />
                  </linearGradient>
                </defs>

                {/* Edges */}
                {dagEdges.map((e, idx) => {
                  const fromNode = nodeMap.get(e.from);
                  const toNode = nodeMap.get(e.to);
                  if (!fromNode || !toNode) return null;
                  const x1 = fromNode.x + 240;
                  const y1 = fromNode.y + 36;
                  const x2 = toNode.x;
                  const y2 = toNode.y + 36;
                  const dx = Math.max((x2 - x1) * 0.5, 40);
                  const cx1 = x1 + dx;
                  const cx2 = x2 - dx;

                  return (
                    <g key={idx} className="flow-edge-group">
                      <path
                        d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="rgba(14, 165, 233, 0.2)"
                        strokeWidth="4"
                      />
                      <path
                        d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="url(#edgeGrad)"
                        strokeWidth="2"
                        strokeDasharray="7, 5"
                        className="flow-edge-line"
                      />
                      <polygon
                        points={`${x2},${y2} ${x2 - 8},${y2 - 4.5} ${x2 - 8},${y2 + 4.5}`}
                        fill="#38bdf8"
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {dagNodes.map((n) => {
                  const isLake = n.type === 'lakehouse';
                  const isNote = n.type === 'notebook';
                  const isPipe = n.type === 'pipeline';
                  const accentColor = isLake ? '#0ea5e9' : isNote ? '#fbbf24' : isPipe ? '#f43f5e' : '#38bdf8';

                  return (
                    <g
                      key={n.id}
                      className={`flow-node ${selectedNode?.id === n.id ? 'active' : ''}`}
                      transform={`translate(${n.x},${n.y})`}
                      onClick={() => {
                        setSelectedNode(n);
                        if (n.type === 'notebook') {
                          setActiveTab('wbCode');
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="240"
                        height="72"
                        rx="12"
                        fill={`url(#nodeGrad_${n.type})`}
                        stroke={selectedNode?.id === n.id ? '#38bdf8' : 'rgba(255,255,255,0.12)'}
                        strokeWidth="1.3"
                        className="flow-node-bg"
                      />
                      {/* Top Accent Strip */}
                      <path
                        d="M 0,12 Q 0,0 12,0 L 228,0 Q 240,0 240,12 L 240,3.5 L 0,3.5 Z"
                        fill={accentColor}
                        opacity="0.95"
                      />
                      {/* Title */}
                      <text x="16" y="28" fontSize="13" fontWeight="600" fill="#f8fafc">
                        {n.label}
                      </text>
                      {/* Badge */}
                      <text x="16" y="46" fontSize="9.5" fontWeight="700" fill={accentColor} letterSpacing="0.06em">
                        {n.layer}
                      </text>
                      {/* Sub */}
                      <text x="16" y="60" fontSize="10" fill="#94a3b8">
                        {n.sub}
                      </text>
                      {/* Status Dot */}
                      <circle cx="224" cy="20" r="4.5" fill="#10b981" />
                    </g>
                  );
                })}
              </svg>
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
          <div className="wb-view-pane active">
            <div className="code-editor-header">
              <div className="code-header-left">
                <span className="wb-code-file-badge">fabric-plan.json</span>
                <span className="wb-layer-pill">Trident Payload</span>
              </div>
              <div className="code-header-right">
                <span className="wb-code-stat-badge">{jsonSpec.split('\n').length} lines</span>
                <button
                  className="btn-copy-code"
                  type="button"
                  onClick={() => handleCopy(jsonSpec)}
                >
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
            <div className="code-editor-view-container">
              <pre className="code-editor-view">
                <code>{jsonSpec}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
