import React, { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { loginUser, registerUser } from '../../services/api';

interface AuthScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    if (activeTab === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    try {
      setIsLoading(true);
      if (activeTab === 'signin') {
        const res = await loginUser(email.trim(), password);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        }
      } else {
        const res = await registerUser(email.trim(), password, name.trim());
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoName: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await loginUser(demoEmail, 'password123');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch {
      // If user not in DB yet, auto-register for demo ease
      try {
        const regRes = await registerUser(demoEmail, 'password123', demoName);
        if (regRes.success && regRes.user) {
          onLoginSuccess(regRes.user);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Demo login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen-container" style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at top, #1a1e29 0%, #0d0f14 65%, #08090c 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
        top: '-10%',
        left: '20%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
        bottom: '-10%',
        right: '20%',
        pointerEvents: 'none',
      }} />

      <div className="auth-screen-card" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(19, 21, 27, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid #272a34',
        borderRadius: '16px',
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
        zIndex: 10,
      }}>
        {/* Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            marginBottom: '14px',
          }}>
            <Sparkles width={24} height={24} color="#10b981" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            OmniFlow
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
            Autonomous Data Engineering Studio for Microsoft Fabric
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: '#13151b',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #272a34',
          marginBottom: '22px',
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: activeTab === 'signin' ? 600 : 500,
              color: activeTab === 'signin' ? '#ffffff' : '#94a3b8',
              background: activeTab === 'signin' ? '#272a34' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: activeTab === 'register' ? 600 : 500,
              color: activeTab === 'register' ? '#ffffff' : '#94a3b8',
              background: activeTab === 'register' ? '#272a34' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Register
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '18px',
            color: '#f87171',
            fontSize: '12.5px',
          }}>
            <AlertCircle width={15} height={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {activeTab === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User width={15} height={15} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="e.g. Harsith Veer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    background: '#13151b',
                    border: '1px solid #272a34',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
              Work Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail width={15} height={15} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  background: '#13151b',
                  border: '1px solid #272a34',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock width={15} height={15} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder={activeTab === 'register' ? 'Min 6 characters' : 'Enter password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  background: '#13151b',
                  border: '1px solid #272a34',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '8px',
              padding: '11px',
              borderRadius: '8px',
              background: '#10b981',
              color: '#09090b',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: isLoading ? 0.75 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isLoading ? (
              <Loader2 width={16} height={16} className="animate-spin" />
            ) : activeTab === 'signin' ? (
              <>
                <LogIn width={15} height={15} />
                <span>Sign In to OmniFlow</span>
              </>
            ) : (
              <>
                <UserPlus width={15} height={15} />
                <span>Create Account & Enter</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Section */}
        <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #272a34' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', marginBottom: '10px' }}>
            Instant Testing Demo Profiles
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('bheesetti.harsith@fabric.ai', 'Bheesetti Harsith')}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid #272a34',
                color: '#cbd5e1',
                fontSize: '11.5px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Lead Architect
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('test.engineer@fabric.ai', 'Test Engineer')}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '7px 8px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid #272a34',
                color: '#cbd5e1',
                fontSize: '11.5px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Data Engineer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
