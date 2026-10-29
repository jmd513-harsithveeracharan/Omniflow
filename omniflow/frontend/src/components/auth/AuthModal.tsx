import React from 'react';
import { X, Shield, LogIn, LogOut } from 'lucide-react';
import { UserProfile } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserChanged: (user: UserProfile | null) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  if (!isOpen) return null;

  const handleLogin = () => {
    onUserChanged(null);
    onClose();
  };

  const handleSignOut = () => {
    onUserChanged(null);
  };

  return (
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: '380px',
          maxWidth: '92vw',
          background: '#18181b',
          borderRadius: '14px',
          padding: '22px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield width={18} height={18} style={{ color: '#10b981' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
                {currentUser ? 'OmniFlow Account' : 'Log In to OmniFlow'}
              </h3>
              <p style={{ fontSize: '11.5px', color: '#a1a1aa', margin: '2px 0 0 0' }}>
                Microsoft Fabric Workspace Identity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Profile Card */}
        <div style={{
          background: '#202024',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: currentUser?.avatar_color || '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '15px',
            }}>
              {(currentUser?.name || currentUser?.email || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                  {currentUser?.name || 'Workspace Identity'}
                </span>
                {currentUser && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '4px',
                    padding: '1px 5px',
                  }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentUser?.email || 'identity@fabric.ai'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {currentUser ? (
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <LogOut width={14} height={14} />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              background: '#10b981',
              border: 'none',
              color: '#09090b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <LogIn width={14} height={14} />
            <span>Log In</span>
          </button>
        )}
      </div>
    </div>
  );
};
