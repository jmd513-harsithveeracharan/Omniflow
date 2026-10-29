import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Globe,
  HelpCircle,
  ArrowUpCircle,
  Info,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react';
import { UserProfile } from '../types';

interface UserProfileMenuProps {
  currentUser?: UserProfile | null;
  isCollapsed?: boolean;
  onSignOut?: () => void;
  onSelectView?: (view: string) => void;
  onOpenAuthModal?: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  currentUser,
  isCollapsed = false,
  onSignOut,
  onSelectView,
  onOpenAuthModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const displayName = currentUser?.name
    ? (currentUser.name.includes(' ') ? currentUser.name.split(' ')[0] : currentUser.name)
    : 'Harsith';
  const initial = currentUser?.name
    ? currentUser.name[0].toUpperCase()
    : 'H';
  const displayEmail = currentUser?.email || 'veeracharan99@gmail.com';

  return (
    <div className="claude-profile-footer-container" ref={containerRef}>
      {/* Popover Menu matching Claude.ai */}
      {isOpen && (
        <div className="claude-popover-menu">
          <div className="claude-popover-email-header" title={displayEmail}>
            {displayEmail}
          </div>

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => {
              setIsOpen(false);
              onSelectView?.('settings');
            }}
          >
            <Settings size={15} strokeWidth={1.75} />
            <span>Settings</span>
            <span className="claude-popover-shortcut">Ctrl+Shift+,</span>
          </button>

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => setIsOpen(false)}
          >
            <Globe size={15} strokeWidth={1.75} />
            <span>Language</span>
          </button>

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => {
              setIsOpen(false);
              window.open('https://learn.microsoft.com/fabric', '_blank');
            }}
          >
            <HelpCircle size={15} strokeWidth={1.75} />
            <span>Get help</span>
          </button>

          <div className="claude-popover-divider" />

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => setIsOpen(false)}
          >
            <ArrowUpCircle size={15} strokeWidth={1.75} />
            <span>Upgrade plan</span>
          </button>

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => {
              setIsOpen(false);
              window.open('https://fabric.microsoft.com', '_blank');
            }}
          >
            <Info size={15} strokeWidth={1.75} />
            <span>Learn more</span>
            <ChevronRight size={14} className="claude-popover-arrow" />
          </button>

          <div className="claude-popover-divider" />

          <button
            type="button"
            className="claude-popover-item"
            onClick={() => {
              setIsOpen(false);
              onSignOut?.();
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            <span>Log out</span>
          </button>
        </div>
      )}

      {/* Bottom Bar: Full-Width Profile Pill */}
      <div className="claude-profile-row">
        <button
          type="button"
          className={`claude-profile-pill ${isOpen ? 'active' : ''}`}
          onClick={() => {
            if (!currentUser) {
              onOpenAuthModal?.();
            } else {
              setIsOpen(!isOpen);
            }
          }}
          title={currentUser ? `Signed in as ${currentUser.name}` : 'Click to sign in'}
        >
          <div className="claude-avatar-circle">
            {currentUser ? initial : <User size={14} color="#ffffff" />}
          </div>
          {!isCollapsed && (
            <>
              <div className="claude-profile-name-group">
                <span className="claude-profile-name">{displayName}</span>
                <span className="claude-profile-tier">· Free</span>
              </div>
              <ChevronDown
                size={14}
                className="claude-profile-chevron"
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
