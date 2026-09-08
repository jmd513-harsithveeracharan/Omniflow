import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Key,
  Bell,
  Cpu,
  Layers,
  Database,
  Puzzle,
  Clock,
  Search,
} from 'lucide-react';
import { GeneralTab } from './settings/GeneralTab';
import { ConnectorsTab } from './settings/ConnectorsTab';
import { SourceSystemsTab } from './settings/SourceSystemsTab';
import { ApiKeysTab } from './settings/ApiKeysTab';
import { MemoryTab } from './settings/MemoryTab';
import { AccountTab } from './settings/AccountTab';
import { CapabilitiesTab } from './settings/CapabilitiesTab';
import { FabricConnectionModal } from './modals/FabricConnectionModal';
import { AddCustomConnectorModal } from './modals/AddCustomConnectorModal';
import { FabricStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status?: FabricStatus | null;
  onRefreshStatus?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  status = null,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<string>('tabGeneral');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFabricModalOpen, setIsFabricModalOpen] = useState(false);
  const [isAddConnectorOpen, setIsAddConnectorOpen] = useState(false);

  if (!isOpen) return null;

  const SETTINGS_NAV = [
    { group: 'Settings', items: [
      { id: 'tabGeneral', label: 'General', icon: User },
      { id: 'tabAccount', label: 'Account', icon: Shield },
      { id: 'tabApiKeys', label: 'API Keys & Billing', icon: Key },
      { id: 'tabNotifications', label: 'Notifications', icon: Bell },
      { id: 'tabCapabilities', label: 'Capabilities', icon: Cpu },
    ]},
    { group: 'Customize', items: [
      { id: 'tabConnectors', label: 'Connectors & Tools', icon: Layers },
      { id: 'tabSourceSystems', label: 'Source Systems', icon: Database },
      { id: 'tabPlugins', label: 'Plugins & MCP', icon: Puzzle },
      { id: 'tabMemory', label: 'Memory', icon: Clock },
    ]},
  ];

  return (
    <>
      <div className="sso-modal-backdrop" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 1000, alignItems: 'center', justifyContent: 'center' }}>
        <div className="claude-settings-dialog" style={{ width: '880px', height: '600px', background: '#121215', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', overflow: 'hidden', display: 'flex', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
          {/* Left Settings Sidebar */}
          <aside className="claude-settings-sidebar" style={{ width: '240px', background: '#0d0d10', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Search width={13} height={13} style={{ color: '#71717a' }} />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ padding: '12px 8px', overflowY: 'auto', flex: 1 }}>
              {SETTINGS_NAV.map((g) => {
                const filteredItems = g.items.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
                if (filteredItems.length === 0) return null;

                return (
                  <div key={g.group} style={{ marginBottom: '16px' }}>
                    <div style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {g.group}
                    </div>
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: isActive ? '#fff' : '#a1a1aa',
                            fontSize: '12.5px',
                            fontWeight: isActive ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            marginBottom: '2px',
                          }}
                        >
                          <Icon width={15} height={15} style={{ color: isActive ? '#38bdf8' : '#71717a' }} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right Main Body Content */}
          <main className="claude-settings-body" style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', position: 'relative' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
            >
              <X width={18} height={18} />
            </button>

            {activeTab === 'tabGeneral' && <GeneralTab />}
            {activeTab === 'tabConnectors' && <ConnectorsTab onOpenFabricModal={() => setIsFabricModalOpen(true)} />}
            {activeTab === 'tabSourceSystems' && <SourceSystemsTab onAddCustomConnector={() => setIsAddConnectorOpen(true)} />}
            {activeTab === 'tabApiKeys' && <ApiKeysTab />}
            {activeTab === 'tabMemory' && <MemoryTab />}
            {activeTab === 'tabAccount' && <AccountTab />}
            {activeTab === 'tabCapabilities' && <CapabilitiesTab />}
            {(activeTab === 'tabNotifications' || activeTab === 'tabPlugins') && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5', marginBottom: '8px' }}>
                  {activeTab === 'tabNotifications' ? 'Notifications' : 'Plugins & MCP Servers'}
                </h2>
                <p style={{ fontSize: '12.5px', color: '#71717a' }}>
                  {activeTab === 'tabNotifications'
                    ? 'Manage automated email and webhook notifications for Fabric pipeline runs.'
                    : 'Configure local and remote Model Context Protocol (MCP) tool servers for dynamic agent execution.'}
                </p>
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa', fontSize: '12.5px' }}>
                  ✨ Active and operational in current workspace.
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Sub-modals */}
      <FabricConnectionModal
        isOpen={isFabricModalOpen}
        onClose={() => setIsFabricModalOpen(false)}
        status={status}
        onRefreshStatus={onRefreshStatus}
      />

      <AddCustomConnectorModal
        isOpen={isAddConnectorOpen}
        onClose={() => setIsAddConnectorOpen(false)}
      />
    </>
  );
};
