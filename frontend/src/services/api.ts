/**
 * frontend/src/services/api.ts
 * Typed HTTP & SSE API client for Fabric AI Studio FastAPI backend.
 */

import { FabricStatus, ChatSession, TranspileResult } from '../types';

const API_BASE = '/api';

export async function fetchFabricStatus(): Promise<FabricStatus> {
  const res = await fetch(`${API_BASE}/fabric/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Fabric status: ${res.statusText}`);
  }
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
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  }
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

export async function createNewSession(workspaceId?: string): Promise<string> {
  const res = await fetch(`${API_BASE}/sessions/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_id: workspaceId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create session: ${res.statusText}`);
  }
  const data = await res.json();
  return data.session_id;
}

export async function transpileSql(sql: string, sourceDialect = 'tsql'): Promise<TranspileResult> {
  const res = await fetch(`${API_BASE}/transpile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, source_dialect: sourceDialect, target_dialect: 'spark' }),
  });
  if (!res.ok) {
    throw new Error(`Transpile failed: ${res.statusText}`);
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

    if (!res.ok || !res.body) {
      throw new Error(`Stream connection failed: ${res.statusText}`);
    }

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
            // Ignore parse errors on incomplete chunks
          }
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
  }
}
