import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { FabricAccountProfile } from '../../types';

interface AccountItemRowProps {
  account: FabricAccountProfile;
  isSwitching: boolean;
  onSwitch: (account: FabricAccountProfile) => void;
}

export const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  isSwitching,
  onSwitch,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: '10px',
        background: account.is_active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
        border: account.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: account.is_active ? '#10b981' : '#3f3f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          {account.name[0] || 'U'}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#f4f4f5',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {account.name}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '4px',
                background: account.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                color: account.is_active ? '#34d399' : '#a1a1aa',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {account.account_type}
            </span>
          </div>
          <div
            style={{
              fontSize: '11.5px',
              color: '#71717a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {account.email}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, marginLeft: '12px' }}>
        {account.is_active ? (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Check width={13} height={13} /> Active
          </span>
        ) : (
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => onSwitch(account)}
            className="projects-modal-btn-cancel"
            style={{ padding: '5px 12px', fontSize: '12px' }}
          >
            {isSwitching ? <Loader2 width={12} height={12} className="spin" /> : 'Switch'}
          </button>
        )}
      </div>
    </div>
  );
};

