import React, { useState, useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';
import { ProjectRecord, ProjectMetadata } from '../types';
import { fetchProjects, createProject, updateProject, deleteProject } from '../services/api';
import { ProjectsHeader } from './projects/ProjectsHeader';
import { ProjectSkeleton } from './projects/ProjectSkeleton';
import { ProjectCard } from './projects/ProjectCard';
import { ProjectListRow } from './projects/ProjectListRow';
import { ProjectActionMenu } from './projects/ProjectActionMenu';
import { ProjectModal } from './projects/ProjectModal';
import { ProjectEditModal } from './ProjectEditModal';

interface ProjectsViewProps {
  onOpenProject: (projectId: string) => void;
  onOpenRelationshipGraph?: (projectId: string) => void;
  onNewChatWithContext?: (projectName: string) => void;
  onProjectsChanged?: () => void;
  currentUser?: import('../types').UserProfile | null;
  projects?: ProjectRecord[];
  isLoading?: boolean;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenProject,
  onOpenRelationshipGraph,
  onProjectsChanged,
  currentUser,
  projects: initialProjects = [],
  isLoading: initialLoading = false,
}) => {
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);
  const [isLoading, setIsLoading] = useState<boolean>(initialProjects.length === 0 && initialLoading);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'created'>('updated');
  const [isSortOpen, setIsSortOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Modals & Menu State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<ProjectRecord | null>(null);
  const [editingProjectRecord, setEditingProjectRecord] = useState<ProjectRecord | null>(null);
  const [editModalTab, setEditModalTab] = useState<'general' | 'workspaces' | 'team' | 'git'>('general');

  // Floating Action Menu State
  const [activeMenuProject, setActiveMenuProject] = useState<ProjectRecord | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Sync from props if available
  useEffect(() => {
    if (initialProjects && initialProjects.length > 0) {
      setProjects(initialProjects);
      setIsLoading(false);
    }
  }, [initialProjects]);

  const loadAllProjects = async () => {
    try {
      if (projects.length === 0) setIsLoading(true);
      const data = await fetchProjects(currentUser?.email);
      setProjects(data || []);
    } catch (e) {
      console.error('Failed to load projects from DB', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialProjects.length === 0) {
      loadAllProjects();
    }
  }, [currentUser?.email]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Handlers
  const handleOpenCreateModal = () => {
    setSelectedProjectForEdit(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenEditModal = (
    p: ProjectRecord,
    tab: 'general' | 'workspaces' | 'team' | 'git' = 'general'
  ) => {
    setEditingProjectRecord(p);
    setEditModalTab(tab);
  };

  const handleOpenActionMenu = (e: React.MouseEvent, p: ProjectRecord) => {
    e.stopPropagation();
    if (activeMenuProject?.id === p.id) {
      setActiveMenuProject(null);
      setMenuPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - 220),
      left: Math.max(16, Math.min(rect.left - 130, window.innerWidth - 200)),
    });
    setActiveMenuProject(p);
  };

  const handleSaveProject = async (data: {
    id?: string;
    name: string;
    description: string;
    badge: string;
    metadata: ProjectMetadata;
  }) => {
    if (data.id) {
      await updateProject(data.id, {
        name: data.name,
        description: data.description,
        metadata: data.metadata,
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === data.id
            ? { ...p, name: data.name, description: data.description, badge: data.badge, metadata: data.metadata, updated_at: new Date().toISOString() }
            : p
        )
      );
    } else {
      const created = await createProject(data.name, data.description, data.metadata, '', currentUser?.email);
      if (created) {
        const enriched: ProjectRecord = {
          ...created,
          badge: data.badge,
          metadata: data.metadata,
        };
        setProjects((prev) => [enriched, ...prev]);
      }
    }
    onProjectsChanged?.();
  };

  const handleTogglePin = async (e: React.MouseEvent, p: ProjectRecord) => {
    e.stopPropagation();
    const nextPin = p.is_pinned ? 0 : 1;
    setProjects((prev) =>
      prev.map((item) => (item.id === p.id ? { ...item, is_pinned: nextPin } : item))
    );
    try {
      await updateProject(p.id, { is_pinned: nextPin });
      onProjectsChanged?.();
    } catch (err) {
      console.error('Failed to update pin', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this project?')) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteProject(id);
      onProjectsChanged?.();
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await updateProject(id, { is_archived: 1 });
      onProjectsChanged?.();
    } catch (err) {
      console.error('Failed to archive project', err);
    }
  };

  // Filter & Sort
  const filtered = projects
    .filter((p) => {
      if (p.is_archived) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const pinA = a.is_pinned ? 1 : 0;
      const pinB = b.is_pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;

      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'created') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return (
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
      );
    });

  return (
    <section className="view-panel active" id="viewProjects">
      <div className="projects-page-container">
        {/* Header */}
        <ProjectsHeader
          search={search}
          setSearch={setSearch}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sortBy={sortBy}
          setSortBy={setSortBy}
          isSortOpen={isSortOpen}
          setIsSortOpen={setIsSortOpen}
          sortRef={sortRef}
          onOpenCreateModal={handleOpenCreateModal}
        />

        {/* Content Area with Skeleton Loaders */}
        {isLoading ? (
          <ProjectSkeleton viewMode={viewMode} count={4} />
        ) : viewMode === 'grid' ? (
          <div className="projects-cards-grid" style={{ display: 'grid' }}>
            <div className="project-card project-card-create" onClick={handleOpenCreateModal}>
              <div className="project-create-icon-wrap">
                <FolderPlus width={24} height={24} />
              </div>
              <h3 className="project-create-title">Create a new project</h3>
              <p className="project-create-desc">
                Organize Lakehouse schemas, PySpark notebooks, and pipeline DAGs in a dedicated workspace.
              </p>
            </div>

            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={onOpenProject}
                onTogglePin={handleTogglePin}
                onOpenActionMenu={handleOpenActionMenu}
              />
            ))}
          </div>
        ) : (
          <div className="projects-list-container" style={{ display: 'block' }}>
            <div className="projects-list-header">
              <span className="col-name">Name & Scope</span>
              <span style={{ width: '80px', textAlign: 'center' }}>Team</span>
              <span className="col-modified">Modified</span>
              <span className="col-actions" style={{ width: '80px', textAlign: 'right' }}>Actions</span>
            </div>
            <div className="projects-list-body">
              {filtered.map((p) => (
                <ProjectListRow
                  key={p.id}
                  project={p}
                  onOpen={onOpenProject}
                  onTogglePin={handleTogglePin}
                  onOpenActionMenu={handleOpenActionMenu}
                />
              ))}
            </div>
          </div>
        )}

        {/* Floating Action Menu */}
        {activeMenuProject && menuPos && (
          <ProjectActionMenu
            project={activeMenuProject}
            position={menuPos}
            onClose={() => { setActiveMenuProject(null); setMenuPos(null); }}
            onTogglePin={handleTogglePin}
            onEdit={handleOpenEditModal}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onOpenRelationshipGraph={onOpenRelationshipGraph}
          />
        )}

        {/* Modals */}
        <ProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          project={selectedProjectForEdit}
          onSave={handleSaveProject}
          currentUser={currentUser}
        />

        <ProjectEditModal
          isOpen={editingProjectRecord !== null}
          onClose={() => setEditingProjectRecord(null)}
          project={editingProjectRecord}
          onSave={async (pId, updates) => {
            await handleSaveProject({
              id: pId,
              name: updates.name,
              description: updates.description,
              badge: 'Fabric Project',
              metadata: updates.metadata || { localPath: updates.local_path },
            });
            setEditingProjectRecord(null);
          }}
          initialTab={editModalTab}
          onDeleteProject={async (id) => {
            await deleteProject(id);
            setProjects((prev) => prev.filter((p) => p.id !== id));
            setEditingProjectRecord(null);
          }}
          onOpenRelationshipGraph={onOpenRelationshipGraph}
        />
      </div>
    </section>
  );
};

export default ProjectsView;
