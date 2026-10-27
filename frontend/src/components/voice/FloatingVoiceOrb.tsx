/**
 * frontend/src/components/voice/FloatingVoiceOrb.tsx
 * ----------------------------------------------------
 * ChatGPT-style floating interactive voice orb that hovers directly
 * above the chat input bar. Exactly matches the ChatGPT web voice mode UI.
 */

import React from 'react';

export type VoiceModeState = 'listening' | 'thinking' | 'speaking' | 'muted';

interface FloatingVoiceOrbProps {
  state: VoiceModeState;
  transcript?: string;
  onClick?: () => void;
  onInterrupt?: () => void;
}

export const FloatingVoiceOrb: React.FC<FloatingVoiceOrbProps> = ({
  state,
  transcript,
  onClick,
  onInterrupt,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'speaking' && onInterrupt) {
      onInterrupt();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="chatgpt-floating-orb-wrapper" onClick={handleClick}>
      {/* Live transcript pill hovering just above the orb */}
      {transcript && transcript.trim().length > 0 && (
        <div className="floating-orb-transcript-pill">
          <span>{transcript}</span>
        </div>
      )}

      {/* Outer ambient glow ring */}
      <div className={`floating-orb-glow state-${state}`} />

      {/* The 3D Fluid Gradient Sphere (matching ChatGPT screenshot) */}
      <div
        className={`floating-orb-sphere state-${state}`}
        title={
          state === 'speaking'
            ? 'Tenali is speaking (Click or speak to interrupt)'
            : state === 'thinking'
            ? 'Tenali is thinking...'
            : state === 'muted'
            ? 'Microphone muted (Click to unmute)'
            : 'Listening... (Speak anytime)'
        }
      >
        <div className="floating-orb-highlight" />
        {state === 'thinking' && <div className="floating-orb-spinner" />}
      </div>
    </div>
  );
};
