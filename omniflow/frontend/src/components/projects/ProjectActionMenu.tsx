import React, { useEffect, useRef } from 'react';
import { Pin, Edit3, Users, Archive, Trash2 } from 'lucide-react';
import { ProjectRecord } from '../../types';

interface ProjectActionMenuProps {
  project: ProjectRecord;
  position: { top: number; left: number };
  onClose: () => void;
  onTogglePin: (e: React.MouseEvent, p: ProjectRecord) => void;
  onEdit: (p: ProjectRecord) => void;
  onManageMembers: (p: ProjectRecord) => void;
  onArchive: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export const ProjectActionMenu: React.FC<ProjectActionMenuProps> = ({
  project,
  position,
  onClose,
  onTogglePin,
  onEdit,
  onManageMembers,
  onArchive,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const isPinned = Boolean(project.is_pinned);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="sidebar-chat-menu-popup project-action-menu-popup"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '185px',
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="chat-menu-item"
        onClick={(e) => {
          onTogglePin(e, project);
          onClose();
        }}
      >
        <Pin width={13} height={13} style={isPinned ? { color: '#10b981' } : undefined} />
        <span className="menu-label">{isPinned ? 'Unpin project' : 'Pin to top'}</span>
      </div>

      <div
        className="chat-menu-item"
        onClick={() => {
          onClose();
          onEdit(project);
        }}
      >
        <Edit3 width={13} height={13} />
        <span className="menu-label">Edit details</span>
      </div>

      <div
        className="chat-menu-item"
        onClick={() => {
          onClose();
          onManageMembers(project);
        }}
      >
        <Users width={13} height={13} />
        <span className="menu-label">Team & members</span>
      </div>

      <div
        className="chat-menu-item"
        onClick={(e) => {
          onClose();
          onArchive(e, project.id);
        }}
      >
        <Archive width={13} height={13} />
        <span className="menu-label">Archive project</span>
      </div>

      <div className="chat-menu-divider" />

      <div
        className="chat-menu-item item-danger"
        onClick={(e) => {
          onClose();
          onDelete(e, project.id);
        }}
      >
        <Trash2 width={13} height={13} />
        <span className="menu-label">Delete project</span>
      </div>
    </div>
  );
};

