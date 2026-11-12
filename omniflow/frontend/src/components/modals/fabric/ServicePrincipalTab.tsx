import React, { useState } from 'react';

interface ServicePrincipalTabProps {
  initialTenantId?: string;
  onSuccess?: () => void;
}

export const ServicePrincipalTab: React.FC<ServicePrincipalTabProps> = ({
  initialTenantId = '',
  onSuccess,
}) => {
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSaveSP = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    try {
      setIsLoggingIn(true);
      await fetch('/api/fabric/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_type: 'service_principal',
          tenant_id: tenantId,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      onSuccess?.();
    } catch (e) {
      console.error('SP error', e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <input
        type="text"
        placeholder="Tenant ID (e.g. 00000000-0000-...)"
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
      />
      <input
        type="text"
        placeholder="Client / Application ID"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
      />
      <input
        type="password"
        placeholder="Client Secret"
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
      />
      <button
        type="button"
        onClick={handleSaveSP}
        disabled={isLoggingIn}
        style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
      >
        {isLoggingIn ? 'Connecting...' : 'Save & Connect'}
      </button>
    </div>
  );
};

