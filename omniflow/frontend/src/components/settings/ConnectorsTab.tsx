import React from 'react';
import { X, Search } from 'lucide-react';
import { FabricStatus } from '../../types';

interface ConnectorsTabProps {
  onClose?: () => void;
  onOpenFabricModal?: () => void;
  onOpenAccountModal?: () => void;
  onOpenConnectorModal?: (connectorId: string) => void;
  status?: FabricStatus | null;
}

export const ConnectorsTab: React.FC<ConnectorsTabProps> = ({
  onClose,
  onOpenFabricModal,
  onOpenAccountModal,
  onOpenConnectorModal,
  status = null,
}) => {
  return (
    <div className="settings-tab-pane" id="paneConnectors">
      <div className="pane-header-row">
        <div>
          <h2 className="pane-title">Connectors & Tools</h2>
          <span style={{ fontSize: '12.5px', color: '#71717a' }}>
            Platform engines, lakehouse catalogs, CI/CD & transformation tools
          </span>
        </div>
        <div className="pane-header-actions">
          <button type="button" className="btn-subtle-icon" title="Search platform connectors">
            <Search width={16} height={16} />
          </button>
          {onClose && (
            <button type="button" className="btn-subtle-icon btn-close-modal-icon" title="Close dialog" onClick={onClose}>
              <X width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      {/* Popular Platforms Grid */}
      <div className="popular-connectors-section">
        <div className="section-micro-label">Core Integrations</div>
        <div className="popular-cards-grid">
          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
                  <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
                  <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
                </svg>
              </span>
              <span className="popular-card-name">MS Fabric</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button type="button" className="btn-pill-connected" onClick={onOpenFabricModal} title="Manage Microsoft Fabric Connection">
                <span className="status-dot-green" />
                <span>Connected</span>
              </button>
              {onOpenAccountModal && (
                <button
                  type="button"
                  className="btn-pill-connect"
                  onClick={onOpenAccountModal}
                  title="Switch or connect Fabric identity"
                  style={{ fontSize: '10.5px', padding: '3px 7px' }}
                >
                  Accounts
                </button>
              )}
            </div>
          </div>

          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#FF3621" />
                  <path d="M2 12l10 5 10-5" stroke="#FF3621" strokeWidth="2" fill="none" />
                  <path d="M2 17l10 5 10-5" stroke="#FF3621" strokeWidth="2" fill="none" />
                </svg>
              </span>
              <span className="popular-card-name">Databricks</span>
            </div>
            <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('databricks')}>Connect</button>
          </div>

          <div className="popular-card">
            <div className="popular-card-left">
              <span className="popular-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" stroke="#29B5E8" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="2" fill="#29B5E8" />
                </svg>
              </span>
              <span className="popular-card-name">Snowflake</span>
            </div>
            <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('snowflake')}>Connect</button>
          </div>
        </div>
      </div>

      {/* Platform Connectors Table */}
      <div className="connectors-table-container">
        <div className="connectors-table-header">
          <span>Platform / Tool</span>
          <span>Type</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        <div className="connectors-table-body">
          {/* 1. Fabric REST API */}
          <div className="connector-row" data-status="connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
                  <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
                  <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">Microsoft Fabric REST API</span>
                <span className="connector-meta" id="tableActiveWsName">
                  Active Workspace: {status?.workspaceName || status?.workspaceId || 'Default'}
                </span>
              </div>
            </div>
            <div className="connector-cell-type">Lakehouse Platform</div>
            <div className="connector-cell-action" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
              <button type="button" className="btn-pill-connected" onClick={onOpenFabricModal} title="Manage Fabric Connection">
                <span className="status-dot-green" />
                <span>Connected</span>
              </button>
              {onOpenAccountModal && (
                <button
                  type="button"
                  className="btn-pill-connect"
                  onClick={onOpenAccountModal}
                  title="Switch or connect Fabric identity"
                  style={{ fontSize: '10.5px', padding: '3px 7px' }}
                >
                  Accounts
                </button>
              )}
            </div>
          </div>

          {/* 2. Databricks Unity Catalog */}
          <div className="connector-row" data-status="not_connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#FF3621" />
                  <path d="M2 12l10 5 10-5" stroke="#FF3621" strokeWidth="2" fill="none" />
                  <path d="M2 17l10 5 10-5" stroke="#FF3621" strokeWidth="2" fill="none" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">Databricks Unity Catalog</span>
                <span className="connector-meta">Delta Lake Compute & Delta Sharing</span>
              </div>
            </div>
            <div className="connector-cell-type">Lakehouse Compute</div>
            <div className="connector-cell-action">
              <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('databricks')}>Connect</button>
            </div>
          </div>

          {/* 3. Snowflake Data Cloud */}
          <div className="connector-row" data-status="not_connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14" stroke="#29B5E8" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="2" fill="#29B5E8" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">Snowflake Data Cloud</span>
                <span className="connector-meta">External Iceberg & Data Sharing</span>
              </div>
            </div>
            <div className="connector-cell-type">Cloud Data Warehouse</div>
            <div className="connector-cell-action">
              <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('snowflake')}>Connect</button>
            </div>
          </div>

          {/* 4. dbt Core / dbt Cloud */}
          <div className="connector-row" data-status="not_connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#FF694A" />
                  <path d="M6 6h6v6H6z" fill="#ffffff" />
                  <path d="M12 12h6v6h-6z" fill="#ffffff" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">dbt Core / dbt Cloud</span>
                <span className="connector-meta">SQL Transformation Models & Lineage</span>
              </div>
            </div>
            <div className="connector-cell-type">Transformations</div>
            <div className="connector-cell-action">
              <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('dbt')}>Connect</button>
            </div>
          </div>

          {/* 5. GitHub / Azure DevOps */}
          <div className="connector-row" data-status="not_connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">GitHub / Azure DevOps</span>
                <span className="connector-meta">Git Repository Sync & CI/CD Pipelines</span>
              </div>
            </div>
            <div className="connector-cell-type">Source Control</div>
            <div className="connector-cell-action">
              <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('github')}>Connect</button>
            </div>
          </div>

          {/* 6. Power BI Direct Lake */}
          <div className="connector-row" data-status="not_connected">
            <div className="connector-cell-name">
              <span className="connector-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="10" width="3" height="10" rx="1" fill="#F2C811" />
                  <rect x="10" y="6" width="3" height="14" rx="1" fill="#F2C811" />
                  <rect x="16" y="2" width="3" height="18" rx="1" fill="#F2C811" />
                </svg>
              </span>
              <div className="connector-name-details">
                <span className="connector-name">Power BI Direct Lake</span>
                <span className="connector-meta">Direct Lake Semantic Models & Reporting</span>
              </div>
            </div>
            <div className="connector-cell-type">Business Intelligence</div>
            <div className="connector-cell-action">
              <button type="button" className="btn-pill-connect" onClick={() => onOpenConnectorModal?.('powerbi')}>Connect</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectorsTab;
