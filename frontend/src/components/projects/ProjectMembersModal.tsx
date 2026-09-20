import React, { useState } from 'react';
import { X, Users, UserPlus, Trash2, Shield, UserCheck } from 'lucide-react';
import { ProjectRecord, ProjectMember } from '../../types';

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectRecord | null;
  onUpdateMembers: (projectId: string, members: ProjectMember[]) => Promise<void>;
}

export const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateMembers,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'owner' | 'engineer' | 'viewer'>('engineer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !project) return null;

  const currentMembers: ProjectMember[] = project.metadata?.members || [
    {
      id: 'usr_owner',
      name: 'Current User',
      email: 'lead.architect@company.com',
      role: 'owner',
    },
  ];

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim() || isSubmitting) return;

    const newMember: ProjectMember = {
      id: `usr_${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      role: newRole,
    };

    const updated = [...currentMembers, newMember];
    try {
      setIsSubmitting(true);
      await onUpdateMembers(project.id, updated);
      setNewEmail('');
      setNewName('');
      setNewRole('engineer');
    } catch (err) {
      console.error('Failed to add member', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const updated = currentMembers.filter((m) => m.id !== memberId);
    try {
      setIsSubmitting(true);
      await onUpdateMembers(project.id, updated);
    } catch (err) {
      console.error('Failed to remove member', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop open active"
      onClick={onClose}
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content project-members-modal"
        style={{
          width: '540px',
          maxWidth: '95vw',
          background: '#18181b',
          borderRadius: '16px',
          padding: '24px 26px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <Users width={18} height={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                Project Team & Collaboration
              </h3>
              <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>
                {project.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Onboarding Notice */}
        <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '18px', fontSize: '12px', color: '#a1a1aa', lineHeight: '1.5' }}>
          Team members inherit read/write access to this project’s Lakehouses, PySpark notebooks, and agent-generated blast-radius lineage graphs.
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#a1a1aa', marginBottom: '8px', letterSpacing: '0.04em' }}>
            INVITE TEAM MEMBER
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr auto', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="projects-modal-input"
              style={{ fontSize: '12.5px', padding: '8px 10px' }}
              required
            />
            <input
              type="email"
              placeholder="user@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="projects-modal-input"
              style={{ fontSize: '12.5px', padding: '8px 10px' }}
              required
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'owner' | 'engineer' | 'viewer')}
              className="projects-modal-input"
              style={{ fontSize: '12px', padding: '8px 8px', cursor: 'pointer' }}
            >
              <option value="owner">Owner / Architect</option>
              <option value="engineer">Data Engineer</option>
              <option value="viewer">Viewer / Analyst</option>
            </select>
            <button
              type="submit"
              disabled={isSubmitting || !newEmail.trim() || !newName.trim()}
              className="projects-btn-new-primary"
              style={{ padding: '8px 12px', fontSize: '12.5px' }}
            >
              <UserPlus width={13} height={13} />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Member List */}
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#a1a1aa', marginBottom: '10px', letterSpacing: '0.04em' }}>
          MEMBERS ({currentMembers.length})
        </label>
        <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {currentMembers.map((m) => {
            const initials = m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="project-member-avatar-pill" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#f4f4f5' }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: '#71717a' }}>{m.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: m.role === 'owner' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
                      color: m.role === 'owner' ? '#10b981' : '#a1a1aa',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {m.role === 'owner' ? <Shield width={10} height={10} /> : <UserCheck width={10} height={10} />}
                    {m.role === 'owner' ? 'Owner' : m.role === 'engineer' ? 'Data Engineer' : 'Viewer'}
                  </span>

                  {currentMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
                      title="Remove member"
                    >
                      <Trash2 width={13} height={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="projects-modal-btn-submit">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

