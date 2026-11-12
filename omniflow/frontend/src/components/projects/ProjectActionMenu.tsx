import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pin, Edit3, Network, Archive, Trash2 } from 'lucide-react';
import { ProjectRecord } from '../../types';

interface ProjectActionMenuProps {
  project: ProjectRecord;
  position: { top: number; left: number };
  onClose: () => void;
  onTogglePin: (e: React.MouseEvent, p: ProjectRecord) => void;
  onEdit: (p: ProjectRecord, initialTab?: 'general' | 'workspaces' | 'team' | 'git') => void;
  onArchive: (e: React.MouseEvent, id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onOpenRelationshipGraph?: (projectId: string) => void;
}

export const ProjectActionMenu: React.FC<ProjectActionMenuProps> = ({
  project,
  position,
  onClose,
  onTogglePin,
  onEdit,
  onArchive,
  onDelete,
  onOpenRelationshipGraph,
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      className="sidebar-chat-menu-popup project-action-menu-popup"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '185px',
        zIndex: 999999,
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
        <Pin width={13} height={13} style={isPinned ? { color: '#e4e4e7' } : undefined} />
        <span className="menu-label">{isPinned ? 'Unpin project' : 'Pin to top'}</span>
      </div>

      {onOpenRelationshipGraph && (
        <div
          className="chat-menu-item"
          onClick={() => {
            onClose();
            onOpenRelationshipGraph(project.id);
          }}
        >
          <Network width={13} height={13} />
          <span className="menu-label">Relationship Graph</span>
        </div>
      )}

      <div
        className="chat-menu-item"
        onClick={() => {
          onClose();
          onEdit(project, 'general');
        }}
      >
        <Edit3 width={13} height={13} />
        <span className="menu-label">Edit details</span>
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
    </div>,
    document.body
  );
};

