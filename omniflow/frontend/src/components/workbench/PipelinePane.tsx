import React, { useState, useMemo } from 'react';
import { Zap, GitBranch, ArrowRight, Layers, Table2, CheckCircle2, X } from 'lucide-react';

export interface PipelineActivity {
  name: string;
  type: string;
  dependsOn?: Array<{ activity: string; dependencyConditions?: string[] }>;
  policy?: {
    timeout?: string;
    retry?: number;
    retryIntervalInSeconds?: number;
    secureInput?: boolean;
    secureOutput?: boolean;
  };
  typeProperties?: {
    notebookId?: string;
    workspaceId?: string;
    storedProcedureName?: string;
    storedProcedureParameters?: Record<string, unknown>;
  };
  wave?: string;
  targetAsset?: string;
}

export interface PipelineItem {
  name: string;
  description: string;
  folder_name: string;
  activities: PipelineActivity[];
  annotations?: string[];
}

interface PipelinePaneProps {
  plan?: Record<string, unknown> | null;
  domain?: string;
}

function resolveActivityWave(name: string, idx: number, _total?: number): string {
  const n = name.toLowerCase();
  if (n.includes('00') || n.includes('ingest') || n.includes('raw')) return 'Wave 1: Raw Ingest';
  if (n.includes('01') || n.includes('02') || n.includes('03') || n.includes('04') || n.includes('05') || n.includes('curate')) return 'Wave 2: Parallel Curation';
  if (n.includes('06') || n.includes('silver') || n.includes('scd2')) return 'Wave 3: Silver Conformed';
  if (n.includes('07') || n.includes('quality') || n.includes('anomaly')) return 'Wave 4: Quality Gate';
  if (n.includes('08') || n.includes('gold') || n.includes('star') || n.includes('warehouse')) return 'Wave 5: Gold ELT';
  return `Wave ${idx + 1}`;
}

export const PipelinePane: React.FC<PipelinePaneProps> = ({ plan, domain = 'retail' }) => {
  const [activePipeIdx, setActivePipeIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'table' | 'flow'>('table');
  const [selectedActivity, setSelectedActivity] = useState<PipelineActivity | null>(null);

  const pipelines: PipelineItem[] = useMemo(() => {
    if (!plan || typeof plan !== 'object') {
      return [
        {
          name: `pl_${domain}_ingest`,
          description: 'Bronze ingestion pipeline with live JDBC execution',
          folder_name: '01_Raw_Ingestion/02_Pipelines',
          activities: [
            {
              name: 'Act_00_Ingest_Postgres_Raw',
              type: 'TridentNotebook',
              dependsOn: [],
              policy: { timeout: '0.12:00:00', retry: 0, retryIntervalInSeconds: 30, secureInput: false, secureOutput: false },
              typeProperties: { notebookId: '{{nb_00_ingest_postgres_raw.id}}', workspaceId: '00000000-0000-0000-0000-000000000000' },
              wave: 'Wave 1: Raw Ingest',
              targetAsset: 'nb_00_ingest_postgres_raw',
            },
          ],
        },
      ];
    }

    const items = (plan.items as Array<Record<string, unknown>>) || [];
    const pipeItems = items.filter((it) => String(it.type || '').toLowerCase().includes('pipeline'));

    if (pipeItems.length > 0) {
      return pipeItems.map((pi) => {
        const pipeDef = (pi.pipeline as Record<string, unknown>) || {};
        const props = (pipeDef.properties as Record<string, unknown>) || {};
        const rawActivities = (props.activities as Array<Record<string, unknown>>) || [];

        const activities: PipelineActivity[] = rawActivities.map((act, aIdx) => {
          const actName = String(act.name || `Activity_${aIdx + 1}`);
          const actType = String(act.type || 'TridentNotebook');
          const typeProps = (act.typeProperties as Record<string, unknown>) || {};
          let target = '';
          if (typeProps.notebookId) target = String(typeProps.notebookId).replace(/[{}]/g, '');
          else if (typeProps.storedProcedureName) target = String(typeProps.storedProcedureName);
          else target = actType;

          return {
            name: actName,
            type: actType,
            dependsOn: (act.dependsOn as any) || [],
            policy: (act.policy as any) || { timeout: '0.12:00:00', retry: 0, retryIntervalInSeconds: 30 },
            typeProperties: typeProps,
            wave: resolveActivityWave(actName, aIdx, rawActivities.length),
            targetAsset: target,
          };
        });

        return {
          name: String(pi.name || 'pl_orchestration'),
          description: String(pi.description || props.description || 'Fabric Data Factory Orchestration Pipeline'),
          folder_name: String(pi.folder_name || '05_Master_Orchestration/01_Pipelines'),
          activities: activities.length > 0 ? activities : [
            {
              name: 'Act_00_Ingest_Postgres_Raw',
              type: 'TridentNotebook',
              wave: 'Wave 1: Raw Ingest',
              targetAsset: 'nb_00_ingest_postgres_raw',
              policy: { timeout: '0.12:00:00', retry: 0 },
            },
          ],
          annotations: (props.annotations as string[]) || ['Medallion', domain],
        };
      });
    }

    // Default 2 pipelines if plan items not yet hydrated
    return [
      {
        name: `pl_${domain}_ingest`,
        description: 'PostgreSQL batch copy ingestion pipeline',
        folder_name: `${domain.toUpperCase()}_Platform/01_Raw_Ingestion/02_Pipelines`,
        activities: [
          {
            name: 'Act_00_Ingest_Postgres_Raw',
            type: 'TridentNotebook',
            wave: 'Wave 1: Raw Ingest',
            targetAsset: 'nb_00_ingest_postgres_raw',
            dependsOn: [],
            policy: { timeout: '0.12:00:00', retry: 0, retryIntervalInSeconds: 30 },
          },
        ],
      },
      {
        name: 'pl_master_orchestration',
        description: 'Master 5-wave end-to-end DAG orchestrating Bronze ➔ Silver ➔ Gold execution',
        folder_name: `${domain.toUpperCase()}_Platform/05_Master_Orchestration/01_Pipelines`,
        activities: [
          { name: 'Act_00_Ingest_Postgres_Raw', type: 'TridentNotebook', wave: 'Wave 1: Raw Ingest', targetAsset: 'nb_00_ingest_postgres_raw', dependsOn: [] },
          { name: 'Act_01_Curate_Customers_Loyalty', type: 'TridentNotebook', wave: 'Wave 2: Stage Curation', targetAsset: 'nb_01_curate_customers_loyalty', dependsOn: [{ activity: 'Act_00_Ingest_Postgres_Raw' }] },
          { name: 'Act_02_Curate_Products_Catalog', type: 'TridentNotebook', wave: 'Wave 2: Stage Curation', targetAsset: 'nb_02_curate_products_catalog', dependsOn: [{ activity: 'Act_00_Ingest_Postgres_Raw' }] },
          { name: 'Act_03_Curate_Orders_Sales', type: 'TridentNotebook', wave: 'Wave 2: Stage Curation', targetAsset: 'nb_03_curate_orders_sales', dependsOn: [{ activity: 'Act_00_Ingest_Postgres_Raw' }] },
          { name: 'Act_04_Curate_Inventory_Supply', type: 'TridentNotebook', wave: 'Wave 2: Stage Curation', targetAsset: 'nb_04_curate_inventory_supply', dependsOn: [{ activity: 'Act_00_Ingest_Postgres_Raw' }] },
          { name: 'Act_05_Curate_Promotions_Marketing', type: 'TridentNotebook', wave: 'Wave 2: Stage Curation', targetAsset: 'nb_05_curate_promotions_marketing', dependsOn: [{ activity: 'Act_00_Ingest_Postgres_Raw' }] },
          { name: 'Act_06_Silver_Conformed', type: 'TridentNotebook', wave: 'Wave 3: Silver Conformed', targetAsset: 'nb_06_silver_conformed', dependsOn: [{ activity: 'Act_01_Curate_Customers_Loyalty' }] },
          { name: 'Act_07_Quality_Suite', type: 'TridentNotebook', wave: 'Wave 4: Quality Gate', targetAsset: 'nb_07_quality_suite', dependsOn: [{ activity: 'Act_06_Silver_Conformed' }] },
          { name: 'Act_08_Gold_Star_Schema_ELT', type: 'SqlServerStoredProcedure', wave: 'Wave 5: Gold ELT', targetAsset: '[dbo].[sp_orchestrate_gold_star_schema]', dependsOn: [{ activity: 'Act_07_Quality_Suite' }] },
        ],
      },
    ];
  }, [plan, domain]);

  const currentPipe = pipelines[activePipeIdx] || pipelines[0];

  return (
    <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0, background: '#121214' }}>
      {/* 1. Pipeline Selector Bar (Like Tables in DeltaSchemaPane) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#18181b', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px', whiteSpace: 'nowrap' }}>
            Pipelines ({pipelines.length}):
          </span>
          {pipelines.map((pipe, idx) => (
            <button
              key={pipe.name}
              type="button"
              onClick={() => {
                setActivePipeIdx(idx);
                setSelectedActivity(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: activePipeIdx === idx ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                background: activePipeIdx === idx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                color: activePipeIdx === idx ? '#38bdf8' : '#cbd5e1',
                fontWeight: activePipeIdx === idx ? 600 : 400,
              }}
            >
              <Zap width={12} height={12} color={activePipeIdx === idx ? '#38bdf8' : '#94a3b8'} />
              <span>{pipe.name}</span>
              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                {pipe.activities.length}
              </span>
            </button>
          ))}
        </div>

        {/* View Mode Toggle: Table vs Flow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              border: 'none',
              background: viewMode === 'table' ? '#27272a' : 'transparent',
              color: viewMode === 'table' ? '#f8fafc' : '#71717a',
              fontWeight: viewMode === 'table' ? 600 : 400,
            }}
          >
            <Table2 width={12} height={12} />
            <span>Activities Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('flow')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              border: 'none',
              background: viewMode === 'flow' ? '#27272a' : 'transparent',
              color: viewMode === 'flow' ? '#f8fafc' : '#71717a',
              fontWeight: viewMode === 'flow' ? 600 : 400,
            }}
          >
            <Layers width={12} height={12} />
            <span>Activity Flow</span>
          </button>
        </div>
      </div>

      {/* 2. Pipeline Metadata Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '6px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
            <Zap width={16} height={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#f8fafc', fontFamily: 'monospace' }}>
                {currentPipe.name}
              </h4>
              <span style={{ fontSize: '10.5px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
                Data Factory Pipeline
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Target: <code style={{ color: '#cbd5e1' }}>{currentPipe.folder_name}</code> • {currentPipe.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#38bdf8' }}>
            <GitBranch width={12} height={12} />
            <span>{currentPipe.activities.length} Activities</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#10b981' }}>
            <CheckCircle2 width={12} height={12} />
            <span>Policy Validated</span>
          </span>
        </div>
      </div>

      {/* 3. Main Content: Table View or Flow View */}
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'auto', padding: '16px 20px', position: 'relative' }}>
        {viewMode === 'table' ? (
          /* TABLE VIEW: structured like Tables in DeltaSchemaPane */
          <table className="schema-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '8px 10px', width: '36px' }}>#</th>
                <th style={{ padding: '8px 12px' }}>Activity Name</th>
                <th style={{ padding: '8px 12px' }}>Activity Type</th>
                <th style={{ padding: '8px 12px' }}>Medallion Wave</th>
                <th style={{ padding: '8px 12px' }}>Target Asset</th>
                <th style={{ padding: '8px 12px' }}>Depends On</th>
                <th style={{ padding: '8px 12px' }}>Execution Policy</th>
              </tr>
            </thead>
            <tbody>
              {currentPipe.activities.map((act, aIdx) => {
                const isSelected = selectedActivity?.name === act.name;
                const isNotebook = act.type.toLowerCase().includes('notebook');
                const isStoredProc = act.type.toLowerCase().includes('storedprocedure');
                const hasDeps = act.dependsOn && act.dependsOn.length > 0;

                return (
                  <tr
                    key={act.name}
                    onClick={() => setSelectedActivity(act)}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                      {aIdx + 1}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap width={12} height={12} color="#38bdf8" />
                        <span>{act.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          background: isNotebook ? 'rgba(192, 132, 252, 0.15)' : isStoredProc ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: isNotebook ? '#c084fc' : isStoredProc ? '#eab308' : '#38bdf8',
                        }}
                      >
                        {act.type}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        {act.wave}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '11.5px' }}>
                      {act.targetAsset || 'Local Fabric Object'}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {hasDeps ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {act.dependsOn!.map((d, dIdx) => (
                            <span
                              key={dIdx}
                              style={{
                                fontSize: '10.5px',
                                background: 'rgba(255,255,255,0.06)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                              }}
                            >
                              ← {d.activity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>None (Wave Entry)</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '11px' }}>
                      <span>{act.policy?.timeout || '0.12:00:00'} • Retry: {act.policy?.retry ?? 0}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* FLOW VIEW: dedicated activity-only DAG */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start', minWidth: '700px' }}>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '8px' }}>
              Execution Order &amp; Dependency Graph for <strong>{currentPipe.name}</strong>:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              {currentPipe.activities.map((act, idx) => (
                <React.Fragment key={act.name}>
                  <div
                    onClick={() => setSelectedActivity(act)}
                    style={{
                      background: selectedActivity?.name === act.name ? 'rgba(56, 189, 248, 0.15)' : '#18181b',
                      border: selectedActivity?.name === act.name ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      minWidth: '190px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {act.wave}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginTop: '3px', fontFamily: 'monospace' }}>
                      {act.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
                      {act.type} • {act.targetAsset?.slice(0, 22) || 'Asset'}
                    </div>
                  </div>
                  {idx < currentPipe.activities.length - 1 && (
                    <ArrowRight width={14} height={14} color="#64748b" style={{ flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Selected Activity Detail Drawer */}
        {selectedActivity && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              marginTop: '20px',
              background: 'rgba(18, 18, 20, 0.96)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap width={14} height={14} color="#38bdf8" />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', fontFamily: 'monospace' }}>
                  {selectedActivity.name}
                </span>
                <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '4px' }}>
                  {selectedActivity.type}
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  ({selectedActivity.wave})
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                Target: <code>{selectedActivity.targetAsset}</code> • Timeout: {selectedActivity.policy?.timeout || '12h'} • Retry: {selectedActivity.policy?.retry ?? 0}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedActivity(null)}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            >
              <X width={14} height={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
