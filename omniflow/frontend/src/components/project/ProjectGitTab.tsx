/**
 * frontend/src/components/project/ProjectGitTab.tsx
 * --------------------------------------------------
 * Enterprise Git, GitHub, and Azure DevOps integration tab for ProjectEditModal.
 * Features:
 * - Local repository inspection, initialization, and atomic commits.
 * - One-click GitHub remote repository creation and push with PAT.
 * - Azure DevOps Board Work Item creation and linking.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trello,
} from 'lucide-react';
import { ProjectRecord } from '../../types';
import {
  fetchGitStatus,
  initGitRepo,
  commitGitChanges,
  createGitHubRepo,
  createAdoWorkItem,
  GitStatusData,
} from '../../services/gitApi';

interface ProjectGitTabProps {
  project: ProjectRecord;
  localPath: string;
}

export const ProjectGitTab: React.FC<ProjectGitTabProps> = ({ project, localPath }) => {
  const [status, setStatus] = useState<GitStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Commit state
  const [commitMessage, setCommitMessage] = useState('');

  // GitHub state
  const [githubToken, setGithubToken] = useState('');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubPrivate, setGithubPrivate] = useState(true);
  const [githubCreatedUrl, setGithubCreatedUrl] = useState<string | null>(null);

  // Azure DevOps state
  const [adoOrg, setAdoOrg] = useState('');
  const [adoProject, setAdoProject] = useState('');
  const [adoToken, setAdoToken] = useState('');
  const [adoTitle, setAdoTitle] = useState('');
  const [adoType, setAdoType] = useState('Task');
  const [adoCreatedUrl, setAdoCreatedUrl] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!localPath) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetchGitStatus(localPath);
      setStatus(res);
      if (res.remote_origin && res.remote_origin.includes('github.com')) {
        const clean = res.remote_origin.replace(/https:\/\/[^@]+@/, 'https://').replace(/\.git$/, '');
        setGithubCreatedUrl(clean);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to query Git status');
    } finally {
      setLoading(false);
    }
  }, [localPath]);

  useEffect(() => {
    loadStatus();
    // Default repo name based on project name
    const sanitized = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setGithubRepoName(`fabric-${sanitized}`);
    setAdoTitle(`Deploy Medallion flow for ${project.name}`);
  }, [project, loadStatus]);

  const handleInit = async () => {
    try {
      setActionLoading('init');
      setError(null);
      await initGitRepo(project.id, localPath);
      setSuccessMsg('Initialized Git repository with .gitignore and README.md');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize Git repository');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      setActionLoading('commit');
      setError(null);
      const res = await commitGitChanges(project.id, localPath, commitMessage.trim());
      setSuccessMsg(res.message);
      setCommitMessage('');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to commit changes');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim() || !githubRepoName.trim()) {
      setError('GitHub PAT token and repository name are required');
      return;
    }
    try {
      setActionLoading('github');
      setError(null);
      const res = await createGitHubRepo(
        project.id,
        localPath,
        githubToken.trim(),
        githubRepoName.trim(),
        githubPrivate
      );
      setGithubCreatedUrl(res.repo_url);
      setSuccessMsg('Successfully created GitHub repository and pushed main branch!');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GitHub creation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAdoWorkItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adoOrg.trim() || !adoProject.trim() || !adoToken.trim() || !adoTitle.trim()) {
      setError('Azure DevOps organization, project, PAT token, and title are required');
      return;
    }
    try {
      setActionLoading('ado');
      setError(null);
      const res = await createAdoWorkItem(
        project.id,
        adoOrg.trim(),
        adoProject.trim(),
        adoToken.trim(),
        adoTitle.trim(),
        project.description || '',
        adoType,
        localPath
      );
      setAdoCreatedUrl(res.work_item_url);
      setSuccessMsg(`Created Azure DevOps ${res.type} #${res.work_item_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Azure DevOps work item creation failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Alert Notices */}
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle width={16} height={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#6ee7b7', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 width={16} height={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Local Git Repository Card */}
      <div style={{ background: '#1e1f23', border: '1px solid #333538', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 width={16} height={16} color="#10b981" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>Local Git Repository</span>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            style={{ background: 'transparent', border: 'none', color: '#8e918f', cursor: 'pointer', padding: '2px' }}
            title="Refresh Git status"
          >
            <RefreshCw width={14} height={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#8e918f', fontSize: '13px' }}>
            <Loader2 width={16} height={16} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
            Checking local repository...
          </div>
        ) : !status?.is_git_repo ? (
          <div style={{ textAlign: 'center', padding: '12px 6px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#a1a1aa' }}>
              No Git repository detected in this project folder.
            </p>
            <button
              type="button"
              onClick={handleInit}
              disabled={actionLoading === 'init'}
              style={{
                background: '#10b981',
                color: '#09090b',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {actionLoading === 'init' ? <Loader2 width={14} height={14} className="animate-spin" /> : <Plus width={14} height={14} />}
              Initialize Git Repository
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#d4d4d8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8e918f' }}>Current Branch:</span>
              <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <GitBranch width={12} height={12} /> {status.branch}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8e918f' }}>Total Commits:</span>
              <span>{status.commit_count}</span>
            </div>
            {status.last_commit_hash && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                <span style={{ color: '#8e918f' }}>Last Commit:</span>
                <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status.last_commit_message}>
                  <code>{status.last_commit_hash}</code> {status.last_commit_message}
                </span>
              </div>
            )}

            {/* Quick Commit Input */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message (e.g. feat: add silver delta merge)"
                style={{
                  flex: 1,
                  background: '#131416',
                  border: '1px solid #333538',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <button
                type="button"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || actionLoading === 'commit'}
                style={{
                  background: '#2b2d30',
                  color: '#fff',
                  border: '1px solid #444746',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: commitMessage.trim() ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {actionLoading === 'commit' ? <Loader2 width={12} height={12} className="animate-spin" /> : <GitCommit width={12} height={12} />}
                Commit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. GitHub Remote Repository Integration */}
      <div style={{ background: '#1e1f23', border: '1px solid #333538', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>GitHub Cloud Repository</span>
          </div>
          {githubCreatedUrl && (
            <a
              href={githubCreatedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '12px', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              Open Repo <ExternalLink width={12} height={12} />
            </a>
          )}
        </div>

        <form onSubmit={handleCreateGitHub} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>
              Personal Access Token (PAT with 'repo' scope)
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>
                Repository Name
              </label>
              <input
                type="text"
                value={githubRepoName}
                onChange={(e) => setGithubRepoName(e.target.value)}
                placeholder="fabric-medallion-project"
                style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ fontSize: '12px', color: '#d4d4d8', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', paddingBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={githubPrivate}
                  onChange={(e) => setGithubPrivate(e.target.checked)}
                />
                Private Repo
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading === 'github' || !githubToken.trim()}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: githubToken.trim() ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            {actionLoading === 'github' ? <Loader2 width={13} height={13} className="animate-spin" /> : <ExternalLink width={13} height={13} />}
            Create GitHub Repo & Push Code
          </button>
        </form>
      </div>

      {/* 3. Azure DevOps Board Work Item Integration */}
      <div style={{ background: '#1e1f23', border: '1px solid #333538', borderRadius: '10px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trello width={16} height={16} color="#0284c7" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7' }}>Azure DevOps Board</span>
          </div>
          {adoCreatedUrl && (
            <a
              href={adoCreatedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '12px', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              View Work Item <ExternalLink width={12} height={12} />
            </a>
          )}
        </div>

        <form onSubmit={handleCreateAdoWorkItem} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>Organization</label>
              <input
                type="text"
                value={adoOrg}
                onChange={(e) => setAdoOrg(e.target.value)}
                placeholder="e.g. my-org"
                style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>Project Name</label>
              <input
                type="text"
                value={adoProject}
                onChange={(e) => setAdoProject(e.target.value)}
                placeholder="e.g. DataPlatform"
                style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>Azure DevOps PAT Token</label>
            <input
              type="password"
              value={adoToken}
              onChange={(e) => setAdoToken(e.target.value)}
              placeholder="ADO Personal Access Token..."
              style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>Work Item Title</label>
              <input
                type="text"
                value={adoTitle}
                onChange={(e) => setAdoTitle(e.target.value)}
                placeholder="Title..."
                style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#8e918f', marginBottom: '3px' }}>Type</label>
              <select
                value={adoType}
                onChange={(e) => setAdoType(e.target.value)}
                style={{ width: '100%', background: '#131416', border: '1px solid #333538', borderRadius: '6px', padding: '5px 8px', color: '#fff', fontSize: '12px' }}
              >
                <option value="Task">Task</option>
                <option value="User Story">User Story</option>
                <option value="Feature">Feature</option>
                <option value="Bug">Bug</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading === 'ado' || !adoToken.trim() || !adoOrg.trim() || !adoProject.trim()}
            style={{
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: adoToken.trim() ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            {actionLoading === 'ado' ? <Loader2 width={13} height={13} className="animate-spin" /> : <Trello width={13} height={13} />}
            Create Work Item on ADO Board
          </button>
        </form>
      </div>
    </div>
  );
};

