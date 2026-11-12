import React, { useState, useEffect } from 'react';
import { UserProfile, FabricAccountProfile } from '../../types';
import { PlatformCube } from '../PlatformCube';
import { fetchFabricAccounts, triggerBrowserLogin } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedAccount, setDetectedAccount] = useState<FabricAccountProfile | null>(null);

  useEffect(() => {
    fetchFabricAccounts()
      .then((accs) => {
        if (accs && accs.length > 0) {
          const active = accs.find((a) => a.is_active) || accs[0];
          setDetectedAccount(active);
        }
      })
      .catch(() => {});
  }, []);

  const handleMicrosoftLogin = async () => {
    try {
      setIsLoading(true);
      if (detectedAccount) {
        const msUser: UserProfile = {
          id: detectedAccount.id,
          name: detectedAccount.name,
          email: detectedAccount.email,
          avatar_color: '#0078d4',
        };
        onLoginSuccess(msUser);
        return;
      }
      const res = await triggerBrowserLogin();
      if (res && res.success && res.accounts && res.accounts.length > 0) {
        const acc = res.accounts[0];
        const msUser: UserProfile = {
          id: acc.id,
          name: acc.name,
          email: acc.email,
          avatar_color: '#0078d4',
        };
        onLoginSuccess(msUser);
      }
    } catch (e) {
      console.error('Microsoft login failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setIsLoading(true);
    const finalEmail = trimmed;
    const computedName = trimmed.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const emailUser: UserProfile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: computedName,
      email: finalEmail,
      avatar_color: '#343438',
    };
    setTimeout(() => {
      onLoginSuccess(emailUser);
    }, 200);
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      background: '#141413',
      color: '#f5f3ec',
      fontFamily: "'Anthropic Sans', 'anthropic-sans', var(--font-sans)",
      overflow: 'hidden',
    }}>
      {/* Left Column: Brand & Form */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 48px',
        minWidth: '340px',
        maxWidth: '680px',
        boxSizing: 'border-box',
        zIndex: 2,
      }}>
        {/* Top-Left OmniFlow Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PlatformCube platformId="fabric" size={24} />
          <span style={{
            fontFamily: "'Anthropic Sans', 'anthropic-sans', var(--font-heading)",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: '-0.02em',
          }}>
            Omni<span style={{ color: '#10b981' }}>flow</span>
          </span>
        </div>

        {/* Center Auth Container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          margin: 'auto 0',
          width: '100%',
        }}>
          {/* Modern Sans Headline */}
          <h1 style={{
            fontFamily: "'Anthropic Sans', 'anthropic-sans', var(--font-heading)",
            fontSize: '38px',
            fontWeight: 700,
            color: '#f8fafc',
            letterSpacing: '-0.03em',
            margin: '0 0 10px 0',
            lineHeight: 1.2,
          }}>
            Orchestrate your intelligence
          </h1>
          <p style={{
            fontSize: '14.5px',
            color: '#94a3b8',
            margin: '0 0 32px 0',
            fontWeight: 400,
            fontFamily: "'Anthropic Sans', 'anthropic-sans', var(--font-sans)",
          }}>
            Your data engineering for Microsoft Fabric
          </p>

          {/* Form Card */}
          <div style={{
            width: '100%',
            maxWidth: '360px',
            background: '#1d1c1a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxSizing: 'border-box',
          }}>
            {/* Interactive Microsoft SSO Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleMicrosoftLogin}
              title={detectedAccount ? `Sign in as ${detectedAccount.email}` : "Sign in with Microsoft Entra ID"}
              style={{
                width: '100%',
                height: '42px',
                background: '#22211f',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2a2825';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#22211f';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }}
            >
              {/* Microsoft 4-square logo */}
              <svg width="17" height="17" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="12" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="12" width="9" height="9" fill="#ffb900" />
              </svg>
              <span>
                {detectedAccount ? `Continue as ${detectedAccount.name.split(' ')[0]}` : 'Continue with Microsoft'}
              </span>
              <span style={{
                fontSize: '10px',
                background: detectedAccount ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: detectedAccount ? '#10b981' : '#a1a1aa',
                border: detectedAccount ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '4px',
                fontWeight: 600,
              }}>
                {detectedAccount ? 'ACTIVE' : 'SSO'}
              </span>
            </button>

            {/* OR Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '18px 0',
              gap: '10px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
              <span style={{ fontSize: '10.5px', color: '#78756d', fontWeight: 600, letterSpacing: '0.05em' }}>
                OR
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  background: '#141413',
                  border: '1px solid #33312c',
                  borderRadius: '8px',
                  color: '#f5f3ec',
                  fontSize: '13.5px',
                  padding: '0 14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#10b981';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.18)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#33312c';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '42px',
                  background: '#f5f3ec',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#141413',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e6e4dc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f5f3ec'; }}
              >
                Continue with email
              </button>
            </form>
          </div>
        </div>

        {/* Clean Empty Footer */}
        <div style={{ height: '24px' }} />
      </div>

      {/* Right Column: Editorial Visual (Exact match to Claude image) */}
      <div style={{
        flex: 1,
        padding: '20px 20px 20px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%',
          height: 'calc(100vh - 40px)',
          borderRadius: '24px',
          overflow: 'hidden',
          position: 'relative',
          background: '#1d1c1a',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}>
          <img
            src="/assets/auth-hero.jpg"
            alt="OmniFlow Wallpaper"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Elegant Minimalist Quote Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '40px 36px',
            background: 'linear-gradient(to top, rgba(14,14,14,0.88) 0%, rgba(14,14,14,0.45) 60%, transparent 100%)',
            color: '#f5f3ec',
            boxSizing: 'border-box',
          }}>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              fontWeight: 500,
              lineHeight: 1.5,
              margin: '0 0 8px 0',
              color: 'rgba(255, 255, 255, 0.95)',
              letterSpacing: '-0.01em',
            }}>
              “Simplicity is prerequisite for reliability.”
            </p>
            <span style={{
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.65)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Edsger W. Dijkstra
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

