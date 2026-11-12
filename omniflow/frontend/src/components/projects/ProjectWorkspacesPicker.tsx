import React, { useState, useEffect } from 'react';
import { Database, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    let isMounted = true;
    const load = async (forceRefresh = false) => {
      try {
        setIsLoading(true);
        const res = await fetchFabricWorkspaces(forceRefresh);
        if (isMounted) {
          const list = res.workspaces || [];
          setWorkspaces(list);
        }
      } catch (err) {
        console.warn('Failed to fetch Fabric workspaces', err);
        if (isMounted) setWorkspaces([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load(true);

    const handleAccountSwitched = () => {
      load(true);
    };

    window.addEventListener('fabric-account-switched', handleAccountSwitched);
    return () => {
      isMounted = false;
      window.removeEventListener('fabric-account-switched', handleAccountSwitched);
    };
  }, []);

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
        {isLoading && (
          <span style={{ fontSize: '11px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 width={11} height={11} className="spin" /> Syncing...
          </span>
        )}
      </div>

      <div
        style={{
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          background: 'rgba(24, 24, 27, 0.6)',
          maxHeight: '175px',
          overflowY: 'auto',
          padding: '4px',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#71717a', fontSize: '12px' }}>
            <Loader2 width={14} height={14} className="spin" style={{ display: 'inline', marginRight: '6px' }} />
            Loading workspaces from Microsoft Fabric...
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
  );
};

