import React, { useState } from 'react';
import { UserProfile } from '../../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftLogin = () => {
    setIsLoading(true);
    const msUser: UserProfile = {
      id: 'usr_lead',
      name: 'Bheesetti Harsith',
      email: 'bheesetti.harsith@fabric.ai',
      avatar_color: '#10b981',
    };
    setTimeout(() => {
      onLoginSuccess(msUser);
    }, 200);
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const trimmed = email.trim();
    const finalEmail = trimmed || 'bheesetti.harsith@fabric.ai';
    const computedName = trimmed
      ? trimmed.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Bheesetti Harsith';

    const emailUser: UserProfile = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      name: computedName,
      email: finalEmail,
      avatar_color: '#10b981',
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
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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
        {/* Top-Left Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Claude-style Terracotta Starburst */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path
              d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"
              stroke="#d97757"
              strokeWidth="2.75"
              strokeLinecap="round"
            />
          </svg>
          <span style={{
            fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
            fontSize: '20px',
            fontWeight: 500,
            color: '#f5f3ec',
            letterSpacing: '-0.01em',
          }}>
            OmniFlow
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
          {/* Headline */}
          <h1 style={{
            fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
            fontSize: '44px',
            fontWeight: 400,
            color: '#f5f3ec',
            letterSpacing: '-0.025em',
            margin: '0 0 10px 0',
            lineHeight: 1.15,
          }}>
            Question what’s next
          </h1>
          <p style={{
            fontSize: '14.5px',
            color: '#9e9c94',
            margin: '0 0 32px 0',
            fontWeight: 400,
          }}>
            Your thinking partner for Microsoft Fabric
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
            {/* Continue with Microsoft Button */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              style={{
                width: '100%',
                height: '42px',
                background: '#2b2a27',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '8px',
                color: '#f5f3ec',
                fontSize: '13.5px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#363531'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#2b2a27'; }}
            >
              {/* Microsoft 4-square logo */}
              <svg width="18" height="18" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="12" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="12" width="9" height="9" fill="#ffb900" />
              </svg>
              <span>Continue with Microsoft</span>
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
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#d97757'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#33312c'; }}
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

        {/* Clean Empty Footer (Desktop app button intentionally removed) */}
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
            alt="OmniFlow Workspace"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
};

