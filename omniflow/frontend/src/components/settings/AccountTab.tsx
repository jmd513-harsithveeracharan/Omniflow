import React from 'react';
import { LogOut, X, Users } from 'lucide-react';
import { FabricStatus } from '../../types';

interface AccountTabProps {
  onClose?: () => void;
  onOpenAccountModal?: () => void;
  status?: FabricStatus | null;
}

export const AccountTab: React.FC<AccountTabProps> = ({ onClose, onOpenAccountModal, status = null }) => {
  const displayTenantId = status?.tenantId || 'Primary Organization';
  const displayWorkspaceId = status?.workspaceId || 'Default Workspace';
  const displayWorkspaceName = status?.workspaceName || status?.workspaceId || 'Active Target Workspace';

  return (
    <div className="settings-tab-pane" id="paneAccount">
      <div className="pane-header-row">
        <h2 className="pane-title">Account & Tenancy</h2>
        <div className="pane-header-actions">
          {onClose && (
            <button type="button" className="btn-subtle-icon btn-close-modal-icon" title="Close dialog" onClick={onClose}>
              <X width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5' }}>Organization ID</div>
          <div style={{ fontSize: '11.5px', color: '#71717a' }}>{displayTenantId}</div>
        </div>
        <code style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', color: '#38bdf8' }}>TENANT ACTIVE</code>
      </div>

      <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5' }}>Active Target Workspace</div>
          <div style={{ fontSize: '11.5px', color: '#71717a' }}>{displayWorkspaceId}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12.5px', color: '#10b981', fontWeight: 500 }}>{displayWorkspaceName}</span>
          {onOpenAccountModal && (
            <button
              type="button"
              onClick={onOpenAccountModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Users width={12} height={12} />
              <span>Switch Account</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5' }}>Log out of all devices</div>
          <div style={{ fontSize: '11.5px', color: '#71717a' }}>Revokes active sessions across browsers and devices</div>
        </div>
        <button
          type="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
        >
          <LogOut width={12} height={12} />
          <span>Log out all</span>
        </button>
      </div>
    </div>
  );
};

export default AccountTab;
