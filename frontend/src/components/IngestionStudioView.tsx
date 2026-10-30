import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  fetchConnectors,
  discoverConnectorTables,
  generateMedallionPlan,
} from '../services/api';
import { ConnectorSummary, DiscoveredTable, IngestionPlan } from '../types';

interface IngestionStudioViewProps {
  onPlanGenerated: (plan: IngestionPlan) => void;
}

export const IngestionStudioView: React.FC<IngestionStudioViewProps> = ({
  onPlanGenerated,
}) => {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorSummary | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [discoveredTables, setDiscoveredTables] = useState<DiscoveredTable[]>([]);
  const [schedule, setSchedule] = useState('Nightly at 02:00 UTC');
  const [tableSearch, setTableSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<IngestionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectors()
      .then((data) => {
        setConnectors(data);
        if (data.length > 0) {
          setSelectedConnector(data[0]);
          const initialParams: Record<string, string> = {};
          (data[0].fields || []).forEach((f) => {
            initialParams[f.name] = String(f.default || '');
          });
          setParams(initialParams);
        }
      })
      .catch((e) => console.error(e));
  }, []);

  const handleSelectConnector = (conn: ConnectorSummary) => {
    setSelectedConnector(conn);
    const initialParams: Record<string, string> = {};
    (conn.fields || []).forEach((f) => {
      initialParams[f.name] = String(f.default || '');
    });
    setParams(initialParams);
    setStep(2);
  };

  const handleDiscover = async () => {
    if (!selectedConnector) return;
    setLoading(true);
    setError(null);
    try {
      const tables = await discoverConnectorTables(selectedConnector.id, params);
      setDiscoveredTables(
        tables.map((t) => ({ ...t, selected: true }))
      );
      setStep(3);
    } catch (e) {
      console.error('Connector discovery failed', e);
      setError(e instanceof Error ? e.message : 'Failed to discover connector tables. Verify connection parameters.');
      setDiscoveredTables([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    setDiscoveredTables((prev) =>
      prev.map((t) => (t.name === tableName ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleCreatePlan = async () => {
    if (!selectedConnector) return;
    setLoading(true);
    setError(null);
    const selected = discoveredTables.filter((t) => t.selected);
    try {
      const plan = await generateMedallionPlan(selectedConnector.id, selected);
      setGeneratedPlan(plan);
      onPlanGenerated(plan);
    } catch (e) {
      console.error('Plan generation failed', e);
      setError(e instanceof Error ? e.message : 'Failed to generate Medallion ingestion plan.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = discoveredTables.filter((t) => t.selected).length;
  const filteredTables = discoveredTables.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <section className="view-panel active" id="viewIngestion">
      <div className="ingestion-studio-layout">
        {/* Left Config Pane */}
        <div className="ingestion-config-pane">
          <div className="pane-header">
            <h2 className="pane-title">Source Configuration</h2>
            <span className="step-indicator" id="ingestStepBadge">
              Step {step} of 3
            </span>
          </div>

          {error && (
            <div style={{ margin: '8px 12px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 14px', color: '#fca5a5', fontSize: '12.5px' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Step 1: Connector Picker */}
          {step === 1 && (
            <div className="ingest-step-section">
              <label className="form-label">SELECT ENTERPRISE DATA SOURCE</label>
              <div className="connector-grid">
                {connectors.map((c) => (
                  <div
                    key={c.id}
                    className={`connector-card ${selectedConnector?.id === c.id ? 'active' : ''}`}
                    onClick={() => handleSelectConnector(c)}
                  >
                    <div className="connector-card-icon">
                      <Database width={18} height={18} className="text-cyan-400" />
                    </div>
                    <div className="connector-card-info">
                      <span className="connector-card-name">{c.name}</span>
                      <span className="connector-card-category">{c.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Connection Parameters */}
          {step === 2 && selectedConnector && (
            <div className="ingest-step-section">
              <div className="section-title-row">
                <label className="form-label">{selectedConnector.name.toUpperCase()} PARAMETERS</label>
                <button
                  className="btn-link"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  Change Source
                </button>
              </div>
              <form className="params-form" onSubmit={(e) => { e.preventDefault(); handleDiscover(); }}>
                {(selectedConnector.fields || []).map((f) => (
                  <div key={f.name} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input
                      type={f.type === 'password' ? 'password' : 'text'}
                      className="form-input"
                      value={params[f.name] || ''}
                      onChange={(e) => setParams({ ...params, [f.name]: e.target.value })}
                      placeholder={`Enter ${f.label.toLowerCase()}...`}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary-full"
                  onClick={handleDiscover}
                  disabled={loading}
                >
                  <Search width={14} height={14} />
                  <span>{loading ? 'Introspecting Schema...' : 'Discover Tables & Schemas'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Discovered Tables & Schedule */}
          {step === 3 && (
            <div className="ingest-step-section">
              <div className="section-title-row">
                <label className="form-label">DISCOVERED TABLES</label>
                <span className="count-badge">{selectedCount} of {discoveredTables.length} selected</span>
              </div>
              <div className="table-search-box">
                <input
                  type="text"
                  placeholder="Filter tables..."
                  className="search-input"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
              <div className="table-discovery-list">
                {filteredTables.map((t) => (
                  <div
                    key={t.name}
                    className={`discovered-table-item ${t.selected ? 'selected' : ''}`}
                    onClick={() => toggleTable(t.name)}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(t.selected)}
                      onChange={() => toggleTable(t.name)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="table-name">{t.schema}.{t.name}</span>
                    <span className="table-strategy-pill">{t.strategy?.toUpperCase() || 'INCREMENTAL'}</span>
                  </div>
                ))}
              </div>

              {/* Schedule */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">INGESTION SCHEDULE (CRON / NATURAL LANGUAGE)</label>
                <input
                  type="text"
                  className="form-input"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g. Nightly at 02:00 UTC"
                />
              </div>

              <button
                type="button"
                className="btn-primary-full"
                onClick={handleCreatePlan}
                disabled={loading || selectedCount === 0}
              >
                <Zap width={14} height={14} />
                <span>{loading ? 'Generating Trident DAG...' : 'Generate Ingestion Plan & DAG'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Visual DAG Canvas */}
        <div className="ingestion-dag-pane">
          <div className="dag-header-bar">
            <div className="dag-meta">
              <span className="dag-title">Data Ingestion Architecture DAG</span>
              <span className="dag-status-pill">{generatedPlan ? 'Plan Active' : 'Ready'}</span>
            </div>
            <div className="dag-controls">
              <button className="icon-button" title="Zoom In">+</button>
              <button className="icon-button" title="Zoom Out">-</button>
              <button className="icon-button" title="Reset View">⤢</button>
            </div>
          </div>

          <div className="dag-canvas-viewport">
            {!generatedPlan ? (
              <div className="dag-placeholder">
                <Database width={40} height={40} className="text-gray-500 mb-2" />
                <h3>No Active Ingestion Plan</h3>
                <p>Configure a data source on the left to generate the visual execution DAG.</p>
              </div>
            ) : (
              <div className="dag-active-summary">
                <div className="dag-node-flow">
                  <div className="dag-flow-node source-node">
                    <span className="node-badge">SOURCE</span>
                    <h4>{generatedPlan.sourceName}</h4>
                    <span className="node-sub">{generatedPlan.database}</span>
                  </div>
                  <ArrowRight className="dag-flow-arrow text-cyan-400" />
                  <div className="dag-flow-node bronze-node">
                    <span className="node-badge">BRONZE</span>
                    <h4>lh_enterprise_bronze</h4>
                    <span className="node-sub">Raw Ingestion Delta</span>
                  </div>
                  <ArrowRight className="dag-flow-arrow text-cyan-400" />
                  <div className="dag-flow-node silver-node">
                    <span className="node-badge">SILVER</span>
                    <h4>lh_enterprise_silver</h4>
                    <span className="node-sub">Delta MERGE Upsert</span>
                  </div>
                  <ArrowRight className="dag-flow-arrow text-cyan-400" />
                  <div className="dag-flow-node gold-node">
                    <span className="node-badge">GOLD</span>
                    <h4>lh_enterprise_gold</h4>
                    <span className="node-sub">Direct Lake Star Schema</span>
                  </div>
                </div>

                <div className="dag-details-panel">
                  <h4>Scheduled Pipeline Definition</h4>
                  <p>Trigger: <code>{generatedPlan.schedule}</code></p>
                  <p>Generated PySpark Notebooks: <code>{generatedPlan.notebooks.length} activities</code></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
