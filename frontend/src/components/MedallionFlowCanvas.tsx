import React, { useState } from 'react';
import {
  Layers,
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

interface MedallionFlowCanvasProps {
  plan?: IngestionPlan | null;
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
}

const DEFAULT_NODES: DagNode[] = [
  {
    id: 'node_source',
    label: 'Azure SQL (sales_db)',
    type: 'source',
    layer: 'SOURCE',
    sub: 'CDC Ingestion Stream',
    status: 'live',
    x: 40,
    y: 120,
  },
  {
    id: 'node_bronze',
    label: 'lh_enterprise_bronze',
    type: 'lakehouse',
    layer: 'BRONZE',
    sub: 'Raw Append Only Delta',
    status: 'live',
    x: 320,
    y: 50,
  },
  {
    id: 'node_nb_bronze',
    label: 'nb_raw_ingest_cdc',
    type: 'notebook',
    layer: 'PYSPARK',
    sub: 'Batch Streaming Ingest',
    status: 'live',
    x: 320,
    y: 180,
  },
  {
    id: 'node_silver',
    label: 'lh_enterprise_silver',
    type: 'lakehouse',
    layer: 'SILVER',
    sub: 'Delta MERGE Deduplication',
    status: 'live',
    x: 600,
    y: 50,
  },
  {
    id: 'node_nb_silver',
    label: 'nb_silver_merge_upsert',
    type: 'notebook',
    layer: 'PYSPARK',
    sub: 'SCD Type-1 / Type-2 Triage',
    status: 'live',
    x: 600,
    y: 180,
  },
  {
    id: 'node_gold',
    label: 'lh_enterprise_gold',
    type: 'lakehouse',
    layer: 'GOLD',
    sub: 'Kimball Star Schema',
    status: 'live',
    x: 880,
    y: 50,
  },
  {
    id: 'node_pipeline',
    label: 'pl_daily_enterprise_etl',
    type: 'pipeline',
    layer: 'PIPELINE',
    sub: 'Recurrence: 02:00 UTC',
    status: 'live',
    x: 880,
    y: 180,
  },
];

const DEFAULT_EDGES = [
  { from: 'node_source', to: 'node_bronze' },
  { from: 'node_source', to: 'node_nb_bronze' },
  { from: 'node_bronze', to: 'node_silver' },
  { from: 'node_nb_bronze', to: 'node_nb_silver' },
  { from: 'node_silver', to: 'node_gold' },
  { from: 'node_nb_silver', to: 'node_pipeline' },
  { from: 'node_gold', to: 'node_pipeline' },
];

export const MedallionFlowCanvas: React.FC<MedallionFlowCanvasProps> = ({
  plan: _plan,
  onDeploy,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'wbDAG' | 'wbTree' | 'wbCode' | 'wbTable' | 'wbJson'>('wbDAG');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedNode, setSelectedNode] = useState<DagNode | null>(null);

  const samplePySpark = `# Fabric AI Studio — Production Medallion MERGE Upsert
from delta.tables import DeltaTable
from pyspark.sql.functions import col, current_timestamp, sha2

# 1. Load Raw Bronze Delta Lake
df_bronze = spark.read.format("delta").table("lh_enterprise_bronze.sales_orders")

# 2. Add System Audit Metadata & SHA-256 Surrogate Key
df_silver = df_bronze \\
    .withColumn("order_sk", sha2(col("order_id").cast("string"), 256)) \\
    .withColumn("_ingested_at", current_timestamp())

# 3. Target Silver Delta MERGE Upsert
target_table = DeltaTable.forName(spark, "lh_enterprise_silver.sales_orders")

target_table.alias("tgt").merge(
    df_silver.alias("src"),
    "tgt.order_id = src.order_id"
).whenMatchedUpdateAll() \\
 .whenNotMatchedInsertAll() \\
 .execute()

print("✅ Delta MERGE completed successfully into lh_enterprise_silver.")
`;

  const sampleJson = `{
  "name": "pl_daily_enterprise_etl",
  "properties": {
    "activities": [
      {
        "name": "Run_Bronze_Ingest",
        "type": "FabricNotebook",
        "dependsOn": []
      },
      {
        "name": "Run_Silver_Delta_Merge",
        "type": "FabricNotebook",
        "dependsOn": [{ "activity": "Run_Bronze_Ingest", "dependencyConditions": ["Succeeded"] }]
      },
      {
        "name": "Run_Gold_Star_Schema",
        "type": "FabricNotebook",
        "dependsOn": [{ "activity": "Run_Silver_Delta_Merge", "dependencyConditions": ["Succeeded"] }]
      }
    ],
    "triggers": [
      {
        "type": "ScheduleTrigger",
        "recurrence": { "frequency": "Day", "interval": 1, "schedule": { "hours": [2], "minutes": [0] } }
      }
    ]
  }
}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nodeMap = new Map<string, DagNode>();
  DEFAULT_NODES.forEach((n) => nodeMap.set(n.id, n));

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
        {/* 1. Pipeline Flow SVG Canvas */}
        {activeTab === 'wbDAG' && (
          <div className="wb-view-pane active">
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
                {DEFAULT_EDGES.map((e, idx) => {
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
                {DEFAULT_NODES.map((n) => {
                  const isLake = n.type === 'lakehouse';
                  const isNote = n.type === 'notebook';
                  const isPipe = n.type === 'pipeline';
                  const accentColor = isLake ? '#0ea5e9' : isNote ? '#fbbf24' : isPipe ? '#f43f5e' : '#38bdf8';

                  return (
                    <g
                      key={n.id}
                      className={`flow-node ${selectedNode?.id === n.id ? 'active' : ''}`}
                      transform={`translate(${n.x},${n.y})`}
                      onClick={() => setSelectedNode(n)}
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
            <div className="tree-container">
              <div className="tree-node-item">📁 AI_Test_Folder/</div>
              <div className="tree-node-item pl-4">├── 🏢 lh_enterprise_bronze (Delta Lakehouse)</div>
              <div className="tree-node-item pl-4">├── 🏢 lh_enterprise_silver (Delta Lakehouse)</div>
              <div className="tree-node-item pl-4">├── 🏢 lh_enterprise_gold (Direct Lake Lakehouse)</div>
              <div className="tree-node-item pl-4">├── 📜 nb_sales_silver_merge (PySpark Notebook)</div>
              <div className="tree-node-item pl-4">└── ⚡ pl_daily_enterprise_etl (Data Factory Pipeline)</div>
            </div>
          </div>
        )}

        {/* 3. PySpark Studio Code Editor */}
        {activeTab === 'wbCode' && (
          <div className="wb-view-pane active">
            <div className="code-editor-header">
              <div className="code-header-left">
                <span className="wb-code-file-badge">nb_sales_silver_merge.py</span>
                <span className="wb-layer-pill">PySpark 3.4</span>
              </div>
              <div className="code-header-right">
                <span className="wb-code-stat-badge">22 lines</span>
                <button
                  className="btn-copy-code"
                  type="button"
                  onClick={() => handleCopy(samplePySpark)}
                >
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
            <div className="code-editor-view-container">
              <pre className="code-editor-view">
                <code>{samplePySpark}</code>
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
                  <h4>lh_enterprise_silver.sales_orders</h4>
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
                      <td><strong>order_sk</strong></td>
                      <td><code>string (SHA-256)</code></td>
                      <td>No</td>
                      <td>Yes (Surrogate)</td>
                      <td>Silver</td>
                    </tr>
                    <tr>
                      <td>order_id</td>
                      <td><code>bigint</code></td>
                      <td>No</td>
                      <td>Yes (Business Key)</td>
                      <td>Bronze $\to$ Silver</td>
                    </tr>
                    <tr>
                      <td>customer_id</td>
                      <td><code>int</code></td>
                      <td>No</td>
                      <td>FK $\to$ dim_customer</td>
                      <td>Bronze $\to$ Silver</td>
                    </tr>
                    <tr>
                      <td>order_amount</td>
                      <td><code>decimal(18,2)</code></td>
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
                <span className="wb-code-file-badge">pipeline-definition.json</span>
                <span className="wb-layer-pill">Trident Payload</span>
              </div>
              <div className="code-header-right">
                <span className="wb-code-stat-badge">26 lines</span>
                <button
                  className="btn-copy-code"
                  type="button"
                  onClick={() => handleCopy(sampleJson)}
                >
                  {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>
            <div className="code-editor-view-container">
              <pre className="code-editor-view">
                <code>{sampleJson}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
