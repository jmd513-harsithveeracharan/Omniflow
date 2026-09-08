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
  };
}

export async function fetchSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE}/sessions`);
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
): Promise<{ sessionId: string; title: string; messages: { role: 'user' | 'assistant' | 'system'; content: string }[] }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Failed to fetch session detail: ${res.statusText}`);
  const data = await res.json();
  return {
    sessionId: data.session_id,
    title: data.title || 'Conversation',
    messages: (data.messages || []).map((m: Record<string, unknown>) => ({
      role: (m.role as 'user' | 'assistant' | 'system') || 'user',
      content: String(m.content || ''),
    })),
  };
}

export async function createNewSession(workspaceId?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
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

export async function transpileSql(sql: string, sourceDialect = 'tsql'): Promise<TranspileResult> {
  const res = await fetch(`${API_BASE}/transpile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, source_dialect: sourceDialect, target_dialect: 'spark' }),
  });
  if (!res.ok) throw new Error(`Transpile failed: ${res.statusText}`);
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
  const res = await fetch(`${API_BASE}/skills/${name}`);
  if (!res.ok) throw new Error(`Failed to fetch skill ${name}: ${res.statusText}`);
  const data = await res.json();
  return {
    name: String(data.name || name),
    displayName: String(data.display_name || data.name || name),
    description: String(data.description || ''),
    tier: String(data.tier || 'atomic'),
    snippet: String(data.snippet || ''),
    fullRunbook: String(data.content || data.fullRunbook || ''),
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
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId, stream: true }),
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
            if (payload.type === 'chunk' && payload.text) {
              onChunk(payload.text);
            } else if (payload.type === 'done') {
              onDone();
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
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }
}

export async function fetchProjects(): Promise<import('../types').ProjectRecord[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  const data = await res.json();
  return (data.projects || []).map((p: Record<string, unknown>) => ({
    id: String(p.id || ''),
    name: String(p.name || ''),
    description: String(p.description || ''),
    is_pinned: Number(p.is_pinned || 0),
    is_archived: Number(p.is_archived || 0),
    created_at: String(p.created_at || ''),
    updated_at: String(p.updated_at || p.created_at || ''),
    metadata: (p.metadata as Record<string, unknown>) || {},
  }));
}

export async function createProject(name: string, description = ''): Promise<import('../types').ProjectRecord> {
  const res = await fetch(`${API_BASE}/projects/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
  const data = await res.json();
  return data.project;
}

export async function updateProject(
  id: string,
  updates: { name?: string; description?: string; is_pinned?: number; is_archived?: number }
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

