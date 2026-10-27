/**
 * frontend/src/components/voice/VoiceControls.tsx
 * ------------------------------------------------
 * Floating control actions for ChatGPT Voice Mode.
 */

import React from 'react';
import { Mic, MicOff, Square, MessageSquare, X } from 'lucide-react';
import { VoiceState } from './VoiceOrb';

interface VoiceControlsProps {
  state: VoiceState;
  isMuted: boolean;
  onToggleMute: () => void;
  onInterrupt: () => void;
  onSwitchToChat: () => void;
  onClose: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  state,
  isMuted,
  onToggleMute,
  onInterrupt,
  onSwitchToChat,
  onClose,
}) => {
  return (
    <div className="voice-controls-dock">
      {/* 1. Mute / Unmute Mic */}
      <button
        type="button"
        className={`voice-action-btn ${isMuted ? 'active-mute' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
      >
        {isMuted ? <MicOff width={18} height={18} /> : <Mic width={18} height={18} />}
        <span className="btn-label">{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* 2. Interrupt Speech (when agent is speaking) */}
      {state === 'speaking' && (
        <button
          type="button"
          className="voice-action-btn btn-interrupt"
          onClick={onInterrupt}
          title="Interrupt Tenali"
        >
          <Square width={16} height={16} fill="currentColor" />
          <span className="btn-label">Interrupt</span>
        </button>
      )}

      {/* 3. Switch to text chat */}
      <button
        type="button"
        className="voice-action-btn"
        onClick={onSwitchToChat}
        title="Open in Text Chat"
      >
        <MessageSquare width={18} height={18} />
        <span className="btn-label">Chat</span>
      </button>

      {/* 4. Exit Voice Mode */}
      <button
        type="button"
        className="voice-action-btn btn-close-voice"
        onClick={onClose}
        title="Exit Voice Mode"
      >
        <X width={18} height={18} />
        <span className="btn-label">Exit</span>
      </button>
    </div>
  );
};

