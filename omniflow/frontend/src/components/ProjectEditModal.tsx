import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Settings,
  Database,
  Users,
  GitBranch,
  FolderOpen,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Share2,
  Network,
  Trash2,
} from 'lucide-react';
import { ProjectRecord, ProjectMetadata } from '../types';
import { ProjectTeamTab } from './project/ProjectTeamTab';
import { ProjectGitTab } from './project/ProjectGitTab';
import { ProjectWorkspacesPicker } from './projects/ProjectWorkspacesPicker';

interface ProjectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectRecord | null;
  onSave: (
    projectId: string,
    updates: {
      name: string;
      description: string;
      local_path?: string;
      metadata?: ProjectMetadata;
    }
  ) => Promise<void>;
  initialTab?: 'general' | 'workspaces' | 'team' | 'git';
  onDeleteProject?: (projectId: string) => void;
  onOpenRelationshipGraph?: (projectId: string) => void;
}

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
  isOpen,
  onClose,
  project,
  onSave,
  initialTab = 'general',
  onDeleteProject,
  onOpenRelationshipGraph,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'workspaces' | 'team' | 'git'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [sharedContext, setSharedContext] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      const meta = project.metadata || {};
      setObjectives(meta.objectives || '');
      setLocalPath(project.local_path || meta.localPath || '');
      setSelectedWorkspaces(meta.workspaces || []);
      setSharedContext(meta.sharedContext !== false);
      setError(null);
      setSaveSuccess(false);
    }
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [project, isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const handleOpenGraph = () => {
    if (!project) return;
    onClose();
    if (onOpenRelationshipGraph) {
      onOpenRelationshipGraph(project.id);
    }
  };

  const handleDelete = () => {
    if (!project) return;
    const projName = project.name || project.id;
    if (
      window.confirm(
        `Are you sure you want to delete "${projName}"? This will remove all local mappings and lineage history.`
      )
    ) {
      if (onDeleteProject) {
        onDeleteProject(project.id);
      }
      onClose();
    }
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const relPath = files[0] as unknown as { path?: string; webkitRelativePath?: string };
      if (relPath.path) {
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

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      setActiveTab('general');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);

      const updatedMeta: ProjectMetadata = {
        ...(project.metadata || {}),
        objectives: objectives.trim(),
        workspaces: selectedWorkspaces,
        targetWorkspace: selectedWorkspaces[0] || 'Fabric Workspace',
        sharedContext,
        localPath: localPath.trim(),
      };

      await onSave(project.id, {
        name: name.trim(),
        description: description.trim(),
        local_path: localPath.trim(),
        metadata: updatedMeta,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const NAV_ITEMS = [
    { id: 'general' as const, label: 'General', icon: Settings, desc: 'Project identity, objectives & lineage sharing' },
    { id: 'workspaces' as const, label: 'Fabric Workspaces', icon: Database, desc: 'Scoped Lakehouses and dynamic GUID routing' },
    { id: 'team' as const, label: 'Team & Members', icon: Users, desc: 'Manage project collaborators, roles and access' },
    { id: 'git' as const, label: 'Storage & Git', icon: GitBranch, desc: 'Local folder mapping, branch status and remote sync' },
  ];

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="sso-modal-backdrop" style={{ display: 'flex' }} onClick={onClose}>
      <div className="claude-settings-dialog" onClick={(e) => e.stopPropagation()}>
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside className="claude-settings-sidebar">
          <div className="claude-settings-search">
            <Search width={14} height={14} />
            <input
              type="text"
              placeholder="Search details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="claude-settings-nav">
            <div className="settings-nav-group-label">Project Details</div>
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`claude-settings-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon width={15} height={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {onOpenRelationshipGraph && (
              <button
                type="button"
                className="claude-settings-nav-item"
                style={{ marginTop: '4px', color: '#7dd3fc' }}
                onClick={handleOpenGraph}
              >
                <Network width={15} height={15} style={{ color: '#38bdf8' }} />
                <span>Relationship Graph</span>
              </button>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
            <div style={{ fontSize: '11px', color: '#71717a', padding: '0 8px' }}>
              Project ID:
              <div style={{ fontFamily: 'monospace', color: '#a1a1aa', marginTop: '2px', wordBreak: 'break-all' }}>
                {project.id}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT PANE */}
        <div className="claude-settings-body">
          {/* Header Row */}
          <div className="pane-header-row" style={{ marginBottom: '14px' }}>
            <div>
              <h2 className="pane-title">{currentNav.label}</h2>
              <p className="pane-desc" style={{ marginTop: '2px', fontSize: '12px' }}>{currentNav.desc}</p>
            </div>
            <div className="pane-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {onOpenRelationshipGraph && (
                <button
                  type="button"
                  onClick={handleOpenGraph}
                  title="View Lineage & Relationship Graph"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 11px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '7px',
                    color: '#e4e4e7',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  <Network width={13} height={13} style={{ color: '#38bdf8' }} />
                  <span>Relationship Graph</span>
                </button>
              )}
              <button
                type="button"
                className="btn-subtle-icon btn-close-modal-icon"
                title="Close dialog"
                onClick={onClose}
              >
                <X width={18} height={18} />
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: '12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle width={14} height={14} />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                color: '#38bdf8',
                fontSize: '12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 width={14} height={14} />
              <span>Project settings saved successfully</span>
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="settings-tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#e4e4e7', marginBottom: '5px' }}>
                  Project Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Enterprise Medallion Platform"
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '8px 11px',
                    color: '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#e4e4e7', marginBottom: '5px' }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of data pipeline goals, lakehouses, and analytics scope..."
                  rows={2}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '7px 11px',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#e4e4e7', marginBottom: '5px' }}>
                  Objectives & Scope
                </label>
                <textarea
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="Describe upstream data sources, medallion layer transformations, or business KPIs..."
                  rows={2}
                  style={{
                    width: '100%',
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '7px 11px',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Shared Multi-turn Context Toggle */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '9px',
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <input
                  type="checkbox"
                  id="chkSharedContext"
                  checked={sharedContext}
                  onChange={(e) => setSharedContext(e.target.checked)}
                  style={{ accentColor: '#38bdf8', width: '15px', height: '15px', marginTop: '2px', cursor: 'pointer' }}
                />
                <label htmlFor="chkSharedContext" style={{ cursor: 'pointer', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#f4f4f5' }}>
                    <Share2 width={13} height={13} style={{ color: '#38bdf8' }} />
                    <span>Share multi-turn chat history & agent blast-radius lineage</span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a1a1aa', lineHeight: 1.4 }}>
                    When enabled, team members can view session history, explore the shared lineage graph, and inspect downstream impact analysis across project workspaces.
                  </p>
                </label>
              </div>

              {/* Danger Zone: Delete Project */}
              {onDeleteProject && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.03)',
                    border: '1px solid rgba(239, 68, 68, 0.18)',
                    borderRadius: '9px',
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginTop: '2px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Trash2 width={13} height={13} />
                      <span>Delete project</span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a1a1aa' }}>
                      Permanently remove this project and dissociate local workspace bindings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.28)',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    Delete project
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WORKSPACES */}
          {activeTab === 'workspaces' && (
            <div className="settings-tab-pane">
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#a1a1aa' }}>
                Select the live Microsoft Fabric workspaces scoped for this project. All provisioned Lakehouses and PySpark notebooks will be automatically contained inside these workspaces.
              </p>
              <ProjectWorkspacesPicker
                selectedWorkspaces={selectedWorkspaces}
                onChange={setSelectedWorkspaces}
              />
            </div>
          )}

          {/* TAB 3: TEAM & MEMBERS */}
          {activeTab === 'team' && (
            <div className="settings-tab-pane">
              <ProjectTeamTab projectId={project.id} />
            </div>
          )}

          {/* TAB 4: STORAGE & GIT */}
          {activeTab === 'git' && (
            <div className="settings-tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Local Hard Disk Storage Location */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#f4f4f5',
                    }}
                  >
                    <HardDrive width={14} height={14} style={{ color: '#38bdf8' }} />
                    <span>Local Project Storage Location</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseDefault}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '11.5px',
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
                    placeholder="e.g. C:\Harsith_Work\Fabric_AI\projects\PRJ-SAMPLE"
                    style={{
                      flex: 1,
                      background: '#18181b',
                      border: `1px solid ${localPath ? 'rgba(255, 255, 255, 0.1)' : 'rgba(245, 158, 11, 0.5)'}`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
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
                      gap: '6px',
                      padding: '8px 14px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      color: '#f4f4f5',
                      fontSize: '12px',
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
                  <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertCircle width={12} height={12} />
                    <span>No folder linked. An amber warning will indicate this project needs a local directory.</span>
                  </p>
                ) : (
                  <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#71717a' }}>
                    Target local directory on hard disk for synthesized PySpark notebooks and Star-schema DDLs.
                  </p>
                )}
              </div>

              {/* Integrated Git & Cloud Tab */}
              <ProjectGitTab project={project} localPath={localPath} />
            </div>
          )}

          {/* Action Footer */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'transparent',
                color: '#a1a1aa',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveAll()}
              disabled={isSaving}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#ffffff',
                color: '#111113',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isSaving ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
