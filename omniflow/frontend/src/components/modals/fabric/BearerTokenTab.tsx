import React, { useState } from 'react';

interface BearerTokenTabProps {
  onSuccess?: () => void;
}

export const BearerTokenTab: React.FC<BearerTokenTabProps> = ({ onSuccess }) => {
  const [bearerToken, setBearerToken] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleApplyToken = async () => {
    if (!bearerToken.trim()) return;
    try {
      setIsLoggingIn(true);
      await fetch('/api/fabric/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_type: 'bearer_token',
          token: bearerToken.trim(),
        }),
      });
      onSuccess?.();
    } catch (e) {
      console.error('Token error', e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <input
        type="password"
        placeholder="Paste Bearer Token (JWT)..."
        value={bearerToken}
        onChange={(e) => setBearerToken(e.target.value)}
        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
      />
      <button
        type="button"
        onClick={handleApplyToken}
        disabled={isLoggingIn}
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
      >
        {isLoggingIn ? 'Applying...' : 'Apply'}
      </button>
    </div>
  );
};

