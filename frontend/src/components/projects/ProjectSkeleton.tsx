import React from 'react';

interface ProjectSkeletonProps {
  viewMode?: 'grid' | 'list';
  count?: number;
}

export const ProjectSkeleton: React.FC<ProjectSkeletonProps> = ({
  viewMode = 'grid',
  count = 4,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div className="projects-skeleton-list" aria-label="Loading projects">
        {items.map((key) => (
          <div key={key} className="project-skeleton-row">
            <div className="skeleton-line skeleton-folder-icon" />
            <div className="skeleton-col-main">
              <div className="skeleton-line skeleton-title-short" />
              <div className="skeleton-line skeleton-desc-short" />
            </div>
            <div className="skeleton-line skeleton-date-col" />
            <div className="skeleton-line skeleton-action-pill" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="projects-cards-grid projects-skeleton-grid" aria-label="Loading projects">
      {items.map((key) => (
        <div key={key} className="project-card project-skeleton-card">
          <div className="project-card-top-row">
            <div className="skeleton-line skeleton-badge-box" />
            <div className="skeleton-line skeleton-icon-circle" />
          </div>
          <div className="skeleton-line skeleton-title-bar" />
          <div className="skeleton-line skeleton-desc-line" />
          <div className="skeleton-line skeleton-desc-line-short" />
          <div className="project-card-footer" style={{ marginTop: 'auto', paddingTop: '14px' }}>
            <div className="skeleton-line skeleton-footer-chip" />
            <div className="skeleton-line skeleton-footer-meta" />
          </div>
        </div>
      ))}
    </div>
  );
};

