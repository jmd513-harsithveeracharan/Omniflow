import React, { useState } from 'react';
import { UserPlus, Trash2, Shield, UserCheck } from 'lucide-react';
import { ProjectMember } from '../../types';

interface ProjectTeamPickerProps {
  members: ProjectMember[];
  onAddMember: (name: string, email: string, role: 'owner' | 'engineer' | 'viewer') => void;
  onRemoveMember: (id: string) => void;
}

export const ProjectTeamPicker: React.FC<ProjectTeamPickerProps> = ({
  members,
  onAddMember,
  onRemoveMember,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'engineer' | 'viewer'>('engineer');

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onAddMember(name.trim(), email.trim().toLowerCase(), role);
    setName('');
    setEmail('');
    setRole('engineer');
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
        TEAM COLLABORATION & ACCESS ({members.length})
      </label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="projects-modal-input"
          style={{ flex: 1, padding: '7px 10px', fontSize: '12.5px' }}
        />
        <input
          type="email"
          placeholder="colleague@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="projects-modal-input"
          style={{ flex: 1.2, padding: '7px 10px', fontSize: '12.5px' }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'owner' | 'engineer' | 'viewer')}
          className="projects-modal-input"
          style={{ width: '130px', padding: '7px 8px', fontSize: '12px' }}
        >
          <option value="owner">Architect</option>
          <option value="engineer">Data Engineer</option>
          <option value="viewer">Analyst</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="projects-btn-new-primary"
          style={{ padding: '7px 12px', fontSize: '12px', flexShrink: 0 }}
        >
          <UserPlus width={12} height={12} />
          <span>Add</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {members.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              fontSize: '12px',
              color: '#e4e4e7',
            }}
          >
            {m.role === 'owner' ? <Shield width={11} height={11} style={{ color: '#10b981' }} /> : <UserCheck width={11} height={11} style={{ color: '#60a5fa' }} />}
            <span style={{ fontWeight: 500 }}>{m.name}</span>
            <span style={{ fontSize: '10.5px', color: '#71717a' }}>({m.role})</span>
            {members.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveMember(m.id)}
                style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '0 2px', display: 'flex' }}
              >
                <Trash2 width={10} height={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

