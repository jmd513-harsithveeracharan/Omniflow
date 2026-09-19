import React from 'react';
import { Search, LayoutGrid, List, ChevronDown, FolderPlus } from 'lucide-react';

interface ProjectsHeaderProps {
  search: string;
  setSearch: (val: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortBy: 'updated' | 'name' | 'created';
  setSortBy: (sort: 'updated' | 'name' | 'created') => void;
  isSortOpen: boolean;
  setIsSortOpen: (open: boolean) => void;
  sortRef: React.RefObject<HTMLDivElement>;
  onOpenCreateModal: () => void;
}

export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({
  search,
  setSearch,
  isSearchOpen,
  setIsSearchOpen,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  isSortOpen,
  setIsSortOpen,
  sortRef,
  onOpenCreateModal,
}) => {
  return (
    <div className="projects-header-row">
      <h1 className="projects-page-title">Projects</h1>
      <div className="projects-header-actions">
        {/* Search */}
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

        {/* View Mode */}
        <button
          className="projects-icon-btn"
          onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          title={viewMode === 'grid' ? 'Switch to List view' : 'Switch to Grid view'}
          type="button"
        >
          {viewMode === 'grid' ? <LayoutGrid width={15} height={15} /> : <List width={15} height={15} />}
        </button>

        {/* Sort Dropdown */}
        <div className="projects-sort-dropdown" ref={sortRef} style={{ position: 'relative' }}>
          <button
            className="projects-sort-btn"
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
          >
            <span>
              Sort by{' '}
              <strong>
                {sortBy === 'updated' ? 'Last updated' : sortBy === 'name' ? 'Alphabetical' : 'Date created'}
              </strong>
            </span>
            <ChevronDown width={12} height={12} />
          </button>
          {isSortOpen && (
            <div className="projects-sort-menu" style={{ display: 'block' }}>
              <button
                className={`projects-sort-item ${sortBy === 'updated' ? 'active' : ''}`}
                onClick={() => { setSortBy('updated'); setIsSortOpen(false); }}
                type="button"
              >
                Last updated
              </button>
              <button
                className={`projects-sort-item ${sortBy === 'name' ? 'active' : ''}`}
                onClick={() => { setSortBy('name'); setIsSortOpen(false); }}
                type="button"
              >
                Alphabetical
              </button>
              <button
                className={`projects-sort-item ${sortBy === 'created' ? 'active' : ''}`}
                onClick={() => { setSortBy('created'); setIsSortOpen(false); }}
                type="button"
              >
                Date created
              </button>
            </div>
          )}
        </div>

        {/* New Project Primary CTA */}
        <button
          className="projects-btn-new-primary"
          type="button"
          onClick={onOpenCreateModal}
        >
          <FolderPlus width={14} height={14} />
          <span>New project</span>
        </button>
      </div>
    </div>
  );
};
