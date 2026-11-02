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
  RefreshCw,
  X,
} from 'lucide-react';
import { IngestionPlan } from '../types';
import { GraphMeshView } from './graph/GraphMeshView';

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
  const { dagNodes, dagEdges, treeItems, pysparkCode, jsonSpec } = React.useMemo(() => {
    if (!plan || typeof plan !== 'object') {
      return {
        dagNodes: [],
        dagEdges: [],
        treeItems: [],
        pysparkCode: '# No pipeline code generated yet.\n# Run an architecture prompt or attach an intake spec to synthesize PySpark Delta logic.',
        jsonSpec: JSON.stringify(
          {
            status: 'idle',
            message: 'No active plan generated yet.',
          },
          null,
          2
        ),
      };
    }

    const p = plan as Record<string, unknown>;
    const folder = (p.folder as string) || 'AI_Test_Folder';
    const lakehouses = (p.lakehouses as string[]) || [];
    const notebooks = (p.notebooks as Array<Record<string, unknown>>) || [];
    const pipeline = p.pipeline as Record<string, unknown> | string | undefined;

    const nodes: DagNode[] = [];
    const edges: Array<{ from: string; to: string }> = [];

    // Source Node
    nodes.push({
      id: 'node_source',
      label: `${folder} (Source Stream)`,
      type: 'source',
      layer: 'SOURCE',
      sub: 'OneLake Landing Zone',
      status: 'live',
      x: 40,
      y: 120,
    });

    // Lakehouses & Notebooks
    const lhBronze = lakehouses.find((l) => l.toLowerCase().includes('bronze')) || lakehouses[0] || 'lh_bronze';
    const lhSilver = lakehouses.find((l) => l.toLowerCase().includes('silver')) || lakehouses[1] || 'lh_silver';
    const lhGold = lakehouses.find((l) => l.toLowerCase().includes('gold')) || lakehouses[2] || 'lh_gold';

    const nbBronze = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('bronze')) || notebooks[0];
    const nbSilver = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('silver')) || notebooks[1];
    const nbGold = notebooks.find((n) => String(n.layer || n.name).toLowerCase().includes('gold')) || notebooks[2];

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

    if (nbSilver) {
      nodes.push({
        id: 'node_nb_silver',
        label: String(nbSilver.name || 'nb_silver_merge'),
        type: 'notebook',
        layer: 'PYSPARK',
        sub: String(nbSilver.description || 'Bronze -> Silver MERGE'),
        status: 'live',
        x: 600,
        y: 180,
        code: (nbSilver.pyspark_code as string) || (nbSilver.pyspark as string) || '',
      });
      edges.push({ from: 'node_bronze', to: 'node_silver' });
      if (nbBronze) edges.push({ from: 'node_nb_bronze', to: 'node_nb_silver' });
    }

    nodes.push({
      id: 'node_gold',
      label: lhGold,
      type: 'lakehouse',
      layer: 'GOLD',
      sub: 'Star Schema & Direct Lake',
      status: 'live',
      x: 880,
      y: 50,
    });

    if (nbGold) {
      nodes.push({
        id: 'node_nb_gold',
        label: String(nbGold.name || 'nb_gold_star'),
        type: 'notebook',
        layer: 'PYSPARK',
        sub: String(nbGold.description || 'Silver -> Gold Dimensional Modeling'),
        status: 'live',
        x: 880,
        y: 180,
        code: (nbGold.pyspark_code as string) || (nbGold.pyspark as string) || '',
      });
      edges.push({ from: 'node_silver', to: 'node_gold' });
      if (nbSilver) edges.push({ from: 'node_nb_silver', to: 'node_nb_gold' });
    }

    if (pipeline) {
      const plName = typeof pipeline === 'object' ? String(pipeline.name || 'pl_daily_sales') : String(pipeline);
      const schedStr =
        typeof pipeline === 'object' && typeof pipeline.schedule === 'object'
          ? String((pipeline.schedule as Record<string, unknown>).human || 'Daily at 02:00 UTC')
          : 'Daily at 02:00 UTC';

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

      if (nbGold) {
        edges.push({ from: 'node_nb_gold', to: 'node_pipeline' });
      } else if (nbSilver) {
        edges.push({ from: 'node_nb_silver', to: 'node_pipeline' });
      }
    }

    // Build tree
    const folderClean = folder.replace('AI_Test_Folder/', '').trim();
    const tree: string[] = ['📁 AI_Test_Folder/'];
    if (folderClean && folderClean !== 'AI_Test_Folder') {
      tree.push(`└── 📁 ${folderClean}/`);
      const prefix = '    ';
      lakehouses.forEach((lh) => tree.push(`${prefix}├── 🏢 ${lh} (Delta Lakehouse)`));
      notebooks.forEach((nb) => tree.push(`${prefix}├── 📜 ${nb.name} [${nb.layer || 'PySpark'}]`));
      if (pipeline) {
        const plName = typeof pipeline === 'object' ? String(pipeline.name || 'pl_pipeline') : String(pipeline);
        tree.push(`${prefix}└── ⚡ ${plName} (Data Factory Pipeline)`);
      }
    } else {
      lakehouses.forEach((lh) => tree.push(`├── 🏢 ${lh} (Delta Lakehouse)`));
      notebooks.forEach((nb) => tree.push(`├── 📜 ${nb.name} [${nb.layer || 'PySpark'}]`));
      if (pipeline) {
        const plName = typeof pipeline === 'object' ? String(pipeline.name || 'pl_pipeline') : String(pipeline);
        tree.push(`└── ⚡ ${plName} (Data Factory Pipeline)`);
      }
    }

    // Code sample
    const primaryCode =
      (notebooks[0]?.pyspark_code as string) ||
      (notebooks[0]?.pyspark as string) ||
      '# PySpark code synthesized by Worker Agent';

    return {
      dagNodes: nodes,
      dagEdges: edges,
      treeItems: tree,
      pysparkCode: primaryCode,
      jsonSpec: JSON.stringify(plan, null, 2),
    };
  }, [plan]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nodeMap = new Map<string, DagNode>();
  dagNodes.forEach((n) => nodeMap.set(n.id, n));

  const activeCode = selectedNode?.code || pysparkCode;

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
          <div className="wb-view-pane active">
            <div className="tree-toolbar">
              <span className="tree-toolbar-label">OneLake Workspace Assets (AI_Test_Folder)</span>
              <button className="btn-tree-refresh" type="button">
                <RefreshCw width={12} height={12} />
                <span>Sync Items</span>
              </button>
            </div>
            {treeItems.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '260px', color: '#94a3b8', textAlign: 'center', padding: '32px' }}>
                <FolderTree width={32} height={32} style={{ opacity: 0.35, marginBottom: '10px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No OneLake workspace folder hierarchy generated yet.</p>
              </div>
            ) : (
            <div className="tree-container">
              {treeItems.map((item, idx) => {
                const isNested = item.startsWith('    ');
                const isChild = item.startsWith('├──') || item.startsWith('└──');
                const padClass = isNested ? 'pl-8' : (isChild ? 'pl-4' : '');
                return (
                  <div
                    key={idx}
                    className={`tree-node-item ${padClass}`}
                    style={{ whiteSpace: 'pre', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
                  >
                    {item}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* 3. PySpark Studio Code Editor */}
        {activeTab === 'wbCode' && (
          <div className="wb-view-pane active">
            <div className="code-editor-header">
              <div className="code-header-left">
                <span className="wb-code-file-badge">{selectedNode ? `${selectedNode.label}.py` : 'nb_notebook.py'}</span>
                <span className="wb-layer-pill">{selectedNode?.layer || 'PySpark 3.4'}</span>
              </div>
              <div className="code-header-right">
                <span className="wb-code-stat-badge">{activeCode.split('\n').length} lines</span>
                <button
                  className="btn-copy-code"
                  type="button"
                  onClick={() => handleCopy(activeCode)}
                >
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
            <div className="code-editor-view-container">
              <pre className="code-editor-view">
                <code>{activeCode}</code>
              </pre>
            </div>
          </div>
        )}

        {/* 4. Delta Schema Viewer */}
        {activeTab === 'wbTable' && (
          <div className="wb-view-pane active">
            <div className="schema-view-wrapper">
              <div className="schema-view-header">
                <div className="schema-header-left">
                  <h4>lh_silver.cleansed_sales</h4>
                  <span className="schema-pill">Silver Delta Table</span>
                </div>
              </div>
              <div className="schema-table-container">
                <table className="schema-data-table">
                  <thead>
                    <tr>
                      <th>Column Name</th>
                      <th>Data Type</th>
                      <th>Nullable</th>
                      <th>Primary Key</th>
                      <th>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>TransactionID</strong></td>
                      <td><code>string (SHA-256)</code></td>
                      <td>No</td>
                      <td>Yes (Business PK)</td>
                      <td>Silver</td>
                    </tr>
                    <tr>
                      <td>CustomerID</td>
                      <td><code>string</code></td>
                      <td>No</td>
                      <td>FK $\to$ dim_customer</td>
                      <td>Bronze $\to$ Silver</td>
                    </tr>
                    <tr>
                      <td>ProductID</td>
                      <td><code>string</code></td>
                      <td>No</td>
                      <td>FK $\to$ dim_product</td>
                      <td>Bronze $\to$ Silver</td>
                    </tr>
                    <tr>
                      <td>SalesAmount</td>
                      <td><code>decimal(10,2)</code></td>
                      <td>Yes</td>
                      <td>No</td>
                      <td>Bronze $\to$ Silver</td>
                    </tr>
                    <tr>
                      <td>_ingested_at</td>
                      <td><code>timestamp</code></td>
                      <td>No</td>
                      <td>Audit Column</td>
                      <td>System Metadata</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
