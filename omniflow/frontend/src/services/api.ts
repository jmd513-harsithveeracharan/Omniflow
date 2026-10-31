/**
 * frontend/src/services/api.ts
 * Typed HTTP & SSE API client for Fabric AI Studio FastAPI backend.
 * Zero 'any' types.
 */

import {
  FabricStatus,
  ChatSession,
  TranspileResult,
  SkillSummary,
  ConnectorSummary,
  DiscoveredTable,
  IngestionPlan,
  BlastRadiusReport,
  WorkspaceFolder,
} from '../types';

const API_BASE = '/api';

export async function fetchFabricStatus(): Promise<FabricStatus> {
  const res = await fetch(`${API_BASE}/fabric/status`);
  if (!res.ok) throw new Error(`Failed to fetch Fabric status: ${res.statusText}`);
  const data = await res.json();
  return {
    authenticated: Boolean(data.authenticated),
    workspaceId: data.workspace_id || '',
    targetFolder: data.target_folder || 'AI_Test_Folder',
    workspacesCount: data.workspaces_count || 0,
    message: data.message || '',
    userIdentity: data.user_identity || '',
    authMethod: data.auth_method || '',
    tenantId: data.tenant_id || '',
    expiresInMinutes: data.expires_in_minutes || 0,
  };
}

export async function fetchSessions(userEmail?: string): Promise<ChatSession[]> {
  const url = userEmail ? `${API_BASE}/sessions?user_email=${encodeURIComponent(userEmail)}` : `${API_BASE}/sessions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  const data = await res.json();
  return (data.sessions || []).map((s: Record<string, unknown>) => ({
    sessionId: String(s.session_id || ''),
    workspaceId: String(s.workspace_id || ''),
    title: String(s.title || 'New Conversation'),
    messageCount: Number(s.message_count || 0),
    runCount: Number(s.run_count || 0),
    lastActive: String(s.last_active || ''),
  }));
}

export async function fetchSessionDetail(
  sessionId: string
): Promise<{
  sessionId: string;
  title: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    thoughtSteps?: import('../types').ThoughtStep[];
    thoughtElapsed?: string;
  }[];
}> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch session detail: ${res.statusText}`);
  const data = await res.json();
  return {
    sessionId: data.session_id,
    title: data.title || 'Conversation',
    messages: (data.messages || []).map((m: Record<string, unknown>) => ({
      role: (m.role as 'user' | 'assistant' | 'system') || 'user',
      content: String(m.content || ''),
      thoughtSteps: m.thoughtSteps as import('../types').ThoughtStep[] | undefined,
      thoughtElapsed: typeof m.thoughtElapsed === 'string' ? m.thoughtElapsed : undefined,
    })),
  };
}

export async function createNewSession(workspaceId?: string, userEmail?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId, user_email: userEmail }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  const data = await res.json();
  return data.session_id;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.statusText}`);
  const data = await res.json();
  return Boolean(data.deleted);
}

export async function renameSession(sessionId: string, newTitle: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: newTitle }),
  });
  if (!res.ok) throw new Error(`Failed to rename session: ${res.statusText}`);
  return true;
}

export async function moveSessionToProject(sessionId: string, projectId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/move_to_project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  });
  if (!res.ok) throw new Error(`Failed to move session: ${res.statusText}`);
  return true;
}

export async function transpileSql(sql: string, sourceDialect = 'tsql'): Promise<TranspileResult> {
  const res = await fetch(`${API_BASE}/transpile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, source_dialect: sourceDialect, target_dialect: 'spark' }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Transpile failed: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    status: data.status,
    sourceDialect: data.source_dialect,
    targetDialect: data.target_dialect,
    sparkSql: data.spark_sql,
    lineage: data.lineage || {},
  };
}

export async function fetchSkills(): Promise<SkillSummary[]> {
  const res = await fetch(`${API_BASE}/skills`);
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.statusText}`);
  const data = await res.json();
  return (data || []).map((s: Record<string, unknown>) => ({
    name: String(s.name || ''),
    displayName: String(s.display_name || s.name || ''),
    description: String(s.description || ''),
    tier: String(s.tier || 'atomic'),
    snippet: String(s.snippet || ''),
  }));
}

export async function fetchSkillDetail(name: string): Promise<SkillSummary> {
  try {
    const res = await fetch(`${API_BASE}/skills/${name}`);
    if (res.ok) {
      const data = await res.json();
      return {
        name: String(data.name || name),
        displayName: String(data.display_name || data.displayName || data.name || name),
        description: String(data.description || ''),
        tier: String(data.tier || 'atomic'),
        snippet: String(data.snippet || ''),
        fullRunbook: String(data.content || data.fullRunbook || ''),
      };
    }
  } catch (err) {
    console.warn(`Failed to fetch skill ${name}:`, err);
  }
  // Graceful fallback
  return {
    name,
    displayName: name.replace('fabric_', '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Operational skill runbook for ${name}`,
    tier: 'atomic',
    snippet: `# ${name}\nOperational playbook and guidance.`,
    fullRunbook: `# ${name}\n\nOperational runbook for Microsoft Fabric engineering.`,
  };
}

export async function fetchConnectors(): Promise<ConnectorSummary[]> {
  const res = await fetch(`${API_BASE}/connectors`);
  if (!res.ok) throw new Error(`Failed to fetch connectors: ${res.statusText}`);
  const data = await res.json();
  return data || [];
}

export async function testConnectorConnection(
  sourceId: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/connectors/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, params }),
  });
  if (!res.ok) throw new Error(`Connection test failed: ${res.statusText}`);
  return res.json();
}

export async function discoverConnectorTables(
  sourceId: string,
  params: Record<string, unknown>
): Promise<DiscoveredTable[]> {
  const res = await fetch(`${API_BASE}/connectors/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, params }),
  });
  if (!res.ok) throw new Error(`Table discovery failed: ${res.statusText}`);
  const data = await res.json();
  return (data.tables || []).map((t: Record<string, unknown>) => ({
    name: String(t.name || ''),
    schema: String(t.schema || 'dbo'),
    estimatedRows: Number(t.estimated_rows || 0),
    primaryKey: String(t.primary_key || 'id'),
    strategy: 'incremental',
  }));
}

export async function generateMedallionPlan(
  sourceId: string,
  selectedTables: DiscoveredTable[],
  targetLakehousePrefix = 'lh_enterprise'
): Promise<IngestionPlan> {
  const res = await fetch(`${API_BASE}/pipeline/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_id: sourceId,
      selected_tables: selectedTables,
      target_lakehouse_prefix: targetLakehousePrefix,
    }),
  });
  if (!res.ok) throw new Error(`Plan generation failed: ${res.statusText}`);
  const data = await res.json();
  return data.plan;
}

export async function deployMedallionPlan(
  plan: IngestionPlan,
  workspaceId?: string
): Promise<{ status: string; run_id: string; message: string }> {
  const res = await fetch(`${API_BASE}/pipeline/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, workspace_id: workspaceId }),
  });
  if (!res.ok) throw new Error(`Deployment failed: ${res.statusText}`);
  return res.json();
}

export async function fetchWorkspaceTree(workspaceId?: string): Promise<WorkspaceFolder[]> {
  const url = workspaceId ? `${API_BASE}/workspace/tree?workspace_id=${workspaceId}` : `${API_BASE}/workspace/tree`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch workspace tree: ${res.statusText}`);
  const data = await res.json();
  return data.folders || [];
}

export async function analyzeBlastRadius(assetId: string, targetName: string): Promise<BlastRadiusReport> {
  const res = await fetch(`${API_BASE}/governance/blast-radius`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId, target_name: targetName }),
  });
  if (!res.ok) throw new Error(`Blast radius calculation failed: ${res.statusText}`);
  return res.json();
}

export async function streamChatTurn(
  message: string,
  sessionId: string,
  onChunk: (text: string) => void,
  onDone: (plan?: IngestionPlan | Record<string, unknown> | null) => void,
  onError: (err: string) => void,
  model?: string,
  effort?: string,
  onStage?: (stage: string) => void,
  onThoughtStep?: (step: import('../types').ThoughtStep) => void,
  mode?: 'auto' | 'general' | 'project',
  isVoice?: boolean,
  signal?: AbortSignal,
  userEmail?: string,
  onCredentialRequest?: (data: import('../types').CredentialRequestData) => void
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        stream: true,
        model: model || undefined,
        effort: effort || undefined,
        mode: mode || 'auto',
        is_voice: Boolean(isVoice),
        user_email: userEmail || undefined,
      }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Stream connection failed: ${res.statusText}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === 'credential_request' && payload.connector) {
              if (onCredentialRequest) onCredentialRequest(payload.connector);
            } else if (payload.type === 'thought_step' && payload.step) {
              if (onThoughtStep) onThoughtStep(payload.step);
            } else if (payload.type === 'stage' && payload.text) {
              if (onStage) onStage(payload.text);
            } else if (payload.type === 'chunk' && payload.text) {
              onChunk(payload.text);
            } else if (payload.type === 'done') {
              onDone(payload.plan || null);
              return;
            } else if (payload.type === 'error') {
              onError(payload.error);
              return;
            }
          } catch {
            // ignore JSON parse on incomplete chunks
          }
        }
      }
    }
    onDone(null);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    onError(err instanceof Error ? err.message : String(err));
  }
}

export async function provisionAndInspectConnector(
  connectorType: string,
  params: Record<string, string>,
  testMode: boolean = true
): Promise<import('../types').ProvisionAndInspectResult> {
  const res = await fetch(`${API_BASE}/connectors/provision_and_inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connector_type: connectorType,
      params,
      test_mode: testMode,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Connector inspection failed: ${errText || res.statusText}`);
  }
  return res.json();
}

export async function fetchProjects(userEmail?: string): Promise<import('../types').ProjectRecord[]> {
  const url = userEmail ? `${API_BASE}/projects?user_email=${encodeURIComponent(userEmail)}` : `${API_BASE}/projects`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  const data = await res.json();
  return (data.projects || []).map((p: Record<string, unknown>) => ({
    id: String(p.id || ''),
    name: String(p.name || ''),
    description: String(p.description || ''),
    local_path: String(p.local_path || ''),
    is_pinned: Number(p.is_pinned || 0),
    is_archived: Number(p.is_archived || 0),
    created_at: String(p.created_at || ''),
    updated_at: String(p.updated_at || p.created_at || ''),
    created_by: String(p.created_by || ''),
    metadata: (p.metadata as Record<string, unknown>) || {},
  }));
}

export async function createProject(
  name: string,
  description = '',
  metadata?: import('../types').ProjectMetadata,
  local_path = '',
  created_by?: string
): Promise<import('../types').ProjectRecord> {
  const res = await fetch(`${API_BASE}/projects/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, local_path, created_by, metadata: metadata || {} }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
  const data = await res.json();
  return data.project;
}

export async function updateProject(
  id: string,
  updates: {
    name?: string;
    description?: string;
    local_path?: string;
    is_pinned?: number;
    is_archived?: number;
    metadata?: import('../types').ProjectMetadata;
  }
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/projects/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error(`Failed to update project: ${res.statusText}`);
  const data = await res.json();
  return Boolean(data.success);
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/projects/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
  const data = await res.json();
  return Boolean(data.success);
}

export async function fetchProjectDetail(id: string): Promise<{
  project: import('../types').ProjectRecord;
  plan: import('../types').IngestionPlan | null;
  deployed_items: Array<{ item_type: string; display_name: string; folder: string; item_id: string }>;
  messages: import('../types').ChatMessage[];
}> {
  const res = await fetch(`${API_BASE}/projects/${id}/detail`);
  if (!res.ok) throw new Error(`Failed to fetch project detail: ${res.statusText}`);
  return await res.json();
}

export async function fetchFabricWorkspaces(): Promise<{
  activeWorkspaceId: string;
  activeWorkspaceName: string;
  workspaces: import('../types').FabricWorkspaceSummary[];
}> {
  try {
    const res = await fetch(`${API_BASE}/workspace/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (data.workspaces || []).map((w: Record<string, unknown>) => ({
      id: String(w.id || ''),
      displayName: String(w.displayName || w.name || 'Workspace'),
      description: String(w.description || ''),
      type: String(w.type || 'Workspace'),
      capacityId: String(w.capacityId || ''),
      isActive: String(w.id || '') === String(data.active_workspace_id || ''),
    }));
    return {
      activeWorkspaceId: String(data.active_workspace_id || ''),
      activeWorkspaceName: String(data.active_workspace_name || 'PBT_DATA_AGENT'),
      workspaces: list,
    };
  } catch (err) {
    console.warn('Failed to fetch workspace list from Fabric API, using fallback defaults', err);
    return {
      activeWorkspaceId: 'ws_pbt_agent',
      activeWorkspaceName: 'PBT_DATA_AGENT',
      workspaces: [],
    };
  }
}

export async function fetchFabricAccounts(): Promise<import('../types').FabricAccountProfile[]> {
  const res = await fetch(`${API_BASE}/auth/accounts`);
  if (!res.ok) throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  return res.json();
}

export async function switchFabricAccount(
  accountId: string,
  tenantId?: string
): Promise<{ success: boolean; message: string; requires_login?: boolean; account?: import('../types').FabricAccountProfile }> {
  const res = await fetch(`${API_BASE}/auth/switch-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId, tenant_id: tenantId }),
  });
  if (!res.ok) throw new Error(`Failed to switch account: ${res.statusText}`);
  return res.json();
}

export async function triggerBrowserLogin(
  tenant?: string
): Promise<{ success: boolean; message: string; accounts: import('../types').FabricAccountProfile[] }> {
  const res = await fetch(`${API_BASE}/auth/login/browser`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant }),
  });
  if (!res.ok) throw new Error(`Failed to initiate browser login: ${res.statusText}`);
  return res.json();
}

export async function startDeviceCodeLogin(): Promise<import('../types').DeviceCodeInitResponse> {
  const res = await fetch(`${API_BASE}/auth/login/device-code`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to start device code flow: ${res.statusText}`);
  return res.json();
}

export async function pollDeviceCodeLogin(
  deviceCode: string
): Promise<import('../types').DeviceCodePollResponse> {
  const res = await fetch(`${API_BASE}/auth/login/device-code/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  if (!res.ok) throw new Error(`Failed to poll device code: ${res.statusText}`);
  return res.json();
}

export async function logoutFabric(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
}

// ----------------------------------------------------------------------------
// User Authentication & RBAC APIs
// ----------------------------------------------------------------------------

export async function registerUser(email: string, password: string, name: string): Promise<{ success: boolean; user: import('../types').UserProfile }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Registration failed: ${res.statusText}`);
  }
  return res.json();
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; user: import('../types').UserProfile }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Login failed: ${res.statusText}`);
  }
  return res.json();
}

export async function searchUsers(query: string = ''): Promise<import('../types').UserProfile[]> {
  try {
    const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.users || [];
  } catch (err) {
    console.warn('searchUsers failed:', err);
    return [];
  }
}

export async function fetchProjectMembers(projectId: string): Promise<import('../types').ProjectMember[]> {
  try {
    const res = await fetch(`${API_BASE}/projects/${projectId}/members`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.members || [];
  } catch (err) {
    console.warn('fetchProjectMembers failed:', err);
    return [];
  }
}

export async function addProjectMember(projectId: string, userId: string, role: string = 'contributor'): Promise<import('../types').ProjectMember> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/members/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to add member: ${res.statusText}`);
  }
  const data = await res.json();
  return data.member;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/members/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  return res.ok;
}

export async function fetchGraphMesh(): Promise<import('../types').GraphMeshResponse> {
  const res = await fetch(`${API_BASE}/graph/mesh`);
  if (!res.ok) throw new Error(`Failed to fetch graph mesh: ${res.statusText}`);
  return res.json();
}

export async function fetchNodeBlastZone(nodeId: string): Promise<import('../types').BlastZoneResponse> {
  const res = await fetch(`${API_BASE}/graph/blast-zone/${encodeURIComponent(nodeId)}`);
  if (!res.ok) throw new Error(`Failed to fetch blast zone: ${res.statusText}`);
  return res.json();
}




