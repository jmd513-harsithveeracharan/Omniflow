import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  FolderPlus,
  FolderGit2,
  Pin,
  MoreVertical,
  Edit3,
  Archive,
  Trash2,
  X,
} from 'lucide-react';
import { ProjectRecord } from '../types';
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../services/api';

interface ProjectsViewProps {
  onOpenProject: (projectId: string) => void;
  onNewChatWithContext?: (projectName: string) => void;
}

const SEED_PROJECTS: ProjectRecord[] = [
  {
    id: 'proj_retail_medallion',
    name: 'Enterprise Retail Medallion',
    description:
      '3-Tier Lakehouse platform with automated CDC ingestion from Azure SQL, Delta MERGE SCD-1/2, and Gold Direct Lake models.',
    is_pinned: 1,
    created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    itemsCount: 14,
    badge: 'Fabric Lakehouse',
  },
  {
    id: 'proj_sap_reconciliation',
    name: 'SAP SD/MM Sales Pipeline',
    description:
      'Transpilation of SAP ECC tables (VBAK, VBAP) to Spark SQL with surrogate key preservation and foreign key deep reconciliation.',
    is_pinned: 0,
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    itemsCount: 8,
    badge: 'SQLGlot AST',
  },
  {
    id: 'proj_powerbi_directlake',
    name: 'Power BI Direct Lake Models',
    description:
      'Kimball Star Schema modeling for semantic models reading directly from Delta tables on OneLake without import refresh.',
    is_pinned: 0,
    created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    itemsCount: 5,
    badge: 'Semantic Model',
  },
];

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenProject,
  onNewChatWithContext: _onNewChatWithContext,
}) => {
  const [projects, setProjects] = useState<ProjectRecord[]>(SEED_PROJECTS);
  const [_isLoading, setIsLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'created'>('updated');
  const [isSortOpen, setIsSortOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDesc, setFormDesc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Action Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadAllProjects = async () => {
    try {
      setIsLoading(true);
      const data = await fetchProjects();
      if (data && data.length > 0) {
        setProjects(data);
      } else {
        setProjects(SEED_PROJECTS);
      }
    } catch (e) {
      console.error('Failed to load projects from DB', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllProjects();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
        setMenuPos(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormName('');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ProjectRecord) => {
    setActiveMenuId(null);
    setEditingProject(p);
    setFormName(p.name);
    setFormDesc(p.description || '');
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: formName.trim(),
          description: formDesc.trim(),
        });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingProject.id
              ? { ...p, name: formName.trim(), description: formDesc.trim(), updated_at: new Date().toISOString() }
              : p
          )
        );
      } else {
        const created = await createProject(formName.trim(), formDesc.trim());
        if (created) {
          setProjects((prev) => [created, ...prev]);
        } else {
          const fakeProj: ProjectRecord = {
            id: `proj_${Date.now()}`,
            name: formName.trim(),
            description: formDesc.trim(),
            is_pinned: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            itemsCount: 0,
            badge: 'Fabric Project',
          };
          setProjects((prev) => [fakeProj, ...prev]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save project', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, p: ProjectRecord) => {
    e.stopPropagation();
    const nextPin = p.is_pinned ? 0 : 1;
    setProjects((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, is_pinned: nextPin } : item))
    );
    try {
      await updateProject(p.id, { is_pinned: nextPin });
    } catch (err) {
      console.error('Failed to update pin', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteProject(id);
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await updateProject(id, { is_archived: 1 });
    } catch (err) {
      console.error('Failed to archive project', err);
    }
  };

  const handleOpenActionMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeMenuId === id) {
      setActiveMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - 200),
      left: Math.min(rect.left - 120, window.innerWidth - 180),
    });
    setActiveMenuId(id);
  };

  // Filter & Sort
  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if ((a.is_pinned || 0) !== (b.is_pinned || 0)) {
        return (b.is_pinned || 0) - (a.is_pinned || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      } else {
        return (
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime()
        );
      }
    });

  return (
    <section className="view-panel active" id="viewProjects">
      <div className="projects-page-container">
        {/* Header Row */}
        <div className="projects-header-row">
          <h1 className="projects-page-title">Projects</h1>
          <div className="projects-header-actions">
            {/* Search Toggle / Box */}
            <div className="projects-search-wrap">
              {!isSearchOpen ? (
                <button
                  className="projects-icon-btn"
                  onClick={() => setIsSearchOpen(true)}
                  title="Search projects"
                  type="button"
                >
                  <Search width={15} height={15} />
                </button>
              ) : (
                <div className="projects-search-input-box" style={{ display: 'flex' }}>
                  <Search width={14} height={14} className="search-input-icon" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    className="projects-search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearch('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Grid vs List Toggle */}
            <button
              className="projects-icon-btn"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              title={viewMode === 'grid' ? 'Switch to List view' : 'Switch to Grid view'}
              type="button"
            >
              {viewMode === 'grid' ? (
                <LayoutGrid width={15} height={15} />
              ) : (
                <List width={15} height={15} />
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="projects-sort-dropdown" style={{ position: 'relative' }}>
              <button
                className="projects-sort-btn"
                type="button"
                onClick={() => setIsSortOpen(!isSortOpen)}
              >
                <span>
                  Sort by{' '}
                  <strong>
                    {sortBy === 'updated'
                      ? 'Last updated'
                      : sortBy === 'name'
                      ? 'Alphabetical'
                      : 'Date created'}
                  </strong>
                </span>
                <ChevronDown width={12} height={12} />
              </button>
              {isSortOpen && (
                <div className="projects-sort-menu" style={{ display: 'block' }}>
                  <button
                    className={`projects-sort-item ${sortBy === 'updated' ? 'active' : ''}`}
                    onClick={() => {
                      setSortBy('updated');
                      setIsSortOpen(false);
                    }}
                    type="button"
                  >
                    Last updated
                  </button>
                  <button
                    className={`projects-sort-item ${sortBy === 'name' ? 'active' : ''}`}
                    onClick={() => {
                      setSortBy('name');
                      setIsSortOpen(false);
                    }}
                    type="button"
                  >
                    Alphabetical
                  </button>
                  <button
                    className={`projects-sort-item ${sortBy === 'created' ? 'active' : ''}`}
                    onClick={() => {
                      setSortBy('created');
                      setIsSortOpen(false);
                    }}
                    type="button"
                  >
                    Date created
                  </button>
                </div>
              )}
            </div>

            {/* New Project Primary Button */}
            <button
              className="projects-btn-new-primary"
              type="button"
              onClick={handleOpenCreateModal}
            >
              <FolderPlus width={14} height={14} />
              <span>New project</span>
            </button>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="projects-cards-grid" style={{ display: 'grid' }}>
            {/* Create Project Card */}
            <div
              className="project-card project-card-create"
              onClick={handleOpenCreateModal}
            >
              <div className="project-create-icon-wrap">
                <FolderPlus width={24} height={24} />
              </div>
              <h3 className="project-create-title">Create a new project</h3>
              <p className="project-create-desc">
                Organize Lakehouse schemas, PySpark notebooks, and pipeline DAGs in a dedicated workspace.
              </p>
            </div>

            {/* Existing Project Cards */}
            {filtered.map((p) => {
              const isPinned = Boolean(p.is_pinned);
              const timeAgo = formatRelativeTime(p.updated_at || p.created_at);
              return (
                <div
                  key={p.id}
                  className={`project-card ${isPinned ? 'is-pinned' : ''}`}
                  onClick={() => onOpenProject(p.id)}
                >
                  <div className="project-card-top-row">
                    <div className="project-card-badge">
                      {p.badge || 'Fabric Project'}
                    </div>
                    <div className="project-card-actions-row" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`project-card-pin-btn ${isPinned ? 'pinned' : ''}`}
                        onClick={(e) => handleTogglePin(e, p)}
                        title={isPinned ? 'Unpin project' : 'Pin to top'}
                      >
                        <Pin width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        className="project-card-more-btn"
                        onClick={(e) => handleOpenActionMenu(e, p.id)}
                        title="More options"
                      >
                        <MoreVertical width={14} height={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="project-card-name">{p.name}</h3>
                  <p className="project-card-description">{p.description || 'No description provided'}</p>

                  <div className="project-card-footer">
                    <span className="project-card-items-count">
                      <FolderGit2 width={12} height={12} />
                      {p.itemsCount || 0} Fabric assets
                    </span>
                    <span className="project-card-modified">Updated {timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Table View */
          <div className="projects-list-container" style={{ display: 'block' }}>
            <div className="projects-list-header">
              <span className="col-name">Name & Description</span>
              <span className="col-modified">Modified</span>
              <span className="col-actions" style={{ width: '80px', textAlign: 'right' }}>Actions</span>
            </div>
            <div className="projects-list-body">
              {filtered.map((p) => {
                const isPinned = Boolean(p.is_pinned);
                const timeAgo = formatRelativeTime(p.updated_at || p.created_at);
                return (
                  <div
                    key={p.id}
                    className={`projects-list-row ${isPinned ? 'is-pinned' : ''}`}
                    onClick={() => onOpenProject(p.id)}
                  >
                    <div className="projects-list-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isPinned && <Pin width={12} height={12} style={{ color: '#10b981' }} />}
                        <span className="projects-list-name">{p.name}</span>
                      </div>
                      <span className="projects-list-desc">{p.description || 'No description provided'}</span>
                    </div>
                    <span className="projects-list-date">{timeAgo}</span>
                    <div className="projects-list-actions" onClick={(e) => e.stopPropagation()} style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                      <button
                        type="button"
                        className="project-card-pin-btn"
                        onClick={(e) => handleTogglePin(e, p)}
                        title={isPinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin width={13} height={13} style={{ color: isPinned ? '#10b981' : '#71717a' }} />
                      </button>
                      <button
                        type="button"
                        className="project-card-more-btn"
                        onClick={(e) => handleOpenActionMenu(e, p.id)}
                        title="Options"
                      >
                        <MoreVertical width={13} height={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Context Action Menu */}
        {activeMenuId && menuPos && (
          <div
            ref={menuRef}
            className="sidebar-chat-menu-popup project-action-menu-popup"
            style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px`, width: '170px' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const activeProj = projects.find((x) => x.id === activeMenuId);
              if (!activeProj) return null;
              const isPinned = Boolean(activeProj.is_pinned);
              return (
                <>
                  <div
                    className="chat-menu-item"
                    onClick={(e) => {
                      handleTogglePin(e, activeProj);
                      setActiveMenuId(null);
                    }}
                  >
                    <Pin width={13} height={13} />
                    <span className="menu-label">{isPinned ? 'Unpin' : 'Pin to top'}</span>
                  </div>
                  <div
                    className="chat-menu-item"
                    onClick={() => handleOpenEditModal(activeProj)}
                  >
                    <Edit3 width={13} height={13} />
                    <span className="menu-label">Edit details</span>
                  </div>
                  <div
                    className="chat-menu-item"
                    onClick={(e) => handleArchive(e, activeProj.id)}
                  >
                    <Archive width={13} height={13} />
                    <span className="menu-label">Archive</span>
                  </div>
                  <div className="chat-menu-divider" />
                  <div
                    className="chat-menu-item item-danger"
                    onClick={(e) => handleDelete(e, activeProj.id)}
                  >
                    <Trash2 width={13} height={13} />
                    <span className="menu-label">Delete</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Create / Edit Project Modal */}
        {isModalOpen && (
          <div className="modal-backdrop active" onClick={() => setIsModalOpen(false)}>
            <div
              className="modal-content"
              style={{ width: '480px', maxWidth: '95vw', background: '#1e1f20', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                    <FolderPlus width={18} height={18} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                    {editingProject ? 'Edit Project' : 'Create New Project'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#8e918f', cursor: 'pointer' }}
                >
                  <X width={16} height={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitModal}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Enterprise Retail Medallion"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#131314',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the Lakehouse architecture, ETL workflows, or business domain..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#131314',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: '1.5',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
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
                    disabled={isSubmitting || !formName.trim()}
                    style={{
                      padding: '8px 18px',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#000000',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: isSubmitting || !formName.trim() ? 0.6 : 1,
                    }}
                  >
                    {isSubmitting ? 'Saving...' : editingProject ? 'Save changes' : 'Create project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProjectsView;
