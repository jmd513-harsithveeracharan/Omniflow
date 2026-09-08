import React, { useState } from 'react';
import { Database, Plus } from 'lucide-react';

interface SourceSystemsTabProps {
  onAddCustomConnector?: () => void;
}

export const SourceSystemsTab: React.FC<SourceSystemsTabProps> = ({ onAddCustomConnector }) => {
  const [filter, setFilter] = useState<'all' | 'connected' | 'not_connected'>('all');

  const SOURCES = [
    { name: 'SAP S/4HANA & ERP (ECC)', meta: 'Enterprise ERP / Financials (ODP / CDS)', cat: 'Enterprise ERP', connected: false },
    { name: 'Azure SQL Database', meta: 'Relational OLTP / Data Warehouse', cat: 'Database', connected: false },
    { name: 'Oracle Enterprise Database', meta: 'Mission-Critical RDBMS & Exadata', cat: 'Database', connected: false },
    { name: 'PostgreSQL / MySQL', meta: 'App Microservices & Operational DBs', cat: 'Database', connected: false },
    { name: 'Salesforce CRM', meta: 'Customer 360, Leads & Opportunities', cat: 'SaaS API', connected: false },
    { name: 'MongoDB Atlas', meta: 'NoSQL Documents, Catalogs & Telemetry', cat: 'NoSQL', connected: false },
    { name: 'Apache Kafka / Event Hubs', meta: 'Real-Time Streams & Event Brokers', cat: 'Streaming', connected: false },
  ];

  const filtered = SOURCES.filter(s => {
    if (filter === 'connected') return s.connected;
    if (filter === 'not_connected') return !s.connected;
    return true;
  });

  return (
    <div className="settings-tab-pane">
      <div className="pane-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 className="pane-title" style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>Source Systems</h2>
          <p style={{ fontSize: '12.5px', color: '#71717a', margin: '2px 0 0 0' }}>
            Origin databases, ERPs & APIs ingested into Bronze Lakehouse
          </p>
        </div>
        <button
          type="button"
          onClick={onAddCustomConnector}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0078d4', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus width={13} height={13} />
          <span>Add ▾</span>
        </button>
      </div>

      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setFilter('all')}
          style={{ padding: '4px 12px', borderRadius: '14px', border: 'none', background: filter === 'all' ? '#fff' : 'rgba(255,255,255,0.06)', color: filter === 'all' ? '#000' : '#a1a1aa', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('connected')}
          style={{ padding: '4px 12px', borderRadius: '14px', border: 'none', background: filter === 'connected' ? '#fff' : 'rgba(255,255,255,0.06)', color: filter === 'connected' ? '#000' : '#a1a1aa', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
        >
          Connected
        </button>
        <button
          type="button"
          onClick={() => setFilter('not_connected')}
          style={{ padding: '4px 12px', borderRadius: '14px', border: 'none', background: filter === 'not_connected' ? '#fff' : 'rgba(255,255,255,0.06)', color: filter === 'not_connected' ? '#000' : '#a1a1aa', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
        >
          Not connected
        </button>
      </div>

      {/* Source Systems Table */}
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>
          <span>Source System</span>
          <span>Category</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        {filtered.map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database width={16} height={16} style={{ color: '#38bdf8' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#71717a' }}>{s.meta}</div>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>{s.cat}</div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d4d4d8', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer' }}
              >
                Connect
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
