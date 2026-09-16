"""
app/domain/storage/postgres_schema.py
-------------------------------------
Enterprise PostgreSQL + pgvector Schema Definitions, DDL, and Indexes.
Optimized for high-concurrency ACID transactions, JSONB indexing, and HNSW vector search.
Fully generalized for multi-tier data architectures, multi-tenant workspaces,
and automated multi-agent telemetry.
"""

PG_SCHEMA_DDL = """
-- 1. Enable pgvector extension for vector embeddings & similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Workspaces (Central Multi-Tenant Anchor: Dev / Staging / Prod)
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity_id TEXT,
    environment TEXT NOT NULL DEFAULT 'dev',
    description TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workspaces_env ON workspaces(environment);

-- 3. Team Members (Users & Enterprise Roles)
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'data_engineer',
    entra_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- 4. Projects (Data Products, Blueprints & Workstreams)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    created_by TEXT REFERENCES team_members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_pinned INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- 5. Sessions / Conversations (Interactive multi-turn AI chat threads)
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active DESC);

-- 6. Messages (Sequential turn-by-turn conversation history & thoughts)
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    thought_trace TEXT,
    token_est INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 7. Tool Executions (Fine-grained Agent Actions, Transpiler Audits & Human Gates)
CREATE TABLE IF NOT EXISTS tool_executions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'executed',
    duration_ms DOUBLE PRECISION DEFAULT 0.0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_name);

-- 8. Learned Facts (Context memory, user preferences, and tenant ADRs)
CREATE TABLE IF NOT EXISTS learned_facts (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    fact_key TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, fact_key)
);
CREATE INDEX IF NOT EXISTS idx_learned_facts_session ON learned_facts(session_id);

-- 9. Runs / Execution Runs (Fabric Deployment State Machine & Self-Healing Engine)
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    source_id TEXT,
    source_name TEXT,
    database_name TEXT,
    plan_json JSONB DEFAULT '{}'::jsonb,
    steps_json JSONB DEFAULT '[]'::jsonb,
    pipeline_item_id TEXT,
    pipeline_job_id TEXT,
    pipeline_status TEXT,
    failure_reason TEXT,
    self_heal_needed INTEGER DEFAULT 0,
    error_context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_plan_json ON runs USING gin(plan_json);

-- 10. Code Artifacts (Versioned Generated Scripts: PySpark, SQL, TMDL, Base64)
CREATE TABLE IF NOT EXISTS code_artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES runs(run_id) ON DELETE SET NULL,
    artifact_name TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_code_artifacts_project ON code_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_code_artifacts_run ON code_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_code_artifacts_type ON code_artifacts(artifact_type);

-- 11. Workspace Cache (Fast local snapshot of Fabric workspace items and folders)
CREATE TABLE IF NOT EXISTS workspace_cache (
    workspace_id TEXT PRIMARY KEY,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    folders_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Token Usage Audit Log (Enterprise multi-provider cost and latency tracking)
CREATE TABLE IF NOT EXISTS token_usage (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
    run_id TEXT REFERENCES runs(run_id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    complexity TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_run ON token_usage(run_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);

-- 13. Data Assets / Lineage Nodes (Generalized Fabric Catalog: Lakehouses, Tables, Models)
CREATE TABLE IF NOT EXISTS lineage_nodes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    parent_asset_id TEXT REFERENCES lineage_nodes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    layer TEXT NOT NULL,
    schema_definition JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_layer ON lineage_nodes(layer);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_type ON lineage_nodes(asset_type);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_parent ON lineage_nodes(parent_asset_id);

-- 14. Asset Lineage / Lineage Edges (Directed Dependency Graph & Column-Level Lineage)
CREATE TABLE IF NOT EXISTS lineage_edges (
    id BIGSERIAL PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES lineage_nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, target_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_source ON lineage_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_target ON lineage_edges(target_id);

-- 15. Architecture Recipes & Pattern Library (with native pgvector HNSW indexing)
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_dialect TEXT DEFAULT 'tsql',
    target_fabric_type TEXT DEFAULT 'lakehouse',
    code_template TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    rating INTEGER DEFAULT 5,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recipes_embedding ON recipes USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING gin(tags);

-- 16. Master Project Ledger & Semantic Knowledge (pgvector HNSW Memory Hub: Blueprints & ADRs)
CREATE TABLE IF NOT EXISTS project_ledger (
    project_id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    summary TEXT NOT NULL,
    workstreams JSONB DEFAULT '[]'::jsonb,
    lineage_dag JSONB DEFAULT '{}'::jsonb,
    table_catalog JSONB DEFAULT '[]'::jsonb,
    adrs JSONB DEFAULT '[]'::jsonb,
    embedding vector(1536),
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_ledger_workspace ON project_ledger(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_ledger_embedding ON project_ledger USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_project_ledger_committed ON project_ledger(committed_at DESC);
"""
