import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Check, User } from 'lucide-react';
import { ProjectMember } from '../../types';

interface ProjectTeamSearchProps {
  members: ProjectMember[];
  onAddMember: (member: ProjectMember) => void;
  onRemoveMember: (id: string) => void;
}

const DIRECTORY_ACCOUNTS: Array<{ name: string; email: string; avatarBg: string }> = [
  { name: 'Harsith Veer Bheesetti', email: 'harsith@fabric.internal', avatarBg: '#10b981' },
  { name: 'Alex Chen', email: 'alex.chen@fabric.internal', avatarBg: '#6366f1' },
  { name: 'Sarah Jenkins', email: 'sarah.j@fabric.internal', avatarBg: '#ec4899' },
  { name: 'David Kumar', email: 'david.kumar@fabric.internal', avatarBg: '#3b82f6' },
  { name: 'Priya Sharma', email: 'priya.s@fabric.internal', avatarBg: '#14b8a6' },
  { name: 'Marcus Vance', email: 'marcus.v@fabric.internal', avatarBg: '#8b5cf6' },
  { name: 'Elena Rostova', email: 'elena.r@fabric.internal', avatarBg: '#f59e0b' },
];

function getInitials(name: string): string {
  const clean = name.replace(/\s*\(You\)/, '');
  return clean
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
}

export const ProjectTeamSearch: React.FC<ProjectTeamSearchProps> = ({
  members,
  onAddMember,
  onRemoveMember,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAccounts = DIRECTORY_ACCOUNTS.filter((acc) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return acc.name.toLowerCase().includes(q) || acc.email.toLowerCase().includes(q);
  });

  const handleSelectAccount = (acc: { name: string; email: string; avatarBg: string }) => {
    const alreadyAdded = members.some((m) => m.email.toLowerCase() === acc.email.toLowerCase());
    if (alreadyAdded) return;

    onAddMember({
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: acc.name,
      email: acc.email,
      avatarBg: acc.avatarBg,
    });
    setQuery('');
  };

  const handleCustomAdd = () => {
    if (!query.trim()) return;
    const cleanQuery = query.trim();
    const isEmail = cleanQuery.includes('@');
    const name = isEmail ? cleanQuery.split('@')[0] : cleanQuery;
    const email = isEmail ? cleanQuery : `${name.toLowerCase().replace(/\s+/g, '.')}@fabric.internal`;

    onAddMember({
      id: `usr_${Date.now()}`,
      name,
      email,
      avatarBg: '#0ea5e9',
    });
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '8px' }}>
        TEAM COLLABORATORS ({members.length})
      </label>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            width={15}
            height={15}
            style={{ position: 'absolute', left: '12px', color: '#71717a', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomAdd();
              }
            }}
            placeholder="Search colleagues by name or email..."
            className="projects-modal-input"
            style={{ paddingLeft: '36px', fontSize: '13px' }}
          />
        </div>

        {/* Suggestion Dropdown */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#1c1c20',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              maxHeight: '210px',
              overflowY: 'auto',
              zIndex: 10050,
              boxShadow: '0 12px 28px rgba(0,0,0,0.65)',
              padding: '6px',
            }}
          >
            <div style={{ padding: '6px 8px', fontSize: '10.5px', fontWeight: 700, color: '#71717a', letterSpacing: '0.05em' }}>
              DISCOVERED TENANT ACCOUNTS
            </div>
            {filteredAccounts.length === 0 ? (
              <div
                onClick={handleCustomAdd}
                style={{
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  color: '#10b981',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.08)',
                }}
              >
                <User width={14} height={14} />
                <span>Add &quot;{query}&quot; as collaborator</span>
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isAdded = members.some((m) => m.email.toLowerCase() === acc.email.toLowerCase());
                return (
                  <div
                    key={acc.email}
                    onClick={() => {
                      if (!isAdded) handleSelectAccount(acc);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: isAdded ? 'default' : 'pointer',
                      opacity: isAdded ? 0.6 : 1,
                      background: 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isAdded) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: acc.avatarBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '11.5px',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(acc.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5' }}>{acc.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#71717a' }}>{acc.email}</div>
                      </div>
                    </div>
                    {isAdded ? (
                      <span style={{ fontSize: '11.5px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check width={13} height={13} /> Added
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Select</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Selected Member Chips */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
          {members.map((m) => (
            <div
              key={m.id || m.email}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px 4px 6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: m.avatarBg || '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '10px',
                }}
              >
                {getInitials(m.name)}
              </div>
              <span style={{ fontSize: '12.5px', color: '#f4f4f5', fontWeight: 500 }}>{m.name}</span>
              <button
                type="button"
                onClick={() => onRemoveMember(m.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={`Remove ${m.name}`}
              >
                <X width={13} height={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

