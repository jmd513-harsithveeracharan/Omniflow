import React, { useState, useEffect } from 'react';
import { X, FolderPlus, FolderGit2, Check, Folder } from 'lucide-react';
import { ProjectRecord, ProjectMetadata } from '../../types';

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
  'Medallion Lakehouse',
  'SQLGlot AST Transpile',
  'Direct Lake Power BI',
  'Streaming IoT Telemetry',
  'Enterprise CDC Ingestion',
  'Data Quality & Governance',
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('Medallion Lakehouse');
  const [fabricFolder, setFabricFolder] = useState('');
  const [sharedContext, setSharedContext] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      const meta = project.metadata || {};
      setBadge(meta.badge || project.badge || 'Medallion Lakehouse');
      setFabricFolder(meta.fabricFolder || `AI_Test_Folder/${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      setSharedContext(meta.sharedContext !== false);
    } else {
      setName('');
      setDescription('');
      setBadge('Medallion Lakehouse');
      setFabricFolder('AI_Test_Folder/new-project');
      setSharedContext(true);
    }
    setError(null);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!project) {
      const slug = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setFabricFolder(`AI_Test_Folder/${slug || 'new-project'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;

    try {
      setIsSaving(true);
      setError(null);
      const meta: ProjectMetadata = {
        ...(project?.metadata || {}),
        badge,
        fabricFolder: fabricFolder.trim() || `AI_Test_Folder/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        sharedContext,
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
    <div className="modal-backdrop active" onClick={onClose}>
      <div
        className="modal-content project-modal-enterprise"
        style={{
          width: '520px',
          maxWidth: '95vw',
          background: '#18181b',
          borderRadius: '16px',
          padding: '24px 26px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              {project ? <FolderGit2 width={18} height={18} /> : <FolderPlus width={18} height={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                {project ? 'Edit Project' : 'Create Enterprise Project'}
              </h3>
              <p style={{ fontSize: '12px', color: '#a1a1aa', margin: 0 }}>
                Fabric folder scope, Medallion tier, and team context
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

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '12.5px', marginBottom: '14px' }}>
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
              placeholder="e.g. Enterprise Retail Medallion"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="projects-modal-input"
              autoFocus
            />
          </div>

          {/* Architecture Badge */}
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

          {/* Fabric Target Folder */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              FABRIC WORKSPACE FOLDER SCOPE
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Folder width={14} height={14} style={{ position: 'absolute', left: '12px', color: '#71717a' }} />
              <input
                type="text"
                value={fabricFolder}
                onChange={(e) => setFabricFolder(e.target.value)}
                placeholder="AI_Test_Folder/project-name"
                className="projects-modal-input"
                style={{ paddingLeft: '34px', fontFamily: 'var(--font-mono, monospace)', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
              ARCHITECTURE & ETL OBJECTIVES
            </label>
            <textarea
              rows={3}
              placeholder="Describe ingestion sources, Medallion tiers, PySpark transformations, or business KPIs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="projects-modal-input"
              style={{ resize: 'vertical', lineHeight: '1.5' }}
            />
          </div>

          {/* Shared Context Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '22px' }}>
            <input
              type="checkbox"
              checked={sharedContext}
              onChange={(e) => setSharedContext(e.target.checked)}
              style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '12.5px', color: '#d4d4d8' }}>
              Share Lakehouse Lineage & Agent Session Context across project team
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

