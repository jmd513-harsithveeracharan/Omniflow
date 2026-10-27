/**
 * frontend/src/components/voice/VoiceOrb.tsx
 * -------------------------------------------
 * ChatGPT-style interactive fluid audio orb & soundwave visualization.
 */

import React from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'muted';

interface VoiceOrbProps {
  state: VoiceState;
  onOrbClick?: () => void;
  statusText: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, onOrbClick, statusText }) => {
  return (
    <div className="voice-orb-container" onClick={onOrbClick}>
      {/* Dynamic Animated Ripple Waves */}
      <div className={`voice-orb-glow-layer state-${state}`} />
      <div className={`voice-orb-ripple ring-1 state-${state}`} />
      <div className={`voice-orb-ripple ring-2 state-${state}`} />
      <div className={`voice-orb-ripple ring-3 state-${state}`} />

      {/* Core Interactive Center Sphere */}
      <div className={`voice-orb-sphere state-${state}`}>
        <div className="voice-orb-inner-core">
          {state === 'thinking' ? (
            <div className="voice-orb-thinking-spin" />
          ) : state === 'speaking' ? (
            <div className="voice-orb-bars">
              <span className="vbar vbar-1" />
              <span className="vbar vbar-2" />
              <span className="vbar vbar-3" />
              <span className="vbar vbar-4" />
              <span className="vbar vbar-5" />
            </div>
          ) : state === 'listening' ? (
            <div className="voice-orb-mic-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
          ) : (
            <div className="voice-orb-idle-dot" />
          )}
        </div>
      </div>

      {/* Floating Status Text */}
      <div className={`voice-orb-status-label state-${state}`}>
        <span className="status-dot" />
        <span className="status-text">{statusText}</span>
      </div>
    </div>
  );
};

