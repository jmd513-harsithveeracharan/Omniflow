import React from 'react';
import { Layers, Database, GitBranch, BarChart3, Check } from 'lucide-react';

interface ConnectorsTabProps {
  onOpenFabricModal?: () => void;
}

export const ConnectorsTab: React.FC<ConnectorsTabProps> = ({ onOpenFabricModal }) => {
  const PLATFORMS = [
    {
      name: 'Microsoft Fabric REST API',
      meta: 'Active Workspace: PBT_DATA_AGENT',
      type: 'Lakehouse Platform',
      connected: true,
      icon: Layers,
    },
    {
      name: 'Databricks Unity Catalog',
      meta: 'Delta Lake Compute & Delta Sharing',
      type: 'Lakehouse Compute',
      connected: false,
      icon: Database,
    },
    {
      name: 'Snowflake Data Cloud',
      meta: 'External Iceberg & Data Sharing',
      type: 'Cloud Data Warehouse',
      connected: false,
      icon: Database,
    },
    {
      name: 'dbt Core / dbt Cloud',
      meta: 'SQL Transformation Models & Lineage',
      type: 'Transformations',
      connected: false,
      icon: Layers,
    },
    {
      name: 'GitHub / Azure DevOps',
      meta: 'Git Repository Sync & CI/CD Pipelines',
      type: 'Source Control',
      connected: false,
      icon: GitBranch,
    },
    {
      name: 'Power BI Direct Lake',
      meta: 'Direct Lake Semantic Models & Reporting',
      type: 'Business Intelligence',
      connected: false,
      icon: BarChart3,
    },
  ];

  return (
    <div className="settings-tab-pane">
      <div className="pane-header-row" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="pane-title" style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>Connectors & Tools</h2>
          <p style={{ fontSize: '12.5px', color: '#71717a', margin: '2px 0 0 0' }}>
            Platform engines, lakehouse catalogs, CI/CD & transformation tools
          </p>
        </div>
      </div>

      {/* Core Integrations Grid */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', marginBottom: '8px' }}>
          Core Integrations
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers width={18} height={18} style={{ color: '#00d2a0' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>MS Fabric</span>
            </div>
            <button
              type="button"
              onClick={onOpenFabricModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
            >
              <Check width={11} height={11} /> Connected
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database width={18} height={18} style={{ color: '#ff3621' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Databricks</span>
            </div>
            <button
              type="button"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d4d4d8', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
            >
              Connect
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database width={18} height={18} style={{ color: '#29b5e8' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Snowflake</span>
            </div>
            <button
              type="button"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d4d4d8', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
            >
              Connect
            </button>
          </div>
        </div>
      </div>

      {/* Platform Connectors Table */}
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>
          <span>Platform / Tool</span>
          <span>Type</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        {PLATFORMS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                alignItems: 'center',
                padding: '12px 14px',
                borderBottom: idx < PLATFORMS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon width={16} height={16} style={{ color: '#38bdf8' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#71717a' }}>{p.meta}</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#a1a1aa' }}>{p.type}</div>

              <div style={{ textAlign: 'right' }}>
                {p.connected ? (
                  <button
                    type="button"
                    onClick={onOpenFabricModal}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    <Check width={11} height={11} /> Connected
                  </button>
                ) : (
                  <button
                    type="button"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d4d4d8', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
