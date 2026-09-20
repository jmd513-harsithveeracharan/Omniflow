import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FolderGit2, Check } from 'lucide-react';
import { ProjectRecord, ProjectMetadata, ProjectMember } from '../../types';
import { ProjectTeamPicker } from './ProjectTeamPicker';

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
}

const DOMAIN_BADGES = [
  'Medallion Architecture',
  'SQLGlot AST Transpile',
  'Direct Lake Power BI',
  'Streaming IoT Telemetry',
  'Enterprise CDC Ingestion',
  'Data Quality & Governance',
  'Cross-Workspace Pipeline',
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('Medallion Architecture');
  const [sharedContext, setSharedContext] = useState(true);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      const meta = project.metadata || {};
      setBadge(meta.badge || project.badge || 'Medallion Architecture');
      setSharedContext(meta.sharedContext !== false);
      setMembers(
        meta.members || [
          { id: 'usr_owner', name: 'Lead Architect', email: 'architect@enterprise.internal', role: 'owner' },
        ]
      );
    } else {
      setName('');
      setDescription('');
      setBadge('Medallion Architecture');
      setSharedContext(true);
      setMembers([
        { id: 'usr_owner', name: 'Lead Architect', email: 'architect@enterprise.internal', role: 'owner' },
      ]);
    }
    setError(null);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleAddMember = (mName: string, mEmail: string, mRole: 'owner' | 'engineer' | 'viewer') => {
    const newM: ProjectMember = {
      id: `usr_${Date.now()}`,
      name: mName,
      email: mEmail,
      role: mRole,
    };
    setMembers((prev) => [...prev, newM]);
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
        badge,
        fabricFolder: project?.metadata?.fabricFolder || `AI_Test_Folder/${slug || 'project'}`,
        sharedContext,
        members,
      };

      await onSave({
        id: project?.id,
        name: name.trim(),
        description: description.trim(),
        badge,
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
          width: '560px',
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
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              PROJECT NAME <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paxafe-PBT, Enterprise Retail Medallion"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="projects-modal-input"
              autoFocus
            />
          </div>

          {/* Architecture / Domain */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              ARCHITECTURE DOMAIN
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DOMAIN_BADGES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBadge(b)}
                  className={`project-domain-chip ${badge === b ? 'active' : ''}`}
                >
                  {badge === b && <Check width={11} height={11} />}
                  <span>{b}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              OBJECTIVES & DATA PLATFORM SCOPE
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

          {/* Team Collaboration & Onboarding */}
          <ProjectTeamPicker
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
