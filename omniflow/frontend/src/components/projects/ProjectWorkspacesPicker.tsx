import React, { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, RefreshCw, KeyRound } from 'lucide-react';
import { FabricWorkspaceSummary } from '../../types';
import { fetchFabricWorkspaces } from '../../services/api';

interface ProjectWorkspacesPickerProps {
  selectedWorkspaces: string[];
  onChange: (workspaces: string[]) => void;
}

export const ProjectWorkspacesPicker: React.FC<ProjectWorkspacesPickerProps> = ({
  selectedWorkspaces,
  onChange,
}) => {
  const [workspaces, setWorkspaces] = useState<FabricWorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async (forceRefresh = false, isMountedCheck: () => boolean = () => true) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await fetchFabricWorkspaces(forceRefresh);
      if (isMountedCheck()) {
        if (res.error && (!res.workspaces || res.workspaces.length === 0)) {
          setWorkspaces([]);
          setLoadError(res.error);
        } else {
          setWorkspaces(res.workspaces || []);
          if (res.error) setLoadError(res.error);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch Fabric workspaces', err);
      if (isMountedCheck()) {
        setWorkspaces([]);
        setLoadError(err instanceof Error ? err.message : 'Unable to reach Fabric workspaces API.');
      }
    } finally {
      if (isMountedCheck()) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadWorkspaces(false, () => isMounted);

    const handleAccountSwitched = () => {
      loadWorkspaces(true, () => isMounted);
    };

    window.addEventListener('fabric-account-switched', handleAccountSwitched);
    return () => {
      isMounted = false;
      window.removeEventListener('fabric-account-switched', handleAccountSwitched);
    };
  }, [loadWorkspaces]);

  const toggleWorkspace = (name: string) => {
    if (selectedWorkspaces.includes(name)) {
      onChange(selectedWorkspaces.filter((w) => w !== name));
    } else {
      onChange([...selectedWorkspaces, name]);
    }
  };

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', margin: 0 }}>
          FABRIC WORKSPACES IN SCOPE ({selectedWorkspaces.length} SELECTED)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLoading ? (
            <span style={{ fontSize: '11px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 width={11} height={11} className="animate-spin" /> Syncing...
            </span>
          ) : (
            <button
              type="button"
              onClick={() => loadWorkspaces(true)}
              title="Refresh Fabric workspaces"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 4px',
              }}
            >
              <RefreshCw width={11} height={11} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          background: 'rgba(24, 24, 27, 0.6)',
          overflow: 'hidden',
        }}
      >
      <div
        style={{
          maxHeight: '175px',
          overflowY: 'auto',
          padding: '4px',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#71717a', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Loader2 width={14} height={14} className="animate-spin" />
            <span>Loading workspaces from Microsoft Fabric...</span>
          </div>
        ) : loadError && /auth|token|login|aadsts|credentials/i.test(loadError) ? (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', marginBottom: '8px' }}>
              <KeyRound width={16} height={16} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5', marginBottom: '4px' }}>
              Fabric Authentication Required
            </div>
            <p style={{ fontSize: '11.5px', color: '#a1a1aa', maxWidth: '380px', margin: '0 auto 12px auto', lineHeight: '1.4' }}>
              The Azure session for this account is expired or not signed in. Please sign in or switch accounts in the Fabric Accounts modal.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-fabric-account-modal'))}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Sign in to Fabric Account
              </button>
              <button
                type="button"
                onClick={() => loadWorkspaces(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#d4d4d8',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : loadError ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#fca5a5', fontSize: '12px' }}>
            {loadError}{' '}
            <button
              type="button"
              onClick={() => loadWorkspaces(true)}
              style={{ color: '#38bdf8', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
            >
              Retry
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
            No Fabric workspaces found for the active account.
          </div>
        ) : (
          workspaces.map((ws) => {
          const isSelected = selectedWorkspaces.includes(ws.displayName) || selectedWorkspaces.includes(ws.id);
          return (
            <div
              key={ws.id || ws.displayName}
              onClick={() => toggleWorkspace(ws.displayName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                border: isSelected ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid transparent',
                marginBottom: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleWorkspace(ws.displayName)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: '#10b981', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#10b981' : '#a1a1aa',
                    flexShrink: 0,
                  }}
                >
                  <Database width={14} height={14} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 500, color: isSelected ? '#34d399' : '#f4f4f5' }}>
                    {ws.displayName}
                  </div>
                  {ws.description && (
                    <div style={{ fontSize: '11px', color: '#71717a', maxWidth: '340px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ws.description}
                    </div>
                  )}
                </div>
              </div>

              {ws.isActive && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    borderRadius: '4px',
                    letterSpacing: '0.04em',
                  }}
                >
                  ACTIVE
                </span>
              )}
            </div>
          );
        }))}
      </div>
      </div>
    </div>
  );
};

