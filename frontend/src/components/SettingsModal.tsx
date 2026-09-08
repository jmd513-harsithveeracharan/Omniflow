import React, { useState } from 'react';
import {
  User,
  Shield,
  Key,
  Bell,
  Cpu,
  Layers,
  Database,
  Puzzle,
  Clock,
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
  initialTab?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  status = null,
  onRefreshStatus,
  initialTab = 'tabConnectors',
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFabricModalOpen, setIsFabricModalOpen] = useState(false);
  const [isAddConnectorOpen, setIsAddConnectorOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const SETTINGS_NAV = [
    {
      group: 'Settings',
      items: [
        { id: 'tabGeneral', label: 'General', icon: User },
        { id: 'tabAccount', label: 'Account', icon: Shield },
        { id: 'tabApiKeys', label: 'API Keys & Billing', icon: Key },
        { id: 'tabNotifications', label: 'Notifications', icon: Bell },
        { id: 'tabCapabilities', label: 'Capabilities', icon: Cpu },
      ],
    },
    {
      group: 'Customize',
      items: [
        { id: 'tabConnectors', label: 'Connectors & Tools', icon: Layers },
        { id: 'tabSourceSystems', label: 'Source Systems', icon: Database },
        { id: 'tabPlugins', label: 'Plugins', icon: Puzzle },
        { id: 'tabMemory', label: 'Memory', icon: Clock },
      ],
    },
  ];

  return (
    <>
      <div className="sso-modal-backdrop" id="modalClaudeSettings" style={{ display: 'flex' }} onClick={onClose}>
        <div className="claude-settings-dialog" onClick={(e) => e.stopPropagation()}>
          {/* LEFT SIDEBAR */}
          <aside className="claude-settings-sidebar">
            <div className="claude-settings-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                id="settingsSearchInput"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="claude-settings-nav">
              {SETTINGS_NAV.map((g) => {
                const filteredItems = g.items.filter((item) =>
                  item.label.toLowerCase().includes(searchQuery.toLowerCase())
                );
                if (filteredItems.length === 0) return null;

                return (
                  <React.Fragment key={g.group}>
                    <div className="settings-nav-group-label">{g.group}</div>
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`claude-settings-nav-item ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveTab(item.id)}
                        >
                          <Icon width={16} height={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </aside>

          {/* RIGHT CONTENT PANEL */}
          <main className="claude-settings-body">
            {activeTab === 'tabGeneral' && <GeneralTab onClose={onClose} />}
            {activeTab === 'tabConnectors' && (
              <ConnectorsTab
                onClose={onClose}
                onOpenFabricModal={() => setIsFabricModalOpen(true)}
              />
            )}
            {activeTab === 'tabSourceSystems' && (
              <SourceSystemsTab
                onClose={onClose}
                onAddCustomConnector={() => setIsAddConnectorOpen(true)}
              />
            )}
            {activeTab === 'tabApiKeys' && <ApiKeysTab onClose={onClose} />}
            {activeTab === 'tabMemory' && <MemoryTab onClose={onClose} />}
            {activeTab === 'tabAccount' && <AccountTab onClose={onClose} />}
            {activeTab === 'tabCapabilities' && <CapabilitiesTab onClose={onClose} />}
            {activeTab === 'tabNotifications' && <CapabilitiesTab onClose={onClose} />}
            {activeTab === 'tabPlugins' && (
              <ConnectorsTab
                onClose={onClose}
                onOpenFabricModal={() => setIsFabricModalOpen(true)}
              />
            )}
          </main>
        </div>
      </div>

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

export default SettingsModal;
