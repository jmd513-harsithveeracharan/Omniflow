/**
 * frontend/src/components/voice/FloatingVoiceOrb.tsx
 * ----------------------------------------------------
 * ChatGPT-style inline sky-and-cloud fluid orb positioned directly above
 * the bottom input dock in normal flex layout (never overlaps the input bar).
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
    if (state === 'muted' && onClick) {
      onClick();
    } else if (onInterrupt) {
      onInterrupt();
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="chatgpt-floating-orb-wrapper" onClick={handleClick}>
      <div
        className={`floating-orb-sphere state-${state}`}
        title={
          state === 'speaking'
            ? 'Tenali is speaking — speak or click to interrupt'
            : state === 'thinking'
            ? 'Tenali is thinking...'
            : state === 'muted'
            ? 'Microphone muted — click to unmute'
            : transcript && transcript.trim().length > 0
            ? 'Listening... (Click orb to send immediately)'
            : 'Listening... (Speak anytime)'
        }
      >
        <div className="orb-cloud-base" />
        <div className="orb-cloud-wisp orb-cloud-1" />
        <div className="orb-cloud-wisp orb-cloud-2" />
        <div className="orb-cloud-wisp orb-cloud-3" />
      </div>
    </div>
  );
};
