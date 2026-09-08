/**
 * frontend/src/types/index.ts
 * Strict TypeScript interfaces matching backend Pydantic v2 domain models.
 * Zero 'any' types allowed.
 */

export type RoleType = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id?: number;
  role: RoleType;
  content: string;
  tokenEst?: number;
  createdAt?: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  sessionId: string;
  workspaceId: string;
  title: string;
  messageCount: number;
  runCount: number;
  lastActive: string;
}

export type MedallionLayer = 'source' | 'bronze' | 'silver' | 'gold' | 'semantic' | 'report';
export type AssetType = 'table' | 'lakehouse' | 'notebook' | 'pipeline' | 'semantic_model' | 'power_bi_report';

export interface SchemaColumn {
  name: string;
  type: string;
  isPk?: boolean;
}

export interface LineageNodeData {
  id: string;
  name: string;
  assetType: AssetType;
  layer: MedallionLayer;
  schemaDefinition: SchemaColumn[];
  workspaceId?: string;
}

export interface BlastRadiusReport {
  targetAssetId: string;
  targetName: string;
  isDestructive: boolean;
  affectedNodes: LineageNodeData[];
  affectedPipelines: string[];
  affectedReports: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warningMessage: string;
}

export interface TranspileResult {
  status: string;
  sourceDialect: string;
  targetDialect: string;
  sparkSql: string;
  lineage: Record<string, unknown>;
}

export interface FabricStatus {
  authenticated: boolean;
  workspaceId: string;
  targetFolder: string;
  workspacesCount: number;
  message: string;
}

export interface SkillSummary {
  name: string;
  displayName: string;
  description: string;
  tier: string;
  snippet?: string;
  tags?: string[];
  triggers?: string[];
  fullRunbook?: string;
}

export interface ConnectorField {
  name: string;
  label: string;
  type: 'string' | 'password' | 'number' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
}

export interface ConnectorSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: ConnectorField[];
}

export interface DiscoveredTable {
  name: string;
  schema: string;
  estimatedRows?: number;
  selected?: boolean;
  primaryKey?: string;
  strategy?: 'full' | 'incremental' | 'scd2';
}

export interface IngestionPlanItem {
  name: string;
  layer: MedallionLayer;
  type: AssetType;
  sourceTable: string;
  targetTable: string;
  strategy: string;
}

export interface IngestionPlan {
  sourceId: string;
  sourceName: string;
  database: string;
  schedule: string;
  items: IngestionPlanItem[];
  notebooks: string[];
  lakehouses: string[];
}

export type ThinkingStepStatus = 'pending' | 'running' | 'completed' | 'warning' | 'error';

export interface ThinkingStep {
  id: string;
  title: string;
  description: string;
  status: ThinkingStepStatus;
  latencyMs?: number;
  details?: string;
  badge?: string;
}

export interface WorkspaceItem {
  id: string;
  displayName: string;
  type: string;
  description?: string;
  folderId?: string;
}

export interface WorkspaceFolder {
  id: string;
  displayName: string;
  items: WorkspaceItem[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  is_pinned?: number;
  is_archived?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  itemsCount?: number;
  badge?: string;
}

