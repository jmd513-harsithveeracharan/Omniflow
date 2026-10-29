import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FolderGit2 } from 'lucide-react';
import { ProjectRecord, ProjectMetadata, ProjectMember, UserProfile } from '../../types';
import { ProjectTeamSearch } from './ProjectTeamSearch';
import { ProjectWorkspacesPicker } from './ProjectWorkspacesPicker';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectRecord | null;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    badge: string;
    metadata: ProjectMetadata;
  }) => Promise<void>;
  currentUser?: UserProfile | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
  currentUser,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>(['PBT_DATA_AGENT']);
  const [sharedContext, setSharedContext] = useState(true);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ownerMember: ProjectMember = currentUser
      ? {
          id: currentUser.id || 'usr_owner',
          name: `${currentUser.name} (You)`,
          email: currentUser.email,
          role: 'owner',
          avatarBg: currentUser.avatar_color || '#10b981',
        }
      : {
          id: 'usr_me',
          name: 'Project Owner (You)',
          email: 'owner@fabric.ai',
          role: 'owner',
          avatarBg: '#10b981',
        };

    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      const meta = project.metadata || {};
      setSelectedWorkspaces(meta.workspaces || ['PBT_DATA_AGENT']);
      setSharedContext(meta.sharedContext !== false);
      setMembers(meta.members && meta.members.length > 0 ? meta.members : [ownerMember]);
    } else {
      setName('');
      setDescription('');
      setSelectedWorkspaces(['PBT_DATA_AGENT']);
      setSharedContext(true);
      setMembers([ownerMember]);
    }
    setError(null);
  }, [project, isOpen, currentUser]);

  if (!isOpen) return null;

  const handleAddMember = (newMember: ProjectMember) => {
    setMembers((prev) => [...prev, newMember]);
  };

  const handleRemoveMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    try {
      setIsSaving(true);
      setError(null);
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const meta: ProjectMetadata = {
        ...(project?.metadata || {}),
        badge: 'Fabric Project',
        fabricFolder: project?.metadata?.fabricFolder || `AI_Test_Folder/${slug || 'project'}`,
        workspaces: selectedWorkspaces.length > 0 ? selectedWorkspaces : ['PBT_DATA_AGENT'],
        targetWorkspace: selectedWorkspaces[0] || 'PBT_DATA_AGENT',
        sharedContext,
        members,
      };

      await onSave({
        id: project?.id,
        name: name.trim(),
        description: description.trim(),
        badge: 'Fabric Project',
        metadata: meta,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setIsSaving(false);
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
        className="modal-content project-modal-enterprise"
        style={{
          width: '580px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              {project ? <FolderGit2 width={20} height={20} /> : <FolderPlus width={20} height={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                {project ? 'Edit Project' : 'Create Project'}
              </h3>
              <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '2px 0 0 0' }}>
                Shared collaborative workspace for pipelines, lakehouses, and agent lineage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '12.5px',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Project Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              PROJECT NAME <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paxafe-PBT, Enterprise Medallion Platform"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="projects-modal-input"
              autoFocus
            />
          </div>

          {/* Workspaces in Scope */}
          <ProjectWorkspacesPicker
            selectedWorkspaces={selectedWorkspaces}
            onChange={setSelectedWorkspaces}
          />

          {/* Objectives & Scope */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              OBJECTIVES & SCOPE
            </label>
            <textarea
              rows={3}
              placeholder="Describe upstream data sources, Medallion layer goals, PySpark transformations, or business KPIs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="projects-modal-input"
              style={{ resize: 'vertical', lineHeight: '1.5' }}
            />
          </div>

          {/* Team Collaboration with Account Discovery */}
          <ProjectTeamSearch
            members={members}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
          />

          {/* Shared Context Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '22px' }}>
            <input
              type="checkbox"
              checked={sharedContext}
              onChange={(e) => setSharedContext(e.target.checked)}
              style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '12.5px', color: '#d4d4d8' }}>
              Share multi-turn chat history & agent blast-radius lineage across project members
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="projects-modal-btn-cancel">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="projects-modal-btn-submit"
            >
              {isSaving ? 'Saving...' : project ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
