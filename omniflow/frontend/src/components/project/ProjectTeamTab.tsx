import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Trash2, Shield, UserCheck, Eye } from 'lucide-react';
import { ProjectMember, UserProfile } from '../../types';
import { fetchProjectMembers, addProjectMember, removeProjectMember, searchUsers } from '../../services/api';

interface ProjectTeamTabProps {
  projectId: string;
}

export const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({ projectId }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'contributor' | 'viewer'>('contributor');
  const [actionError, setActionError] = useState<string | null>(null);

  // Load existing members
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      const list = await fetchProjectMembers(projectId);
      if (isMounted) {
        setMembers(list);
        setIsLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [projectId]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await searchUsers(searchQuery);
      // Filter out users already in project
      const existingUserIds = new Set(members.map((m) => m.user_id));
      setSearchResults(results.filter((u) => !existingUserIds.has(u.id)));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, members]);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      setActionError(null);
      const newMember = await addProjectMember(projectId, selectedUser.id, selectedRole);
      setMembers((prev) => [...prev, newMember]);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      setActionError(null);
      await removeProjectMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {actionError && (
        <div
          style={{
            padding: '7px 10px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '12px',
          }}
        >
          {actionError}
        </div>
      )}

      {/* Add Member Bar */}
      <div
        style={{
          background: '#13151b',
          border: '1px solid #272a34',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Add Project Contributor / Viewer
        </span>

        <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search width={14} height={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
            <input
              type="text"
              value={selectedUser ? `${selectedUser.name} (${selectedUser.email})` : searchQuery}
              onChange={(e) => {
                setSelectedUser(null);
                setSearchQuery(e.target.value);
              }}
              placeholder="Search team by name or email..."
              style={{
                width: '100%',
                background: '#1c1f2a',
                border: '1px solid #333846',
                borderRadius: '6px',
                padding: '7px 10px 7px 30px',
                color: '#f8fafc',
                fontSize: '12.5px',
                outline: 'none',
              }}
            />

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && !selectedUser && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#1c1f2a',
                  border: '1px solid #383e50',
                  borderRadius: '6px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 20,
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setSearchResults([]);
                    }}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #252a38',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#252936')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: u.avatar_color || '#10b981',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 500 }}>{u.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>{u.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role selector */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as 'owner' | 'contributor' | 'viewer')}
            style={{
              background: '#1c1f2a',
              border: '1px solid #333846',
              borderRadius: '6px',
              padding: '0 10px',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="contributor">Contributor</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>

          <button
            type="button"
            disabled={!selectedUser}
            onClick={handleAddMember}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: selectedUser ? '#10b981' : '#272b38',
              color: selectedUser ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '6px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: selectedUser ? 'pointer' : 'not-allowed',
            }}
          >
            <UserPlus width={13} height={13} />
            Add
          </button>
        </div>
      </div>

      {/* Members List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Current Project Members ({members.length})
          </span>
          {isLoading && <span style={{ fontSize: '11px', color: '#64748b' }}>Refreshing...</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
          {members.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
              No explicit members assigned. Current creator is project owner.
            </div>
          ) : (
            members.map((m) => {
              const isOwner = m.role === 'owner';
              const isContributor = m.role === 'contributor';
              return (
                <div
                  key={m.id || m.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#161922',
                    border: '1px solid #232734',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: m.avatar_color || '#10b981',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: '#f1f5f9', fontSize: '12.5px', fontWeight: 500, lineHeight: 1.2 }}>
                        {m.name}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '10.5px' }}>{m.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        background: isOwner ? 'rgba(139, 92, 246, 0.18)' : isContributor ? 'rgba(59, 130, 246, 0.18)' : 'rgba(148, 163, 184, 0.18)',
                        color: isOwner ? '#c084fc' : isContributor ? '#60a5fa' : '#94a3b8',
                        border: `1px solid ${isOwner ? 'rgba(139, 92, 246, 0.35)' : isContributor ? 'rgba(59, 130, 246, 0.35)' : 'rgba(148, 163, 184, 0.35)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isOwner && <Shield width={10} height={10} />}
                      {isContributor && <UserCheck width={10} height={10} />}
                      {!isOwner && !isContributor && <Eye width={10} height={10} />}
                      {m.role}
                    </span>

                    {m.user_id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id!)}
                        title="Remove member"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                      >
                        <Trash2 width={13} height={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
