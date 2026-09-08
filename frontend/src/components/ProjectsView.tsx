import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  FolderPlus,
  ArrowUpRight,
  FolderGit2,
} from 'lucide-react';

interface ProjectItem {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  itemsCount: number;
  badge?: string;
}

interface ProjectsViewProps {
  onOpenProject: (projectId: string) => void;
  onNewChatWithContext?: (projectName: string) => void;
}

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'proj_retail_medallion',
    name: 'Enterprise Retail Medallion',
    description:
      '3-Tier Lakehouse platform with automated CDC ingestion from Azure SQL, Delta MERGE SCD-1/2, and Gold Direct Lake models.',
    updatedAt: '2 hours ago',
    itemsCount: 14,
    badge: 'Fabric Lakehouse',
  },
  {
    id: 'proj_sap_reconciliation',
    name: 'SAP SD/MM Sales Pipeline',
    description:
      'Transpilation of SAP ECC tables (VBAK, VBAP) to Spark SQL with surrogate key preservation and foreign key deep reconciliation.',
    updatedAt: 'Yesterday',
    itemsCount: 8,
    badge: 'SQLGlot AST',
  },
  {
    id: 'proj_powerbi_directlake',
    name: 'Power BI Direct Lake Models',
    description:
      'Kimball Star Schema modeling for semantic models reading directly from Delta tables on OneLake without import refresh.',
    updatedAt: '3 days ago',
    itemsCount: 5,
    badge: 'Semantic Model',
  },
];

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onOpenProject,
  onNewChatWithContext,
}) => {
  const [projects] = useState<ProjectItem[]>(DEFAULT_PROJECTS);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="view-panel active" id="viewProjects">
      <div className="projects-page-container">
        {/* Header Row */}
        <div className="projects-header-row">
          <h1 className="projects-page-title">Projects</h1>
          <div className="projects-header-actions">
            {/* Search Wrap */}
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
                  Sort by <strong>{sortBy === 'updated' ? 'Last updated' : 'Alphabetical'}</strong>
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
                </div>
              )}
            </div>

            {/* New Project Primary Button */}
            <button
              className="projects-btn-new-primary"
              type="button"
              onClick={() => onNewChatWithContext?.('New Fabric Project')}
            >
              <FolderPlus width={14} height={14} />
              <span>New project</span>
            </button>
          </div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' ? (
          <div className="projects-cards-grid" style={{ display: 'grid' }}>
            {/* Create Card */}
            <div
              className="project-card project-card-create"
              onClick={() => onNewChatWithContext?.('New Fabric Project')}
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
            {filtered.map((p) => (
              <div
                key={p.id}
                className="project-card"
                onClick={() => onOpenProject(p.id)}
              >
                <div className="project-card-top-row">
                  <div className="project-card-badge">{p.badge}</div>
                  <button
                    className="project-card-open-btn"
                    title="Open Project"
                    type="button"
                  >
                    <ArrowUpRight width={14} height={14} />
                  </button>
                </div>
                <h3 className="project-card-name">{p.name}</h3>
                <p className="project-card-description">{p.description}</p>
                <div className="project-card-footer">
                  <span className="project-card-items-count">
                    <FolderGit2 width={12} height={12} />
                    {p.itemsCount} Fabric assets
                  </span>
                  <span className="project-card-modified">Updated {p.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Table View */
          <div className="projects-list-container" style={{ display: 'block' }}>
            <div className="projects-list-header">
              <span className="col-name">Name & Description</span>
              <span className="col-modified">Modified</span>
            </div>
            <div className="projects-list-body">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="projects-list-row"
                  onClick={() => onOpenProject(p.id)}
                >
                  <div className="projects-list-info">
                    <span className="projects-list-name">{p.name}</span>
                    <span className="projects-list-desc">{p.description}</span>
                  </div>
                  <span className="projects-list-date">{p.updatedAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
