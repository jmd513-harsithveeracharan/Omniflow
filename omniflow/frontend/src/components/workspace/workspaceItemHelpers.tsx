import {
  Database,
  Layers,
  FileCode,
  Workflow,
  BarChart3,
  Boxes,
  LayoutDashboard,
  Terminal,
  Zap,
  Cloud,
  BookOpen,
  Bot,
  FileText,
  LucideIcon,
} from 'lucide-react';

interface ItemVisualConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

const ITEM_CONFIGS: Record<string, ItemVisualConfig> = {
  lakehouse: {
    icon: Database,
    color: '#00d2a0',
    bg: 'rgba(0, 210, 160, 0.12)',
    border: 'rgba(0, 210, 160, 0.25)',
  },
  warehouse: {
    icon: Layers,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.25)',
  },
  notebook: {
    icon: FileCode,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  datapipeline: {
    icon: Workflow,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.25)',
  },
  pipeline: {
    icon: Workflow,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.25)',
  },
  report: {
    icon: BarChart3,
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.25)',
  },
  semanticmodel: {
    icon: Boxes,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.25)',
  },
  dashboard: {
    icon: LayoutDashboard,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.25)',
  },
  sqlendpoint: {
    icon: Terminal,
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.25)',
  },
  reflex: {
    icon: Zap,
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  environment: {
    icon: Cloud,
    color: '#14b8a6',
    bg: 'rgba(20, 184, 166, 0.12)',
    border: 'rgba(20, 184, 166, 0.25)',
  },
  variablelibrary: {
    icon: BookOpen,
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
  },
  dataagent: {
    icon: Bot,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.25)',
  },
};

const DEFAULT_CONFIG: ItemVisualConfig = {
  icon: FileText,
  color: '#a1a1aa',
  bg: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.12)',
};

export const getItemIcon = (type: string) => {
  const key = (type || '').toLowerCase().replace(/[^a-z]/g, '');
  const config =
    ITEM_CONFIGS[key] ||
    Object.entries(ITEM_CONFIGS).find(([k]) => key.includes(k))?.[1] ||
    DEFAULT_CONFIG;

  const IconComp = config.icon;
  return (
    <div
      className="ws-item-icon-box"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: config.color,
      }}
    >
      <IconComp width={15} height={15} />
    </div>
  );
};

export const getBadgeClass = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('lakehouse')) return 'badge-lakehouse';
  if (t.includes('warehouse')) return 'badge-warehouse';
  if (t.includes('notebook')) return 'badge-notebook';
  if (t.includes('pipeline')) return 'badge-pipeline';
  if (t.includes('report')) return 'badge-report';
  if (t.includes('semantic') || t.includes('dataset')) return 'badge-semantic';
  if (t.includes('dashboard')) return 'badge-dashboard';
  if (t.includes('sql')) return 'badge-sql';
  if (t.includes('reflex') || t.includes('activator')) return 'badge-reflex';
  if (t.includes('environment')) return 'badge-environment';
  if (t.includes('variable')) return 'badge-variables';
  if (t.includes('agent')) return 'badge-agent';
  return 'badge-generic';
};
