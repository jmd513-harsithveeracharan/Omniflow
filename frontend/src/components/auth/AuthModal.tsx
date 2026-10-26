import React, { useState } from 'react';
import { X, User, Mail, Lock, Shield, UserPlus, LogIn, LogOut, Check } from 'lucide-react';
import { UserProfile } from '../../types';
import { loginUser, registerUser } from '../../services/api';

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
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await loginUser(email.trim(), password);
      if (res.success && res.user) {
        onUserChanged(res.user);
        setSuccessMsg(`Welcome back, ${res.user.name}!`);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await registerUser(email.trim(), password, name.trim());
      if (res.success && res.user) {
        onUserChanged(res.user);
        setSuccessMsg(`Account created for ${res.user.name}!`);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    onUserChanged(null);
    setSuccessMsg('Signed out successfully');
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-container glass-card"
        style={{
          maxWidth: '440px',
          width: '92%',
          padding: '24px',
          background: '#13151b',
          border: '1px solid #272a34',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          borderRadius: '14px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Shield width={18} height={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f1f5f9' }}>
                OmniFlow Account & RBAC
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
                Team identity & role-based project access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Current User Card if signed in */}
        {currentUser ? (
          <div
            style={{
              background: '#1c1f2a',
              border: '1px solid #2d3345',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: currentUser.avatar_color || '#10b981',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '16px',
                }}
              >
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px' }}>
                    {currentUser.name}
                  </span>
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      padding: '1px 5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    Active
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentUser.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <LogOut width={14} height={14} />
                Sign Out / Switch User
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                background: '#191c25',
                padding: '3px',
                borderRadius: '8px',
                marginBottom: '16px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab('signin'); setError(null); }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'signin' ? '#252936' : 'transparent',
                  color: activeTab === 'signin' ? '#f8fafc' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogIn width={14} height={14} />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(null); }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'register' ? '#252936' : 'transparent',
                  color: activeTab === 'register' ? '#f8fafc' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <UserPlus width={14} height={14} />
                Create Account
              </button>
            </div>

            {error && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {error}
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '12px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Check width={14} height={14} />
                {successMsg}
              </div>
            )}

            {activeTab === 'signin' ? (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail width={15} height={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="engineer@fabric.ai"
                      style={{
                        width: '100%',
                        background: '#191c25',
                        border: '1px solid #2d3345',
                        borderRadius: '7px',
                        padding: '8px 10px 8px 34px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock width={15} height={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: '100%',
                        background: '#191c25',
                        border: '1px solid #2d3345',
                        borderRadius: '7px',
                        padding: '8px 10px 8px 34px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    marginTop: '6px',
                  }}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User width={15} height={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Mercer"
                      style={{
                        width: '100%',
                        background: '#191c25',
                        border: '1px solid #2d3345',
                        borderRadius: '7px',
                        padding: '8px 10px 8px 34px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail width={15} height={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex.mercer@fabric.ai"
                      style={{
                        width: '100%',
                        background: '#191c25',
                        border: '1px solid #2d3345',
                        borderRadius: '7px',
                        padding: '8px 10px 8px 34px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '5px' }}>
                    Password (Min 6 chars)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock width={15} height={15} style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: '100%',
                        background: '#191c25',
                        border: '1px solid #2d3345',
                        borderRadius: '7px',
                        padding: '8px 10px 8px 34px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '7px',
                    padding: '9px',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    marginTop: '6px',
                  }}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

