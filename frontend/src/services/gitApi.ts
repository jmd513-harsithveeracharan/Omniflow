/**
 * frontend/src/services/gitApi.ts
 * --------------------------------
 * Typed API client for Git, GitHub REST API, and Azure DevOps Board integrations.
 */

const API_BASE = '/api/git';

export interface GitStatusData {
  is_git_repo: boolean;
  branch: string;
  commit_count: number;
  last_commit_hash: string;
  last_commit_message: string;
  last_commit_date: string;
  uncommitted_files: string[];
  remote_origin: string;
}

export async function fetchGitStatus(localPath: string): Promise<GitStatusData> {
  const url = `${API_BASE}/status?local_path=${encodeURIComponent(localPath)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Git status: ${res.statusText}`);
  return res.json();
}

export async function initGitRepo(projectId: string, localPath: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, local_path: localPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to initialize Git repository');
  }
  return res.json();
}

export async function commitGitChanges(
  projectId: string,
  localPath: string,
  message: string
): Promise<{ success: boolean; message: string; output?: string }> {
  const res = await fetch(`${API_BASE}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, local_path: localPath, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to commit changes');
  }
  return res.json();
}

export async function createGitHubRepo(
  projectId: string,
  localPath: string,
  token: string,
  repoName: string,
  isPrivate: boolean = true,
  orgName?: string
): Promise<{ success: boolean; repo_url: string; clone_url: string; message: string }> {
  const res = await fetch(`${API_BASE}/github/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      local_path: localPath,
      token,
      repo_name: repoName,
      is_private: isPrivate,
      org_name: orgName || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create GitHub repository');
  }
  return res.json();
}

export async function createAdoWorkItem(
  projectId: string,
  organization: string,
  projectName: string,
  patToken: string,
  title: string,
  description: string,
  workItemType: string = 'Task',
  localPath?: string
): Promise<{ success: boolean; work_item_id: number; work_item_url: string; title: string; type: string; message: string }> {
  const res = await fetch(`${API_BASE}/azure-devops/workitem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      local_path: localPath || undefined,
      organization,
      project_name: projectName,
      pat_token: patToken,
      title,
      description,
      work_item_type: workItemType,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create Azure DevOps work item');
  }
  return res.json();
}

