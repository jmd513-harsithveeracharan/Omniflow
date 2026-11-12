import React from 'react';
import { Pin, MoreVertical, Database, User } from 'lucide-react';
import { ProjectRecord } from '../../types';

interface ProjectListRowProps {
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

export const ProjectListRow: React.FC<ProjectListRowProps> = ({
  project,
  onOpen,
  onTogglePin,
  onOpenActionMenu,
}) => {
  const isPinned = Boolean(project.is_pinned);
  const timeAgo = formatRelativeTime(project.updated_at || project.created_at);
  const meta = project.metadata || {};
  const workspaces = meta.workspaces || [];
  const workspaceLabel =
    workspaces.length > 0
      ? workspaces.length === 1
        ? workspaces[0]
        : `${workspaces[0]} +${workspaces.length - 1}`
      : 'Fabric Workspace';
  const members = meta.members || [];
  const rawName = project.name || '';
  const cleanFallbackName = (project.id || '').startsWith('PRJ-')
    ? project.id.replace(/^PRJ-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
    : (project.id || '');
  const displayName = rawName && !rawName.startsWith('PRJ-') ? rawName : (cleanFallbackName || 'Project');

  return (
    <div
      className={`projects-list-row ${isPinned ? 'is-pinned' : ''}`}
      onClick={() => onOpen(project.id)}
    >
      <div className="projects-list-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isPinned && <Pin width={12} height={12} style={{ color: '#10b981', flexShrink: 0 }} />}
          <span className="projects-list-name">{displayName}</span>
          <span
            className="project-card-badge"
            style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Database width={10} height={10} style={{ opacity: 0.8 }} />
            <span>{workspaceLabel}</span>
          </span>
        </div>
        <span className="projects-list-desc">
          {project.description || 'No description provided'}
        </span>
      </div>

      {members.length > 0 ? (
        <div className="project-members-stack" style={{ marginRight: '16px' }} title={`${members.length} collaborators`}>
          {members.slice(0, 2).map((m, idx) => {
            const cleanName = (m.name || '')
              .replace(/\s*\((You|Owner)\)/gi, '')
              .trim();
            const isSystemOrCli =
              !cleanName ||
              cleanName.toLowerCase().includes('omniflow_cli') ||
              cleanName.toLowerCase() === 'system' ||
              cleanName.toLowerCase() === 'cli' ||
              cleanName.toLowerCase() === 'user';

            const words = cleanName.split(/[\s._-]+/).filter(Boolean);
            const letterInitials = words
              .map((w) => w[0])
              .filter((char) => /[A-Za-z]/.test(char))
              .slice(0, 2)
              .join('')
              .toUpperCase();

            const showIcon = isSystemOrCli || !letterInitials;
            const avatarColor =
              m.avatarBg && m.avatarBg !== '#10b981' && !m.avatarBg.includes('rgb(16, 185, 129)')
                ? m.avatarBg
                : '#27272a';

            return (
              <span
                key={m.id || idx}
                className="project-member-avatar-pill"
                style={{
                  background: avatarColor,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e4e4e7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={cleanName || 'Team Member'}
              >
                {showIcon ? (
                  <User width={12} height={12} style={{ display: 'block', color: '#d4d4d8' }} />
                ) : (
                  letterInitials
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <span style={{ width: '40px' }} />
      )}

      <span className="projects-list-date">{timeAgo}</span>

      <div
        className="projects-list-actions"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}
      >
        <button
          type="button"
          className="project-card-pin-btn"
          onClick={(e) => onTogglePin(e, project)}
          title={isPinned ? 'Unpin' : 'Pin to top'}
        >
          <Pin width={13} height={13} style={{ color: isPinned ? '#10b981' : '#71717a' }} />
        </button>
        <button
          type="button"
          className="project-card-more-btn"
          onClick={(e) => onOpenActionMenu(e, project)}
          title="Options"
        >
          <MoreVertical width={13} height={13} />
        </button>
      </div>
    </div>
  );
};
