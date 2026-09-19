import React from 'react';
import { Pin, MoreVertical, FolderGit2, Folder } from 'lucide-react';
import { ProjectRecord } from '../../types';

interface ProjectCardProps {
  project: ProjectRecord;
  onOpen: (id: string) => void;
  onTogglePin: (e: React.MouseEvent, p: ProjectRecord) => void;
  onOpenActionMenu: (e: React.MouseEvent, p: ProjectRecord) => void;
}

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

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onTogglePin,
  onOpenActionMenu,
}) => {
  const isPinned = Boolean(project.is_pinned);
  const timeAgo = formatRelativeTime(project.updated_at || project.created_at);
  const meta = project.metadata || {};
  const folderPath = meta.fabricFolder || `AI_Test_Folder/${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const badgeLabel = meta.badge || project.badge || 'Fabric Project';
  const members = meta.members || [];

  return (
    <div
      className={`project-card ${isPinned ? 'is-pinned' : ''}`}
      onClick={() => onOpen(project.id)}
    >
      <div className="project-card-top-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div className="project-card-badge">{badgeLabel}</div>
          {folderPath && (
            <div
              className="project-folder-pill"
              title={`Fabric Workspace Folder: ${folderPath}`}
            >
              <Folder width={11} height={11} style={{ opacity: 0.7 }} />
              <span>{folderPath.replace('AI_Test_Folder/', '')}</span>
            </div>
          )}
        </div>

        <div className="project-card-actions-row" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`project-card-pin-btn ${isPinned ? 'pinned' : ''}`}
            onClick={(e) => onTogglePin(e, project)}
            title={isPinned ? 'Unpin project' : 'Pin to top'}
          >
            <Pin width={13} height={13} />
          </button>
          <button
            type="button"
            className="project-card-more-btn"
            onClick={(e) => onOpenActionMenu(e, project)}
            title="More options"
          >
            <MoreVertical width={14} height={14} />
          </button>
        </div>
      </div>

      <h3 className="project-card-name">{project.name}</h3>
      <p className="project-card-description">
        {project.description || 'No description provided'}
      </p>

      <div className="project-card-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="project-card-items-count">
            <FolderGit2 width={12} height={12} />
            {project.itemsCount || 0} Fabric assets
          </span>

          {members.length > 0 && (
            <div className="project-members-stack" title={`${members.length} team members`}>
              {members.slice(0, 3).map((m, idx) => {
                const initials = m.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'M';
                return (
                  <span
                    key={m.id || idx}
                    className="project-member-avatar-pill"
                    title={`${m.name} (${m.role})`}
                  >
                    {initials}
                  </span>
                );
              })}
              {members.length > 3 && (
                <span className="project-member-avatar-pill avatar-more">
                  +{members.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <span className="project-card-modified">Updated {timeAgo}</span>
      </div>
    </div>
  );
};

