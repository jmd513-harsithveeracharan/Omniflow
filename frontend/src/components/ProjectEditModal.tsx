import React, { useState, useEffect, useRef } from 'react';
import { X, FolderGit2, FolderOpen, HardDrive, AlertCircle, Users, Settings } from 'lucide-react';
import { ProjectRecord } from '../types';
import { ProjectTeamTab } from './project/ProjectTeamTab';

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectRecord | null;
  onSave: (projectId: string, updates: { name: string; description: string; local_path?: string }) => Promise<void>;
}

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'team'>('general');
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setLocalPath(project.local_path || project.metadata?.localPath || '');
      setError(null);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, isOpen, onClose]);

  if (!isOpen || !project) return null;

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // In webkitdirectory, files[0].webkitRelativePath has relative root
      const relPath = (files[0] as unknown as { path?: string; webkitRelativePath?: string });
      if (relPath.path) {
        // Electron / local path
        const parentDir = relPath.path.substring(0, relPath.path.lastIndexOf('\\'));
        setLocalPath(parentDir);
      } else {
        const rootDir = (relPath.webkitRelativePath || '').split('/')[0];
        setLocalPath(`C:\\Harsith_Work\\Fabric_AI\\projects\\${rootDir || project.id}`);
      }
    }
  };

  const handleUseDefault = () => {
    setLocalPath(`C:\\Harsith_Work\\Fabric_AI\\omniflow\\generated_artifacts\\${project.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      await onSave(project.id, {
        name: name.trim(),
        description: description.trim(),
        local_path: localPath.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container glass-card"
        style={{ maxWidth: '480px', width: '90%', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <FolderGit2 width={18} height={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#e3e3e3' }}>
                Edit Project
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#8e918f' }}>
                Update project name and description
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8e918f',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: '#181b22',
            padding: '3px',
            borderRadius: '8px',
            marginBottom: '16px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveModalTab('general')}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeModalTab === 'general' ? '#252936' : 'transparent',
              color: activeModalTab === 'general' ? '#f8fafc' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Settings width={13} height={13} />
            General & Storage
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('team')}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeModalTab === 'team' ? '#252936' : 'transparent',
              color: activeModalTab === 'team' ? '#f8fafc' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Users width={13} height={13} />
            Team & RBAC
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12.5px',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        {activeModalTab === 'team' ? (
          <ProjectTeamTab projectId={project.id} />
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#c4c7c5',
                marginBottom: '6px',
              }}
            >
              Project Name <span style={{ color: '#10b981' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Enterprise Retail Medallion"
              style={{
                width: '100%',
                background: '#131314',
                border: '1px solid #333538',
                borderRadius: '8px',
                padding: '9px 12px',
                color: '#e3e3e3',
                fontSize: '13px',
                outline: 'none',
              }}
              autoFocus
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#c4c7c5',
                marginBottom: '6px',
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the pipeline, data assets, and architecture..."
              rows={3}
              style={{
                width: '100%',
                background: '#131314',
                border: '1px solid #333538',
                borderRadius: '8px',
                padding: '9px 12px',
                color: '#e3e3e3',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Local Hard Disk / Storage Directory Mapping */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid #27272a', borderRadius: '10px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#e4e4e7',
                }}
              >
                <HardDrive width={14} height={14} style={{ color: '#10b981' }} />
                <span>Local Project Storage Location</span>
              </label>
              <button
                type="button"
                onClick={handleUseDefault}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#10b981',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                Use Default Path
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="e.g. C:\Harsith_Work\Fabric_AI\projects\PRJ-GLOBAL-DELIVERY"
                style={{
                  flex: 1,
                  background: '#131314',
                  border: `1px solid ${localPath ? '#333538' : 'rgba(245, 158, 11, 0.5)'}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#e3e3e3',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is standard for folder picking
                webkitdirectory=""
                directory=""
                style={{ display: 'none' }}
                onChange={handleFolderPicked}
              />
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 12px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: '8px',
                  color: '#f4f4f5',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <FolderOpen width={13} height={13} />
                <span>Browse</span>
              </button>
            </div>

            {!localPath ? (
              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertCircle width={12} height={12} />
                <span>No folder linked. An amber <strong>!</strong> warning mark will indicate this project needs a local folder.</span>
              </p>
            ) : (
              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#71717a' }}>
                Target directory on hard disk for synthesized PySpark notebooks and Star-schema DDLs.
              </p>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #333538',
                background: 'transparent',
                color: '#c4c7c5',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#131314',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
