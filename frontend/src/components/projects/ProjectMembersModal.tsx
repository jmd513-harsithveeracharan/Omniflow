import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { ProjectRecord, ProjectMember } from '../../types';
import { ProjectTeamSearch } from './ProjectTeamSearch';

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
  const [, setIsSubmitting] = useState(false);

  if (!isOpen || !project) return null;

  const currentMembers: ProjectMember[] = project.metadata?.members || [
    {
      id: 'usr_harsith',
      name: 'Harsith Veer Bheesetti (You)',
      email: 'harsith@fabric.internal',
      avatarBg: '#10b981',
    },
  ];

  const handleAddMember = async (newMember: ProjectMember) => {
    const updated = [...currentMembers, newMember];
    try {
      setIsSubmitting(true);
      await onUpdateMembers(project.id, updated);
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
                width: '36px',
                height: '36px',
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
                Project Collaborators
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
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '12px',
            color: '#a1a1aa',
            lineHeight: '1.5',
          }}
        >
          Collaborators share multi-turn chat history, Fabric Lakehouse lineage, and agent session context within this project. Permissions are governed by your Microsoft Fabric tenant access.
        </div>

        {/* Team Search & Discovery */}
        <ProjectTeamSearch
          members={currentMembers}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />

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
