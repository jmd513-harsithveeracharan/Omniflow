import React from 'react';
import { Trash2 } from 'lucide-react';
import { ChatSession } from '../../types';

interface ProjectRecentsListProps {
  sessions: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '6 days ago';
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
    <div className="w-full mt-10">
      {/* Section Header */}
      <div className="mb-3">
        <h3 className="text-[14px] font-normal text-[#8e918f] tracking-tight">
          Recents
        </h3>
      </div>

      {/* Recents Session Rows */}
      {sessions.length === 0 ? (
        <div className="py-2">
          <p className="text-[13px] text-[#8e918f]">
            No conversations yet. Type above to start your first chat in this project.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-1">
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
                className={`group flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#1a1a1c] text-[#f0f0f2]'
                    : 'text-[#c4c7c5] hover:bg-[#1a1a1c]/70 hover:text-[#f0f0f2]'
                }`}
              >
                {/* Chat Title */}
                <span className="text-[15px] font-normal tracking-tight truncate pr-4">
                  {sess.title || 'Greeting'}
                </span>

                {/* Right: Timestamp and Delete */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[13px] text-[#8e918f] font-normal">
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
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-red-400 transition-all"
                    >
                      <Trash2 width={13} height={13} />
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
