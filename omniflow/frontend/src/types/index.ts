/**
 * frontend/src/types/index.ts
 * Strict TypeScript interfaces matching backend Pydantic v2 domain models.
 * Zero 'any' types allowed.
 */

export type RoleType = 'user' | 'assistant' | 'system' | 'tool';

export interface FabricAccountProfile {
  id: string;
  name: string;
  email: string;
  tenant_id: string;
  tenant_name?: string;
  subscription_id?: string;
  is_active: boolean;
  account_type: string;
  default_workspace_id?: string;
  default_workspace_name?: string;
}

export interface DeviceCodeInitResponse {
  success: boolean;
  user_code?: string;
  device_code?: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message?: string;
  error?: string;
}

export interface DeviceCodePollResponse {
  success: boolean;
  status: 'pending' | 'authenticated' | 'declined' | 'expired' | 'error';
  error?: string;
  user_identity?: string;
  tenant_id?: string;
}

export interface ThoughtStep {
  title: string;
  detail?: string;
  action?: string;
  badge?: string;
  target?: string;
  diff?: string;
  output?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  timestamp?: string;
}

export interface ThoughtMeta {
  elapsed?: string;
  steps: ThoughtStep[];
}

export interface ChatMessage {
  id?: number;
  role: RoleType;
  content: string;
  tokenEst?: number;
  createdAt?: string;
  isStreaming?: boolean;
  thoughtSteps?: ThoughtStep[];
  thoughtElapsed?: string;
}

export interface ChatSession {
  sessionId: string;
  projectId?: string;
  workspaceId: string;
  workspaceName?: string;
  workspace_name?: string;
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
  workspaceName?: string;
  workspace_name?: string;
  targetFolder: string;
  workspacesCount: number;
  message: string;
  userIdentity?: string;
  authMethod?: string;
  tenantId?: string;
  tenantName?: string;
  accountName?: string;
  accountType?: string;
  expiresInMinutes?: number;
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
  root_folder?: string;
  project_code?: string;
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

export interface FabricWorkspaceSummary {
  id: string;
  displayName: string;
  description?: string;
  type?: string;
  capacityId?: string;
  isActive?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_color: string;
  created_at?: string;
}

export interface ProjectMember {
  id: string;
  project_id?: string;
  user_id?: string;
  name: string;
  email: string;
  role?: 'owner' | 'contributor' | 'viewer' | string;
  avatar?: string;
  avatar_color?: string;
  avatarBg?: string;
  joined_at?: string;
}

export interface ProjectContextFile {
  id: string;
  name: string;
  type: 'json' | 'sql' | 'markdown' | 'pdf' | 'doc' | string;
  size: number;
  content?: string;
  is_intake_spec?: boolean;
  template_filename?: string;
  uploaded_at: string;
}

export interface IntakeTemplate {
  filename: string;
  project_name: string;
  project_code: string;
  domain: string;
  data: Record<string, unknown>;
}

export interface ProjectMetadata {
  fabricFolder?: string;
  localPath?: string;
  badge?: string;
  members?: ProjectMember[];
  targetWorkspace?: string;
  workspaces?: string[];
  sharedContext?: boolean;
  instructions?: string;
  context_files?: ProjectContextFile[];
  intake_filename?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  local_path?: string;
  is_pinned?: number;
  is_archived?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  metadata?: ProjectMetadata;
  itemsCount?: number;
  badge?: string;
}

export interface InterceptionParamField {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  default?: string;
  options?: string[];
  required?: boolean;
}

export interface CredentialRequestData {
  connector_type: string;
  name: string;
  category: string;
  description: string;
  is_fabric_native?: boolean;
  pathway?: 'native_pipeline' | 'pyspark_notebook';
  pathway_explanation?: string;
  default_gateway?: string | null;
  required_params: InterceptionParamField[];
  sample_presets: Record<string, string>;
}

export interface DiscoveredSourceTable {
  name: string;
  schema: string;
  description?: string;
  est_rows?: number;
  pk?: string[];
  watermark?: string;
}

export interface ProvisionAndInspectResult {
  status: string;
  connection_id: string;
  connector_type: string;
  connector_name: string;
  category: string;
  is_fabric_native?: boolean;
  pathway?: 'native_pipeline' | 'pyspark_notebook';
  pathway_explanation?: string;
  gateway?: string;
  discovered_tables: DiscoveredSourceTable[];
  python_inspector_code: string;
  message: string;
}

export interface GraphMeshNode {
  id: string;
  label: string;
  type: 'source' | 'lakehouse' | 'warehouse' | 'table' | 'column' | 'notebook' | 'pipeline' | 'metric';
  layer: 'source' | 'bronze' | 'silver' | 'gold' | 'warehouse' | 'bi' | 'shared';
  parent_id?: string | null;
  data_type?: string | null;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  radius: number;
  degree: number;
  description?: string | null;
}

export interface GraphMeshEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'FEEDS' | 'CONTAINS' | 'TRANSFORMS_TO' | 'JOINS_WITH' | 'AGGREGATES' | 'DEPENDS_ON';
  description?: string | null;
  is_cross_layer?: boolean;
}

export interface GraphMeshResponse {
  nodes: GraphMeshNode[];
  edges: GraphMeshEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    tables_count: number;
    columns_count: number;
    notebooks_count: number;
    metrics_count: number;
  };
  layers: string[];
}

export interface BlastZoneResponse {
  target_node_id: string;
  impact_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  upstream_nodes: string[];
  downstream_nodes: string[];
  affected_tables: string[];
  affected_notebooks: string[];
  explanation: string;
}




