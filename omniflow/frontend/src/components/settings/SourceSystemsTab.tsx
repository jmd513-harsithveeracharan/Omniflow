import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

interface SourceSystemsTabProps {
  onClose?: () => void;
  onAddCustomConnector?: () => void;
}

export const SourceSystemsTab: React.FC<SourceSystemsTabProps> = ({
  onClose,
  onAddCustomConnector,
}) => {
  const [filter, setFilter] = useState<'all' | 'connected' | 'not_connected'>('all');

  const SOURCES = [
    {
      id: 'sap',
      name: 'SAP S/4HANA & ERP (ECC)',
      meta: 'Enterprise ERP / Financials (ODP / CDS)',
      type: 'Enterprise ERP',
      connected: false,
      renderIcon: () => (
        <svg width="22" height="15" viewBox="0 0 48 24" fill="none">
          <rect width="48" height="24" rx="4" fill="#00386B" />
          <text x="24" y="17" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="14" fill="#ffffff" textAnchor="middle">SAP</text>
        </svg>
      ),
    },
    {
      id: 'azuresql',
      name: 'Azure SQL Database',
      meta: 'Relational OLTP / Data Warehouse',
      type: 'Database',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
          <path d="M16 3C9.37 3 4 4.79 4 7v18c0 2.21 5.37 4 12 4s12-1.79 12-4V7c0-2.21-5.37-4-12-4z" fill="#0078D4" />
          <ellipse cx="16" cy="7" rx="12" ry="4" fill="#50E6FF" />
        </svg>
      ),
    },
    {
      id: 'oracle',
      name: 'Oracle Enterprise Database',
      meta: 'Mission-Critical RDBMS & Exadata',
      type: 'Database',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#F80000" />
          <circle cx="12" cy="12" r="6" fill="#ffffff" />
        </svg>
      ),
    },
    {
      id: 'postgres',
      name: 'PostgreSQL / MySQL',
      meta: 'App Microservices & Operational DBs',
      type: 'Database',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#336791" />
          <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="#ffffff" />
        </svg>
      ),
    },
    {
      id: 'salesforce',
      name: 'Salesforce CRM',
      meta: 'Customer 360, Leads & Opportunities',
      type: 'SaaS API',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19.5 10c0-.8-.3-1.5-.8-2-.5-.5-1.2-.8-2-.8-.4 0-.8.1-1.2.3-.5-.9-1.4-1.5-2.5-1.5-.7 0-1.4.3-1.9.8-.5-.8-1.4-1.3-2.4-1.3-1.5 0-2.8 1.1-3 2.6-.5-.2-1-.3-1.5-.3-1.7 0-3 1.3-3 3 0 .3.1.7.2 1-.9.6-1.4 1.6-1.4 2.7 0 1.9 1.6 3.5 3.5 3.5h14c1.9 0 3.5-1.6 3.5-3.5 0-1.4-.8-2.6-2-3.2.3-.6.5-1.2.5-1.9z" fill="#00A1E0" />
        </svg>
      ),
    },
    {
      id: 'mongodb',
      name: 'MongoDB Atlas',
      meta: 'NoSQL Documents, Catalogs & Telemetry',
      type: 'NoSQL',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C11.5 2 7 8 7 13c0 3 2 5.5 5 6.5 3-1 5-3.5 5-6.5 0-5-4.5-11-5-11z" fill="#47A248" />
        </svg>
      ),
    },
    {
      id: 'kafka',
      name: 'Apache Kafka / Event Hubs',
      meta: 'Real-Time Streams & Event Brokers',
      type: 'Streaming',
      connected: false,
      renderIcon: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="#ffffff" />
          <circle cx="6" cy="6" r="2" fill="#ffffff" />
          <circle cx="18" cy="6" r="2" fill="#ffffff" />
          <circle cx="6" cy="18" r="2" fill="#ffffff" />
          <circle cx="18" cy="18" r="2" fill="#ffffff" />
          <line x1="8" y1="8" x2="10" y2="10" stroke="#ffffff" strokeWidth="2" />
          <line x1="16" y1="8" x2="14" y2="10" stroke="#ffffff" strokeWidth="2" />
          <line x1="8" y1="16" x2="10" y2="14" stroke="#ffffff" strokeWidth="2" />
          <line x1="16" y1="16" x2="14" y2="14" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
  ];

  const filteredSources = SOURCES.filter((s) => {
    if (filter === 'connected') return s.connected;
    if (filter === 'not_connected') return !s.connected;
    return true;
  });

  return (
    <div className="settings-tab-pane" id="paneSourceSystems">
      <div className="pane-header-row">
        <div>
          <h2 className="pane-title">Source Systems</h2>
          <span style={{ fontSize: '12.5px', color: '#71717a' }}>
            Origin databases, ERPs & APIs ingested into Bronze Lakehouse
          </span>
        </div>
        <div className="pane-header-actions">
          <button type="button" className="btn-subtle-icon" title="Search source systems">
            <Search width={16} height={16} />
          </button>
          <button type="button" className="btn-subtle-dropdown" id="btnConnectorsAddMenu" onClick={onAddCustomConnector}>
            Add ▾
          </button>
          {onClose && (
            <button type="button" className="btn-subtle-icon btn-close-modal-icon" title="Close dialog" onClick={onClose}>
              <X width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {/* Popular Sources Grid */}
      <div className="popular-connectors-section">
        <div className="section-micro-label">Popular Sources</div>
        <div className="popular-cards-grid">
          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="22" height="15" viewBox="0 0 48 24" fill="none">
                  <rect width="48" height="24" rx="4" fill="#00386B" />
                  <text x="24" y="17" fontFamily="'Inter', sans-serif" fontWeight="800" fontSize="14" fill="#ffffff" textAnchor="middle">SAP</text>
                </svg>
              </span>
              <span className="popular-card-name">SAP S/4HANA</span>
            </div>
            <button type="button" className="btn-pill-connect">Connect</button>
          </div>

          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3C9.37 3 4 4.79 4 7v18c0 2.21 5.37 4 12 4s12-1.79 12-4V7c0-2.21-5.37-4-12-4z" fill="#0078D4" />
                  <ellipse cx="16" cy="7" rx="12" ry="4" fill="#50E6FF" />
                  <path d="M4 13c0 2.21 5.37 4 12 4s12-1.79 12-4" stroke="#ffffff" strokeWidth="1.5" fill="none" />
                  <path d="M4 19c0 2.21 5.37 4 12 4s12-1.79 12-4" stroke="#ffffff" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
              <span className="popular-card-name">Azure SQL</span>
            </div>
            <button type="button" className="btn-pill-connect">Connect</button>
          </div>

          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#F80000" />
                  <circle cx="12" cy="12" r="6" fill="#ffffff" />
                </svg>
              </span>
              <span className="popular-card-name">Oracle DB</span>
            </div>
            <button type="button" className="btn-pill-connect">Connect</button>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="connectors-filter-row">
        <button
          type="button"
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-pill ${filter === 'connected' ? 'active' : ''}`}
          onClick={() => setFilter('connected')}
        >
          Connected
        </button>
        <button
          type="button"
          className={`filter-pill ${filter === 'not_connected' ? 'active' : ''}`}
          onClick={() => setFilter('not_connected')}
        >
          Not connected
        </button>
      </div>

      {/* Top Enterprise Source Systems Table */}
      <div className="connectors-table-container">
        <div className="connectors-table-header">
          <span>Source System</span>
          <span>Category</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        <div className="connectors-table-body" id="sourceSystemsTableBody">
          {filteredSources.map((s) => (
            <div key={s.id} className="connector-row" data-status={s.connected ? 'connected' : 'not_connected'}>
              <div className="connector-cell-name">
                <span className="connector-avatar">
                  {s.renderIcon()}
                </span>
                <div className="connector-name-details">
                  <span className="connector-name">{s.name}</span>
                  <span className="connector-meta">{s.meta}</span>
                </div>
              </div>
              <div className="connector-cell-type">{s.type}</div>
              <div className="connector-cell-action">
                <button type="button" className="btn-pill-connect">Connect</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SourceSystemsTab;
