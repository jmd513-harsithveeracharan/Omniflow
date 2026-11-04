import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { ChatSession } from '../../types';

interface ProjectRecentsListProps {
  sessions: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return dateStr;
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) return `${Math.floor(diffDay / 30)}mo ago`;
    if (diffDay > 1) return `${diffDay} days ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffHour >= 1) return `${diffHour}h ago`;
    if (diffMin >= 1) return `${diffMin}m ago`;
    return 'Just now';
  } catch {
    return dateStr;
  }
}

export const ProjectRecentsList: React.FC<ProjectRecentsListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}) => {
  return (
    <div className="w-full mt-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[13px] font-medium text-[#8e8ea0] tracking-normal">
          Recents
        </h3>
        {sessions.length > 0 && (
          <span className="text-[11px] text-[#5c5c6b]">
            {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'}
          </span>
        )}
      </div>

      {/* Recents Session Rows */}
      {sessions.length === 0 ? (
        <div className="py-6 px-4 rounded-xl border border-dashed border-[#2b2b34] text-center bg-[#151519]/50">
          <p className="text-xs text-[#71717a]">
            No conversations yet. Type above to start your first chat in this workspace.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-0.5">
          {sessions.map((sess) => {
            const isSelected = activeSessionId === sess.sessionId;
            return (
              <div
                key={sess.sessionId}
                onClick={() => onSelectSession(sess.sessionId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSession(sess.sessionId);
                  }
                }}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-[#272730] text-white'
                    : 'text-[#d1d1db] hover:bg-[#202028] hover:text-white'
                }`}
              >
                {/* Chat Title & Leading Icon */}
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <MessageSquare
                    width={14}
                    height={14}
                    className="text-[#71717a] group-hover:text-emerald-400 transition-colors flex-shrink-0"
                  />
                  <span className="text-sm font-normal truncate tracking-tight">
                    {sess.title || 'Untitled Conversation'}
                  </span>
                </div>

                {/* Right: Timestamp and Delete */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-xs text-[#71717a] font-normal group-hover:text-[#a1a1aa] transition-colors">
                    {formatRelativeTime(sess.lastActive)}
                  </span>

                  {onDeleteSession && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(sess.sessionId);
                      }}
                      title="Delete chat"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#2f2f3a] text-[#71717a] hover:text-red-400 transition-all"
                    >
                      <Trash2 width={12} height={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
