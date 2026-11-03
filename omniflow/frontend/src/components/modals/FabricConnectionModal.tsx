import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Layers, X, RefreshCw, Users } from 'lucide-react';
import { FabricStatus } from '../../types';
import { BrowserLoginTab } from './fabric/BrowserLoginTab';
import { ServicePrincipalTab } from './fabric/ServicePrincipalTab';
import { BearerTokenTab } from './fabric/BearerTokenTab';

interface FabricConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: FabricStatus | null;
  onRefreshStatus?: () => void;
  onOpenAccountSwitcher?: () => void;
}

export const FabricConnectionModal: React.FC<FabricConnectionModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
  onOpenAccountSwitcher,
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'sp' | 'token'>('cli');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSuccess = () => {
    onRefreshStatus?.();
    onClose();
  };

  return createPortal(
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100050,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="connections-modal-card"
        style={{
          width: '560px',
          maxWidth: '92vw',
          background: '#121215',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          zIndex: 100051,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0, 210, 160, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers width={20} height={20} style={{ color: '#00d2a0' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>Microsoft Fabric Connection</h3>
              <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>Manage Azure authentication and active workspace</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Active Status Strip */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.authenticated ? '#10b981' : '#ef4444' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>
                  {status?.authenticated ? 'Authenticated User' : 'Not Connected'}
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>
                  Azure CLI
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>
                Workspace: {status?.workspaceId || 'PBT_DATA_AGENT'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onOpenAccountSwitcher && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAccountSwitcher();
                  }}
                  title="Switch or connect Fabric identity"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: '#e4e4e7',
                    padding: '5px 9px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    fontWeight: 500,
                  }}
                >
                  <Users width={12} height={12} /> Accounts
                </button>
              )}
              {onRefreshStatus && (
                <button
                  type="button"
                  onClick={onRefreshStatus}
                  title="Refresh token status"
                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
                >
                  <RefreshCw width={12} height={12} /> Sync
                </button>
              )}
            </div>
          </div>

          {/* Connection Methods Navigation */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', marginBottom: '16px' }}>
            {[
              { id: 'cli', label: 'Browser Login (fab)' },
              { id: 'sp', label: 'Service Principal' },
              { id: 'token', label: 'Bearer Token' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'cli' | 'sp' | 'token')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(255, 255, 255, 0.12)' : 'none',
                  color: activeTab === tab.id ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Method Content */}
          {activeTab === 'cli' && <BrowserLoginTab />}
          {activeTab === 'sp' && (
            <ServicePrincipalTab
              initialTenantId={status?.tenantId || ''}
              onSuccess={handleSuccess}
            />
          )}
          {activeTab === 'token' && <BearerTokenTab onSuccess={handleSuccess} />}
        </div>
      </div>
    </div>,
    document.body
  );
};
