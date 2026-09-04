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
