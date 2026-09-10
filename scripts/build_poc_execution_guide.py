"""
scripts/build_poc_execution_guide.py
------------------------------------
Generates the comprehensive, deep-dive 20-Day POC Engineering & Execution Guide
(OMNIFLOW_POC_20DAY_EXECUTION_GUIDE.md).
For every single task row (1.1 to M4), it provides:
- 1-2 line executive quick-revision summary
- Deep 100-200 line technical blueprint:
  1. Architectural Role & How It Works
  2. What to Build in This Phase (Classes, Schemas, DDLs, Algorithms)
  3. How It Is Connected (Inbound & Outbound Data Flows)
  4. Prerequisites & Research Items
  5. Verification & Demonstration Proof (Exact code & test assertions)
"""

import os

def generate_guide(output_file: str):
    content = """# OmniFlow 20-Day POC Master Execution & Architecture Guide
**JMAN Group — Multi-Agent Harness, PostgreSQL + pgvector Storage, and Microsoft Fabric Automation**

---

## Executive Architecture Overview

OmniFlow is an enterprise multi-agent execution harness that unifies **PostgreSQL + pgvector** as a single ACID storage engine, **FastAPI** as the backend API layer, **LangGraph** as the state machine orchestrator, and **Microsoft Fabric REST APIs** for granular item provisioning. It is designed to host pluggable internal data products (e.g. IngestOne, Snowball ARR) and execute data engineering operations autonomously with continuous self-healing and auditable memory.

```
                           ┌──────────────────────────────────────────────┐
                           │      User Prompt / Headless CLI Trigger      │
                           └──────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │        Auth & Context / Session Manager      │
                           └──────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
                        ┌───────────────────────────────────────────────────┐
                        │          Tech Lead / Task Decider Agent           │
                        └─────────┬───────────────────────────────┬─────────┘
                                  │                               │
        [Query Vector DB: τ ≥ 0.82]                               [Query Vector DB: τ < 0.82]
                     │                                                           │
                     ▼ (Skill Found: Branch A)                                   ▼ (Skill Missing: Branch B)
      ┌─────────────────────────────┐                           ┌─────────────────────────────────┐
      │    Task Organizer Agent     │                           │   Researcher / Tool Synthesis   │
      │ (Dependency DAG & Subtasks) │                           │  (Dynamic Schema & Code Gen)    │
      └──────────────┬──────────────┘                           └────────────────┬────────────────┘
                     │                                                           │
                     │                                                           ▼
                     │                                          ┌─────────────────────────────────┐
                     │◄─────────────────────────────────────────┤  Store New Skill into Skill DB  │
                     │                                          └─────────────────────────────────┘
                     ▼
      ┌─────────────────────────────┐
      │ Tool Execution & Packaging  │ ◄─────── [Tool Registry: Granular Fabric APIs & Product Hooks]
      └──────────────┬──────────────┘
                     │
                     ▼
      ┌─────────────────────────────┐
      │  Universal Fabric REST      │
      │     Execution Engine        │
      └──────────────┬──────────────┘
                     │
                     ├──────────────────────────┐
                     ▼                          ▼
      ┌─────────────────────────────┐   ┌─────────────────────────────┐
      │      Microsoft Fabric       │   │  Feedback & Debugger Loop   │
      │ (Lakehouse/Notebook/Pipeline│   │ (Self-Healing on 4xx/Error) │
      └──────────────┬──────────────┘   └─────────────────────────────┘
                     │
                     ▼
      ┌────────────────────────────────────────────────────────┐
      │   Master DB & Vector DB: Store Updated Execution Plan  │
      └────────────────────────────────────────────────────────┘
```

---

# Phase 1: Database & pgvector Layer (Days 1–5)

---

## Task 1.1: Master DB Relational Schema Design
> **Quick Summary**: Designs and implements normalized PostgreSQL tables for workspaces, master execution plans, deployed Fabric assets, and audit logs to provide persistent, long-term memory for all harness runs.

### 1. Architectural Role & How It Works
The Master Database serves as the persistent system of record across all OmniFlow sessions. When a data engineering request is executed, OmniFlow must never operate amnesiacally. The Master DB retains:
- **Workspaces (`workspaces`)**: Defines allowed tenant environments and security locks (`PBT_DATA_AGENT`), preventing unauthorized workspace operations.
- **Master Plans (`master_plans`)**: Stores the serialized execution DAG, raw prompt, matched skill reference, execution status (`PLANNED`, `EXECUTING`, `COMPLETED`, `FAILED`), and total execution time.
- **Deployed Assets (`deployed_assets`)**: Maps generated Fabric item GUIDs, item types (`Notebook`, `Lakehouse`, `DataPipeline`), parent folder IDs, and deployment timestamps back to the plan.
- **Audit Logs (`audit_logs`)**: Captures timestamped event streams, parameter changes, and error traces.

### 2. What to Build in This Phase
Build the SQLAlchemy declarative models and async database connection manager in `app/db/models.py`:

```python
# app/db/models.py
from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, Integer, BigInteger, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_name = Column(String(255), nullable=False, unique=True)
    fabric_workspace_id = Column(String(64), nullable=False, unique=True)
    is_active = Column(String(10), default="true")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class MasterPlan(Base):
    __tablename__ = "master_plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    prompt_raw = Column(Text, nullable=False)
    matched_skill_id = Column(UUID(as_uuid=True), nullable=True)
    plan_dag = Column(JSONB, nullable=False)  # Serialized Task DAG
    status = Column(String(50), default="PLANNED")
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_master_plans_ws_status", "workspace_id", "status"),
    )

class DeployedAsset(Base):
    __tablename__ = "deployed_assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("master_plans.id"), nullable=False)
    item_guid = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(100), nullable=False) # Lakehouse, Notebook, DataPipeline
    parent_folder_id = Column(String(64), nullable=True)
    metadata_json = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(String(100), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, default=dict)
    error_message = Column(Text, nullable=True)
    execution_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### 3. How It Is Connected
- **Inbound**: The FastAPI server and LangGraph decider node invoke the Master DB session to register incoming prompts and verify if identical tasks exist.
- **Outbound**: The execution engine writes live Fabric item GUIDs to `deployed_assets` upon creation, and the self-healing loop records crash stack traces into `audit_logs`.

### 4. Prerequisites & Research Items
- Install `asyncpg` and `SQLAlchemy>=2.0`.
- Verify database connection pooling configuration (`pool_size=10`, `max_overflow=20`) to handle concurrent agent tasks.
- Ensure strict foreign key cascading on plan deletion if cleanup scripts run.

### 5. Verification & Demonstration Proof
Run a standalone validation test script:
```python
# tests/test_master_db.py
import pytest
from app.db.models import Workspace, MasterPlan, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def test_master_db_crud():
    engine = create_engine("postgresql://postgres:postgres@localhost:5432/omniflow_db")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create Workspace
    ws = Workspace(workspace_name="PBT_DATA_AGENT", fabric_workspace_id="db7344c1-ecd9-44d6-849f-f2de49484f9f")
    session.add(ws)
    session.commit()
    
    # Assert
    saved_ws = session.query(Workspace).filter_by(workspace_name="PBT_DATA_AGENT").first()
    assert saved_ws is not None
    assert saved_ws.fabric_workspace_id == "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    session.close()
```

---

## Task 1.2: PostgreSQL + pgvector Infrastructure Setup
> **Quick Summary**: Provisions PostgreSQL with the native `pgvector` extension and configures connection pooling to support unified relational queries and vector similarity searches in a single database.

### 1. Architectural Role & How It Works
Instead of maintaining separate databases (like SQLite for metadata and ChromaDB for vectors), OmniFlow uses **PostgreSQL + pgvector** as a unified storage engine. This eliminates distributed synchronization bugs, provides ACID transactions across plan execution and vector lookups, and allows single-query joins between metadata and embeddings.

### 2. What to Build in This Phase
1. Database initialization migration script executing:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
2. Database connection pool manager in `app/db/postgres.py`:
```python
# app/db/postgres.py
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import DATABASE_URL

# postgresql+asyncpg://user:pass@localhost:5432/omniflow_db
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db_session():
    async with AsyncSessionLocal() as session:
        yield session
```

### 3. How It Is Connected
- **Inbound**: All agent nodes, vector matchers, and FastAPI routers acquire async sessions via `get_db_session()`.
- **Outbound**: Connects to the underlying PostgreSQL instance.

### 4. Prerequisites & Research Items
- Install PostgreSQL 15+ and pgvector (`pgvector/pgvector:pg16` Docker image or Azure Database for PostgreSQL Flexible Server).
- Verify that `asyncpg` supports the `pgvector` data type by registering the vector type codec on connection startup.

### 5. Verification & Demonstration Proof
Run a test checking vector extension availability:
```python
# tests/test_pgvector_ext.py
import pytest
from sqlalchemy import text
from app.db.postgres import engine

@pytest.mark.asyncio
async def test_pgvector_extension_active():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
        row = res.fetchone()
        assert row is not None
        assert row[0] == "vector"
```

---

## Task 1.3: Structured Skill Schema & Precondition Model
> **Quick Summary**: Defines a strongly-typed Pydantic model for Skill definitions, incorporating trigger intents, operation scopes, parameter models, execution rules, and precondition gates.

### 1. Architectural Role & How It Works
Skills are not arbitrary markdown blurbs; they are structured executable capability packages. The `SkillDefinition` model standardizes what inputs a skill requires, what Fabric REST items it creates, what prompt embeddings represent its intent, and what validation rules it enforces.

### 2. What to Build in This Phase
Build `app/domain/skill_schema.py`:

```python
# app/domain/skill_schema.py
from typing import Any, List, Optional
from pydantic import BaseModel, Field
import uuid

class SkillPrecondition(BaseModel):
    required_workspace_permissions: List[str] = Field(default_factory=lambda: ["Write", "Execute"])
    required_source_connectors: List[str] = Field(default_factory=list)
    allowed_target_platforms: List[str] = Field(default_factory=lambda: ["Fabric", "OneLake"])

class SkillDefinition(BaseModel):
    skill_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    skill_name: str = Field(..., description="Unique slug: e.g. fabric_lakehouse_provision")
    display_title: str = Field(..., description="Human readable title")
    description: str = Field(..., description="Detailed capability description")
    trigger_intent: str = Field(..., description="Semantic search embedding anchor text")
    target_fabric_items: List[str] = Field(..., description="e.g. ['Lakehouse', 'Notebook', 'DataPipeline']")
    parameter_schema: dict = Field(default_factory=dict, description="JSON Schema for required arguments")
    execution_rules: str = Field(..., description="Markdown prompt instructions for the agent")
    preconditions: SkillPrecondition = Field(default_factory=SkillPrecondition)
    is_active: bool = True
```

### 3. How It Is Connected
- **Inbound**: The Skill Loader reads YAML files and converts them into `SkillDefinition` instances.
- **Outbound**: Passed to the pgvector embedding indexer (Task 1.4) and the Task Organizer (Task 2.4).

### 4. Prerequisites & Research Items
- Ensure Pydantic v2 validation contracts are used.
- Schema must support dynamic extensions when the Researcher Agent authors new skills.

### 5. Verification & Demonstration Proof
```python
# tests/test_skill_schema.py
from app.domain.skill_schema import SkillDefinition

def test_skill_schema_valid():
    skill = SkillDefinition(
        skill_name="fabric_lakehouse_create",
        display_title="Create Lakehouse",
        description="Creates raw Bronze Lakehouse in Fabric",
        trigger_intent="provision lakehouse bronze raw tables delta format",
        target_fabric_items=["Lakehouse"],
        execution_rules="Deploy lakehouse in target folder and assert workspace isolation."
    )
    assert skill.skill_name == "fabric_lakehouse_create"
    assert "Lakehouse" in skill.target_fabric_items
```

---

## Task 1.4: pgvector Table Schema & HNSW Indexing
> **Quick Summary**: Creates the `skills` table in PostgreSQL with a `vector(1536)` column and an HNSW cosine similarity index, and implements the vector embedding insertion pipeline.

### 1. Architectural Role & How It Works
To allow the Task Decider agent to rapidly match incoming natural language prompts against registered skills, skill definitions are stored in PostgreSQL with 1536-dimensional embeddings. The HNSW (Hierarchical Navigable Small World) index provides sub-millisecond approximate nearest neighbor (ANN) retrieval across thousands of skills.

### 2. What to Build in This Phase
1. Database DDL for the `skills` table:
```sql
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name VARCHAR(255) NOT NULL UNIQUE,
    display_title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    trigger_intent TEXT NOT NULL,
    target_fabric_items JSONB NOT NULL DEFAULT '[]',
    parameter_schema JSONB NOT NULL DEFAULT '{}',
    execution_rules TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_hnsw_cosine 
ON skills USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

2. The embedding generator in `app/services/embedding_service.py`:
```python
# app/services/embedding_service.py
import openai
from app.config import OPENAI_KEY

async def get_text_embedding(text: str) -> list[float]:
    client = openai.AsyncOpenAI(api_key=OPENAI_KEY)
    resp = await client.embeddings.create(
        model="text-embedding-3-small",
        input=text.replace("\n", " ").strip()
    )
    return resp.data[0].embedding
```

### 3. How It Is Connected
- **Inbound**: Receives `SkillDefinition` objects from disk or Researcher Agent.
- **Outbound**: Polled via SQL cosine distance operator (`<=>`) by Task 2.1.

### 4. Prerequisites & Research Items
- Configure HNSW index parameters: `m=16` (connections per node) and `ef_construction=64` (search depth during build) offer the optimal balance of index build time and query recall.

### 5. Verification & Demonstration Proof
```python
# tests/test_pgvector_indexing.py
import pytest
from sqlalchemy import text
from app.db.postgres import engine

@pytest.mark.asyncio
async def test_hnsw_index_exists():
    async with engine.connect() as conn:
        res = await conn.execute(text(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'skills' AND indexname = 'idx_skills_hnsw_cosine';"
        ))
        assert res.fetchone() is not None
```

---

## Task 1.5: Skill Ingestion & Embedding Pipeline
> **Quick Summary**: Scans the filesystem for existing skill definitions, computes embeddings for their trigger intents, and bulk-upserts them into PostgreSQL with idempotent conflict handling.

### 1. Architectural Role & How It Works
When OmniFlow boots or when new skills are committed, this ingestion pipeline reads all `.agents/skills/*/SKILL.md` files, parses their YAML headers, generates embeddings, and synchronizes the Postgres `skills` table.

### 2. What to Build in This Phase
Build `app/services/skill_ingestion.py`:
```python
# app/services/skill_ingestion.py
import os, yaml
from sqlalchemy import text
from app.services.embedding_service import get_text_embedding
from app.db.postgres import AsyncSessionLocal

async def sync_skills_from_disk(skills_dir: str = ".agents/skills"):
    async with AsyncSessionLocal() as session:
        for root, _, files in os.walk(skills_dir):
            for file in files:
                if file.endswith(".md"):
                    path = os.path.join(root, file)
                    with open(path, encoding="utf-8") as f:
                        content = f.read()
                    
                    if content.startswith("---"):
                        parts = content.split("---", 2)
                        frontmatter = yaml.safe_load(parts[1])
                        rules = parts[2].strip()
                        
                        name = frontmatter.get("name", file.replace(".md", ""))
                        title = frontmatter.get("title", name)
                        desc = frontmatter.get("description", "")
                        trigger = frontmatter.get("trigger_intent", f"{title} {desc}")
                        items = frontmatter.get("target_fabric_items", ["Notebook"])
                        
                        embedding = await get_text_embedding(trigger)
                        
                        sql = text("""
                            INSERT INTO skills (skill_name, display_title, description, trigger_intent, target_fabric_items, execution_rules, embedding)
                            VALUES (:name, :title, :desc, :trigger, :items::jsonb, :rules, :embedding)
                            ON CONFLICT (skill_name) DO UPDATE SET
                                description = EXCLUDED.description,
                                trigger_intent = EXCLUDED.trigger_intent,
                                execution_rules = EXCLUDED.execution_rules,
                                embedding = EXCLUDED.embedding;
                        """)
                        await session.execute(sql, {
                            "name": name, "title": title, "desc": desc,
                            "trigger": trigger, "items": str(items).replace("'", '"'),
                            "rules": rules, "embedding": str(embedding)
                        })
        await session.commit()
```

### 3. How It Is Connected
- Runs during application startup and is triggered dynamically whenever the Researcher Agent synthesizes a new skill.

### 4. Prerequisites & Research Items
- `pyyaml` installed. Handle markdown formatting errors gracefully without breaking the loop.

### 5. Verification & Demonstration Proof
Run `python -c "import asyncio; from app.services.skill_ingestion import sync_skills_from_disk; asyncio.run(sync_skills_from_disk())"` and verify that `SELECT COUNT(*) FROM skills;` returns $\ge 6$ indexed skills.

---

## Task 1.6: Ephemeral Task & Checkpoint State Schema
> **Quick Summary**: Implements an active workflow checkpointing store in PostgreSQL to persist LangGraph execution states, intermediate cell code, and subtask progress without polluting the Master DB.

### 1. Architectural Role & How It Works
During a multi-step execution (e.g. generating 3 notebooks, waiting for a Fabric pipeline trigger, or running a 3-step self-healing retry), the active task state must be checkpointed after every node execution. If a process restarts or network fails, LangGraph resumes seamlessly from the latest state checkpoint.

### 2. What to Build in This Phase
Build the LangGraph PostgreSQL checkpointer in `app/orchestrator/state_store.py`:
```python
# app/orchestrator/state_store.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.config import DATABASE_URL_ASYNC

async def get_workflow_checkpointer():
    checkpointer = AsyncPostgresSaver.from_conn_string(DATABASE_URL_ASYNC)
    await checkpointer.setup() # Automatically creates checkpoints and checkpoint_blobs tables
    return checkpointer
```

### 3. How It Is Connected
- **Inbound**: Injected into the LangGraph `StateGraph.compile(checkpointer=...)`.
- **Outbound**: Reads and writes state snapshots directly to PostgreSQL `checkpoints` tables.

### 4. Prerequisites & Research Items
- Install `langgraph-checkpoint-postgres`.
- Ensure connection pool allows binary checkpoint serialization.

### 5. Verification & Demonstration Proof
Run a 2-step mock StateGraph with checkpointer, pause after Step 1, verify checkpoint row in Postgres, and resume Step 2.

---

## Milestone 1 Gate (Day 5): Postgres + pgvector Storage Live
> **Quick Summary**: Formal technical validation gate asserting that PostgreSQL is active, the `vector` extension is operational, skills are indexed with embeddings, and SQL similarity searches respond in $<50$ms.

### 1. Gate Criteria & Acceptance Tests
1. **DDL Verification**: `workspaces`, `master_plans`, `deployed_assets`, `skills`, and `checkpoints` tables exist.
2. **Vector Index Active**: `idx_skills_hnsw_cosine` index verified via `pg_indexes`.
3. **Retrieval Latency**: Vector distance query runs in $<50$ms.

### 2. Execution Script
```bash
pytest tests/test_phase1_gate.py -v
```

---

# Phase 2: Agent Harness & Router (Days 6–10)

---

## Task 2.1: pgvector SQL Semantic Skill Matcher
> **Quick Summary**: Implements a high-precision cosine distance search in PostgreSQL (`embedding <=> query_vec`) with an execution threshold gate ($\tau \ge 0.82$) to determine if a prompt matches an existing skill.

### 1. Architectural Role & How It Works
This service evaluates the decision diamond in the architecture diagram: *"Do we have skills/instructions in the DB?"*.
When a user prompt arrives:
1. Generates an embedding for the prompt text.
2. Executes a single SQL query calculating cosine similarity: `similarity = 1 - (embedding <=> :query_vec)`.
3. If the top result has `similarity >= 0.82`, returns `SkillMatchResult(found=True, skill=...)`.
4. If `similarity < 0.82`, returns `SkillMatchResult(found=False)`.

### 2. What to Build in This Phase
Build `app/services/skill_matcher.py`:
```python
# app/services/skill_matcher.py
from dataclasses import dataclass
from typing import Optional
from sqlalchemy import text
from app.db.postgres import AsyncSessionLocal
from app.services.embedding_service import get_text_embedding

@dataclass
class SkillMatchResult:
    found: bool
    skill_name: Optional[str] = None
    similarity: float = 0.0
    execution_rules: Optional[str] = None
    target_fabric_items: Optional[list] = None

async def match_skill_for_prompt(prompt: str, threshold: float = 0.82) -> SkillMatchResult:
    query_vec = await get_text_embedding(prompt)
    async with AsyncSessionLocal() as session:
        sql = text("""
            SELECT skill_name, execution_rules, target_fabric_items,
                   1 - (embedding <=> :query_vec::vector) AS similarity
            FROM skills
            ORDER BY embedding <=> :query_vec::vector ASC
            LIMIT 1;
        """)
        res = await session.execute(sql, {"query_vec": str(query_vec)})
        row = res.fetchone()
        
        if row and row.similarity >= threshold:
            return SkillMatchResult(
                found=True,
                skill_name=row.skill_name,
                similarity=float(row.similarity),
                execution_rules=row.execution_rules,
                target_fabric_items=row.target_fabric_items
            )
        
        return SkillMatchResult(found=False, similarity=float(row.similarity) if row else 0.0)
```

### 3. How It Is Connected
- **Inbound**: Called by the Tech Lead / Task Decider router node (Task 2.3).
- **Outbound**: Queries the PostgreSQL `skills` table.

### 4. Prerequisites & Research Items
- Verify that the cosine distance operator `<=>` is used (since vectors are unit normalized, cosine distance = $1 - \text{cosine similarity}$).

### 5. Verification & Demonstration Proof
```python
# tests/test_skill_matcher.py
import pytest
from app.services.skill_matcher import match_skill_for_prompt

@pytest.mark.asyncio
async def test_known_skill_match():
    res = await match_skill_for_prompt("Create a Bronze Lakehouse and Delta table for Customer data")
    assert res.found is True
    assert res.similarity >= 0.82

@pytest.mark.asyncio
async def test_unknown_skill_miss():
    res = await match_skill_for_prompt("Write a poem about quantum physics in Shakespearean English")
    assert res.found is False
    assert res.similarity < 0.70
```

---

## Task 2.2: Granular Fabric Tool Registry
> **Quick Summary**: Standardizes and catalogs granular Microsoft Fabric REST creation tools (`create_lakehouse`, `create_notebook`, `create_pipeline`, `create_folder`, `create_environment`, `create_shortcut`) with Pydantic JSON schemas.

### 1. Architectural Role & How It Works
The Tool Registry acts as the interface contract between the AI reasoning agents and the Fabric execution engine. It wraps every granular API in `app/fabric_client.py` into a typed, inspectable tool definition that can be bound directly to LLM agents or called programmatically by the Task Organizer.

### 2. What to Build in This Phase
Build `app/tools/tool_registry.py`:
```python
# app/tools/tool_registry.py
from typing import Callable, Dict, Any
from pydantic import BaseModel, Field

class CreateLakehouseParams(BaseModel):
    display_name: str = Field(..., description="Lakehouse display name, e.g. lh_enterprise_bronze")
    folder_id: Optional[str] = Field(None, description="Optional target folder GUID")

class CreateNotebookParams(BaseModel):
    display_name: str = Field(..., description="Notebook name")
    python_code: str = Field(..., description="PySpark execution code")
    folder_id: Optional[str] = Field(None)

class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters_schema: dict
    handler: Any

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}

    def register(self, name: str, description: str, schema_cls: type[BaseModel], handler: Callable):
        self._tools[name] = ToolDefinition(
            name=name,
            description=description,
            parameters_schema=schema_cls.model_json_schema(),
            handler=handler
        )

    def get_tool(self, name: str) -> ToolDefinition:
        return self._tools[name]

    def list_tools(self) -> list[dict]:
        return [{"name": t.name, "description": t.description, "schema": t.parameters_schema} for t in self._tools.values()]
```

### 3. How It Is Connected
- **Inbound**: Populated during startup with functions from `app/fabric_client.py`.
- **Outbound**: Polled by the Task Organizer to assemble valid activity execution DAGs.

### 4. Prerequisites & Research Items
- Pydantic v2 `model_json_schema()` compatibility.

### 5. Verification & Demonstration Proof
```python
# tests/test_tool_registry.py
from app.tools.tool_registry import ToolRegistry, CreateLakehouseParams

def test_tool_registration():
    reg = ToolRegistry()
    reg.register("create_lakehouse", "Creates Lakehouse", CreateLakehouseParams, lambda x: True)
    assert "create_lakehouse" in [t["name"] for t in reg.list_tools()]
```

---

## Task 2.3: Tech Lead / Task Decider Router Node
> **Quick Summary**: Constructs the primary LangGraph conditional router node that evaluates incoming prompts against Master DB historical records and pgvector skill matches to route execution to Branch A or Branch B.

### 1. Architectural Role & How It Works
The Task Decider acts as the central router of the multi-agent harness. Given a user request:
1. It queries `master_plans` in Master DB to check if a valid execution plan already exists for this exact prompt. If yes, reuses the verified DAG.
2. If no prior plan exists, it calls `match_skill_for_prompt()`.
3. If a skill is found ($\tau \ge 0.82$), it directs the StateGraph to **Branch A (`task_organizer_node`)**.
4. If no skill is found ($\tau < 0.82$), it directs the StateGraph to **Branch B (`researcher_agent_node`)**.

### 2. What to Build in This Phase
Build `app/orchestrator/decider_node.py`:
```python
# app/orchestrator/decider_node.py
from typing import Literal
from app.services.skill_matcher import match_skill_for_prompt
from app.orchestrator.state import WorkflowState

async def decider_router_node(state: WorkflowState) -> dict:
    prompt = state["prompt"]
    match_result = await match_skill_for_prompt(prompt)
    
    return {
        "skill_found": match_result.found,
        "matched_skill_name": match_result.skill_name,
        "matched_rules": match_result.execution_rules,
        "matched_items": match_result.target_fabric_items,
        "similarity_score": match_result.similarity
    }

def route_next_node(state: WorkflowState) -> Literal["task_organizer", "researcher_agent"]:
    if state.get("skill_found"):
        return "task_organizer"
    return "researcher_agent"
```

### 3. How It Is Connected
- **Inbound**: First node in the LangGraph workflow after input validation.
- **Outbound**: Conditional edge leading to `task_organizer` (Branch A) or `researcher_agent` (Branch B).

### 4. Prerequisites & Research Items
- LangGraph `StateGraph` routing syntax (`add_conditional_edges`).

### 5. Verification & Demonstration Proof
Run a test verifying that `route_next_node` returns `"task_organizer"` when `skill_found=True` and `"researcher_agent"` when `skill_found=False`.

---

## Task 2.4: Branch A: Task Organizer (DAG Planner)
> **Quick Summary**: Implements the Task Organizer agent that takes a matched skill definition, extracts parameters, validates prerequisites, and constructs a structured subtask execution DAG with dependency sequencing.

### 1. Architectural Role & How It Works
When a known skill is matched, the Task Organizer converts the high-level intent into an ordered execution graph. For example, if the skill is `fabric_lakehouse_and_pipeline`, it decomposes the task into:
1. `step_1_create_folder`: Target folder provisioning.
2. `step_2_create_lakehouse`: Bronze lakehouse creation (depends on step 1).
3. `step_3_create_pipeline`: Data Factory pipeline creation (depends on step 2).

### 2. What to Build in This Phase
Build `app/orchestrator/task_organizer.py`:
```python
# app/orchestrator/task_organizer.py
from app.orchestrator.state import WorkflowState, Subtask

async def task_organizer_node(state: WorkflowState) -> dict:
    rules = state.get("matched_rules", "")
    items = state.get("matched_items", [])
    prompt = state.get("prompt", "")
    
    # Construct structured execution DAG
    subtasks = []
    
    # Example DAG assembly based on target items
    if "Lakehouse" in items:
        subtasks.append(Subtask(
            id="task_create_lakehouse",
            tool_name="create_lakehouse",
            parameters={"display_name": "lh_enterprise_bronze"},
            depends_on=[]
        ))
    if "Notebook" in items:
        subtasks.append(Subtask(
            id="task_create_notebook",
            tool_name="create_notebook",
            parameters={"display_name": "nb_raw_ingest"},
            depends_on=["task_create_lakehouse"]
        ))
    if "DataPipeline" in items:
        subtasks.append(Subtask(
            id="task_create_pipeline",
            tool_name="create_pipeline",
            parameters={"display_name": "pl_daily_ingestion"},
            depends_on=["task_create_notebook"]
        ))
        
    return {
        "execution_dag": [s.model_dump() for s in subtasks],
        "current_status": "PLAN_GENERATED"
    }
```

### 3. How It Is Connected
- **Inbound**: Triggered by Decider Node (Branch A).
- **Outbound**: Feeds the planned DAG into Master DB Sync (Task 2.6) and Execution Engine (Phase 3).

### 4. Prerequisites & Research Items
- Implement topological sort validation to guarantee acyclic dependency execution.

### 5. Verification & Demonstration Proof
Assert that the generated DAG has 0 circular dependencies and all `depends_on` references map to existing subtask IDs.

---

## Task 2.5: Branch B: Researcher & Dynamic Tool Synthesis Agent
> **Quick Summary**: Implements the autonomous fallback agent that investigates unknown schemas/APIs, synthesizes new tool code, generates structured skill definitions, and persists them into PostgreSQL with embeddings.

### 1. Architectural Role & How It Works
When the Decider encounters a novel request that does not match any existing skill ($\tau < 0.82$), it triggers the Researcher Agent.
The Researcher Agent:
1. Inspects available API documentation and schemas.
2. Synthesizes the required Python execution code and Pydantic parameter schemas.
3. Formulates a new `SkillDefinition`.
4. Computes vector embeddings and **inserts the new skill directly into PostgreSQL `skills` table**.
5. Passes the newly learned skill to the Task Organizer so the current job finishes seamlessly, and **all future runs match this skill instantly**.

### 2. What to Build in This Phase
Build `app/orchestrator/researcher_node.py`:
```python
# app/orchestrator/researcher_node.py
import openai
from app.config import OPENAI_KEY
from app.services.embedding_service import get_text_embedding
from app.db.postgres import AsyncSessionLocal
from sqlalchemy import text
from app.orchestrator.state import WorkflowState

async def researcher_agent_node(state: WorkflowState) -> dict:
    prompt = state["prompt"]
    client = openai.AsyncOpenAI(api_key=OPENAI_KEY)
    
    # Prompt LLM to synthesize a new skill definition
    synthesis_prompt = f"""
    You are an AI Research Agent. A user requested an operation that is not in our Skill DB: '{prompt}'.
    Generate a valid skill definition with:
    1. skill_name (slug)
    2. display_title
    3. description
    4. trigger_intent
    5. target_fabric_items (list of Fabric item types)
    6. execution_rules (markdown guidelines for building artifacts)
    Output as JSON.
    """
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": synthesis_prompt}],
        response_format={"type": "json_object"}
    )
    import json
    data = json.loads(resp.choices[0].message.content)
    
    # Generate embedding and save to Postgres
    embedding = await get_text_embedding(data["trigger_intent"])
    async with AsyncSessionLocal() as session:
        sql = text("""
            INSERT INTO skills (skill_name, display_title, description, trigger_intent, target_fabric_items, execution_rules, embedding)
            VALUES (:name, :title, :desc, :trigger, :items::jsonb, :rules, :embedding)
            ON CONFLICT (skill_name) DO UPDATE SET execution_rules = EXCLUDED.execution_rules;
        """)
        await session.execute(sql, {
            "name": data["skill_name"],
            "title": data["display_title"],
            "desc": data["description"],
            "trigger": data["trigger_intent"],
            "items": json.dumps(data["target_fabric_items"]),
            "rules": data["execution_rules"],
            "embedding": str(embedding)
        })
        await session.commit()
        
    return {
        "matched_skill_name": data["skill_name"],
        "matched_rules": data["execution_rules"],
        "matched_items": data["target_fabric_items"],
        "skill_found": True
    }
```

### 3. How It Is Connected
- **Inbound**: Triggered by Decider Node (Branch B).
- **Outbound**: Upserts into PostgreSQL `skills` and loops into Task Organizer.

### 4. Prerequisites & Research Items
- JSON mode validation in OpenAI API.

### 5. Verification & Demonstration Proof
Pass an unindexed prompt $\to$ assert new row created in PostgreSQL `skills` $\to$ re-run prompt $\to$ assert instant match with $\tau \ge 0.85$.

---

## Task 2.6: Execution Plan Master DB Sync
> **Quick Summary**: Persists the planned execution DAG, parameter bindings, and workspace references into PostgreSQL `master_plans` with status `PLANNED`.

### 1. Architectural Role & How It Works
Before executing any remote mutations in Fabric, the planned execution graph is committed to the Master DB. This guarantees complete auditability and allows recovery if the host server crashes mid-flight.

### 2. What to Build in This Phase
Build `app/orchestrator/plan_sync.py`:
```python
# app/orchestrator/plan_sync.py
import uuid
from sqlalchemy import text
from app.db.postgres import AsyncSessionLocal
from app.orchestrator.state import WorkflowState

async def sync_plan_to_master_db(state: WorkflowState) -> dict:
    plan_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as session:
        sql = text("""
            INSERT INTO master_plans (id, workspace_id, prompt_raw, plan_dag, status)
            VALUES (:id, :ws_id, :prompt, :dag::jsonb, 'PLANNED');
        """)
        await session.execute(sql, {
            "id": plan_id,
            "ws_id": state.get("workspace_id", "db7344c1-ecd9-44d6-849f-f2de49484f9f"),
            "prompt": state["prompt"],
            "dag": str(state["execution_dag"]).replace("'", '"')
        })
        await session.commit()
    return {"plan_id": plan_id}
```

### 3. How It Is Connected
- **Inbound**: Receives execution DAG from Task Organizer.
- **Outbound**: Writes row to `master_plans` in PostgreSQL.

### 4. Prerequisites & Research Items
- None. Standard SQL insert.

### 5. Verification & Demonstration Proof
Verify that `SELECT status FROM master_plans WHERE id = :plan_id` returns `'PLANNED'`.

---

## Milestone 2 Gate (Day 10): Dual-Branch Routing Verified
> **Quick Summary**: Verification gate confirming that both Branch A (known skill hit) and Branch B (zero-shot researcher synthesis) generate valid, executable DAGs in Master DB.

### 1. Gate Criteria & Acceptance Tests
1. **Branch A Test**: Standard prompt routes to Task Organizer and outputs 3-step DAG in $<1$s.
2. **Branch B Test**: Novel prompt triggers Researcher, generates valid skill, inserts into pgvector, and proceeds to Task Organizer.
3. **Master DB Sync**: Both flows create `master_plans` rows with status `PLANNED`.

### 2. Execution Script
```bash
pytest tests/test_phase2_gate.py -v
```

---

# Phase 3: Fabric Engine & Adapter (Days 11–15)

---

## Task 3.1: Granular Fabric Item Provisioning Engine
> **Quick Summary**: Executes 2-phase REST API deployments (`create_item` + Base64 `updateDefinition` + LRO polling) to provision granular Fabric items (Notebooks, Lakehouses, DataPipelines, Environments, Folders).

### 1. Architectural Role & How It Works
This is the physical execution transport layer. Rather than guessing API payloads, it uses our verified `app/fabric_client.py` methods to create Fabric items in the target workspace (`PBT_DATA_AGENT`), upload Base64 definition parts (with proper `# Fabric notebook source` headers and JSON activity structures), and poll async LRO operation status until complete.

### 2. What to Build in This Phase
Wire the execution handler into the LangGraph state machine in `app/orchestrator/executor_node.py`:
```python
# app/orchestrator/executor_node.py
from app.fabric_client import provision_item_with_definition, _assert_workspace
from app.config import ALLOWED_WORKSPACE_ID
from app.orchestrator.state import WorkflowState

async def fabric_executor_node(state: WorkflowState) -> dict:
    workspace_id = state.get("workspace_id", ALLOWED_WORKSPACE_ID)
    _assert_workspace(workspace_id)
    
    execution_dag = state["execution_dag"]
    deployed_items = []
    
    for task in execution_dag:
        tool_name = task["tool_name"]
        params = task["parameters"]
        display_name = params["display_name"]
        
        # Determine Fabric item type
        item_type = "Notebook" if "notebook" in tool_name else ("Lakehouse" if "lakehouse" in tool_name else "DataPipeline")
        
        res = provision_item_with_definition(
            display_name=display_name,
            item_type=item_type,
            parts=params.get("parts"),
            folder_id=params.get("folder_id"),
            workspace_id=workspace_id
        )
        if not res.get("success"):
            return {"execution_error": res.get("error"), "failed_task": task}
            
        deployed_items.append({"name": display_name, "guid": res.get("item_id"), "type": item_type})
        
    return {"deployed_items": deployed_items, "current_status": "DEPLOYED"}
```

### 3. How It Is Connected
- **Inbound**: Consumes subtask DAG from Task Organizer.
- **Outbound**: Calls Microsoft Fabric REST API (`api.fabric.microsoft.com`).

### 4. Prerequisites & Research Items
- Ensure Bearer token / Azure CLI authentication is active via `app/auth.py`.
- Workspace security lock strictly enforced via `_assert_workspace()`.

### 5. Verification & Demonstration Proof
Run a test script provisioning a dummy Lakehouse and Notebook in `PBT_DATA_AGENT` workspace and assert HTTP 201/200 return codes.

---

## Task 3.2: Internal Product Adapter Interface
> **Quick Summary**: Constructs a standardized abstract base class (`BaseProductAdapter`) enabling internal JMAN data products (e.g. IngestOne, Snowball ARR) to plug into the harness as callable sub-agents.

### 1. Architectural Role & How It Works
OmniFlow does not hardcode product logic. Instead, it provides a clean adapter contract:
1. `validate_inputs(params)`: Validates that the user prompt supplied required configuration (e.g. Salesforce credentials, source tables).
2. `configure_product(params)`: Generates internal product configuration files or metadata tables (e.g., IngestOne metadata instances or Snowball dbt configs).
3. `get_fabric_payloads()`: Returns the concrete Fabric Notebooks/Pipelines that execute the product's logic in Microsoft Fabric.

### 2. What to Build in This Phase
Build `app/adapters/base_adapter.py`:
```python
# app/adapters/base_adapter.py
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel

class FabricPayload(BaseModel):
    display_name: str
    item_type: str
    definition_parts: List[dict]

class BaseProductAdapter(ABC):
    @abstractmethod
    def get_product_name(self) -> str:
        """Unique product slug (e.g. 'ingest_one', 'snowball_arr')"""
        pass

    @abstractmethod
    def validate_parameters(self, params: Dict[str, Any]) -> bool:
        """Validates required input arguments."""
        pass

    @abstractmethod
    def generate_fabric_artifacts(self, params: Dict[str, Any]) -> List[FabricPayload]:
        """Translates product configuration into executable Fabric definition parts."""
        pass
```

### 3. How It Is Connected
- **Inbound**: Invoked by the Tool Registry or Task Organizer when a product-specific skill is matched.
- **Outbound**: Passes compiled `FabricPayload` objects to the Fabric Provisioning Engine.

### 4. Prerequisites & Research Items
- Inspect `ingest-one` and `agentic_snowball_arr` schemas to verify payload compatibility.

### 5. Verification & Demonstration Proof
Create a `MockIngestOneAdapter(BaseProductAdapter)` and assert that `generate_fabric_artifacts()` produces valid Base64 notebook parts.

---

## Task 3.3: Product-to-Fabric Orchestration Wiring
> **Quick Summary**: Connects the Product Adapter outputs directly into the Fabric execution pipeline, deploying the product's notebooks and scheduling pipeline runs in Microsoft Fabric.

### 1. Architectural Role & How It Works
This task bridges internal product logic with Microsoft Fabric infrastructure. When an internal product adapter generates its PySpark engine notebooks and metadata tables, this module:
1. Provisions the engine notebooks into the Fabric workspace.
2. Creates a Data Factory Pipeline connecting the stages.
3. Triggers execution via `POST .../jobs/instances?jobType=Pipeline`.

### 2. What to Build in This Phase
Build `app/orchestrator/product_orchestrator.py`:
```python
# app/orchestrator/product_orchestrator.py
from app.adapters.base_adapter import BaseProductAdapter
from app.fabric_client import provision_item_with_definition, trigger_pipeline_run
from app.config import ALLOWED_WORKSPACE_ID

async def deploy_and_run_product(adapter: BaseProductAdapter, params: dict) -> dict:
    if not adapter.validate_parameters(params):
        raise ValueError("Invalid parameters for product adapter.")
        
    artifacts = adapter.generate_fabric_artifacts(params)
    deployed_guids = {}
    
    for art in artifacts:
        res = provision_item_with_definition(
            display_name=art.display_name,
            item_type=art.item_type,
            parts=art.definition_parts,
            workspace_id=ALLOWED_WORKSPACE_ID
        )
        if not res.get("success"):
            return {"success": False, "error": res.get("error")}
        deployed_guids[art.display_name] = res.get("item_id")
        
    # If pipeline present, trigger run
    pipeline_id = deployed_guids.get("Ingestion_Pipeline")
    if pipeline_id:
        trigger_res = trigger_pipeline_run(pipeline_id, ALLOWED_WORKSPACE_ID)
        return {"success": True, "deployed": deployed_guids, "job": trigger_res}
        
    return {"success": True, "deployed": deployed_guids}
```

### 3. How It Is Connected
- Integrates Task 3.1 (Fabric Engine) and Task 3.2 (Product Adapter).

### 4. Prerequisites & Research Items
- Ensure pipeline JSON definition has valid `notebookId` references to newly deployed notebooks.

### 5. Verification & Demonstration Proof
Test script runs `deploy_and_run_product()` and asserts job instance trigger returns `HTTP 202 Accepted` with a valid Job GUID.

---

## Task 3.4: Self-Healing Debugger Loop
> **Quick Summary**: Implements a cyclic LangGraph error-recovery node that intercepts Fabric compilation/runtime errors, parses stack traces, patches definition payloads, and re-executes up to 3 times.

### 1. Architectural Role & How It Works
Data engineering operations frequently encounter schema mismatches, syntax typos, or transient API errors. Rather than crashing, the self-healer node:
1. Catches the error payload and stack trace.
2. Formulates a targeted repair prompt for the LLM (*"Fix this PySpark syntax or Fabric definition error: [stack_trace]"*).
3. Patches the code in the active LangGraph state.
4. Transitions the workflow back to the executor node (up to 3 retries).

### 2. What to Build in This Phase
Build `app/orchestrator/debugger_node.py`:
```python
# app/orchestrator/debugger_node.py
import openai
from app.config import OPENAI_KEY
from app.orchestrator.state import WorkflowState

async def debugger_node(state: WorkflowState) -> dict:
    error_msg = state.get("execution_error", "Unknown error")
    failed_task = state.get("failed_task", {})
    retry_count = state.get("retry_count", 0) + 1
    
    if retry_count > 3:
        return {"current_status": "FAILED_MAX_RETRIES", "retry_count": retry_count}
        
    client = openai.AsyncOpenAI(api_key=OPENAI_KEY)
    fix_prompt = f"""
    A Microsoft Fabric deployment failed with error:
    {error_msg}
    
    Failed Task Configuration:
    {failed_task}
    
    Output the corrected parameters dictionary in JSON format.
    """
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": fix_prompt}],
        response_format={"type": "json_object"}
    )
    import json
    patched_params = json.loads(resp.choices[0].message.content)
    
    # Update DAG with patched task
    dag = state["execution_dag"]
    for idx, t in enumerate(dag):
        if t["id"] == failed_task.get("id"):
            dag[idx]["parameters"] = patched_params
            
    return {
        "execution_dag": dag,
        "execution_error": None,
        "retry_count": retry_count,
        "current_status": "RETRY_SCHEDULED"
    }
```

### 3. How It Is Connected
- **Inbound**: Triggered when `fabric_executor_node` returns an `execution_error`.
- **Outbound**: Loops back to `fabric_executor_node`.

### 4. Prerequisites & Research Items
- Ensure max retry limit (`retry_count > 3`) is strictly enforced to avoid infinite billing loops.

### 5. Verification & Demonstration Proof
Inject an intentional syntax error into a notebook payload $\to$ assert debugger intercepts error $\to$ patches syntax $\to$ re-deploys successfully.

---

## Task 3.5: Post-Execution Master DB Lineage Hydration
> **Quick Summary**: Updates PostgreSQL `deployed_assets` and `master_plans` tables with live Fabric GUIDs, execution runtimes, and lineage edges upon successful workflow completion.

### 1. Architectural Role & How It Works
Once all items are created and validated in Microsoft Fabric, this module commits the final operational metadata back to PostgreSQL, updating the plan status to `COMPLETED` and registering all deployed assets with their live cloud GUIDs.

### 2. What to Build in This Phase
Build `app/db/lineage_sync.py`:
```python
# app/db/lineage_sync.py
from sqlalchemy import text
from app.db.postgres import AsyncSessionLocal
from app.orchestrator.state import WorkflowState

async def hydrate_master_db_lineage(state: WorkflowState):
    plan_id = state["plan_id"]
    deployed_items = state.get("deployed_items", [])
    
    async with AsyncSessionLocal() as session:
        # 1. Update Master Plan status
        await session.execute(text("""
            UPDATE master_plans 
            SET status = 'COMPLETED', duration_ms = :duration
            WHERE id = :plan_id;
        """), {"plan_id": plan_id, "duration": state.get("duration_ms", 1200)})
        
        # 2. Insert Deployed Assets
        for item in deployed_items:
            await session.execute(text("""
                INSERT INTO deployed_assets (plan_id, item_guid, item_name, item_type)
                VALUES (:plan_id, :guid, :name, :type);
            """), {
                "plan_id": plan_id,
                "guid": item["guid"],
                "name": item["name"],
                "type": item["type"]
            })
            
        await session.commit()
```

### 3. How It Is Connected
- **Inbound**: Final node in the successful LangGraph execution flow.
- **Outbound**: Writes updates to PostgreSQL.

### 4. Prerequisites & Research Items
- None.

### 5. Verification & Demonstration Proof
Query `master_plans` and `deployed_assets` in PostgreSQL $\to$ verify status is `'COMPLETED'` and all asset GUIDs are present.

---

## Milestone 3 Gate (Day 15): Integrated Product Deployment Live
> **Quick Summary**: Verification gate demonstrating that an internal product payload is automatically parameterized, deployed into Microsoft Fabric, and recovers from an injected failure.

### 1. Gate Criteria & Acceptance Tests
1. **Product Deployment**: Adapter converts inputs $\to$ Fabric engine creates items in `PBT_DATA_AGENT`.
2. **Self-Healing**: Injected error triggers debugger and successfully auto-repairs.
3. **Master DB Hydration**: Live asset GUIDs committed to PostgreSQL.

### 2. Execution Script
```bash
pytest tests/test_phase3_gate.py -v
```

---

# Phase 4: E2E Scenarios & Demo (Days 16–20)

---

## Task 4.1: E2E Scenario 1: Known Skill + Product Orchestration
> **Quick Summary**: End-to-end integration test executing a complete user workflow from prompt to semantic skill hit, product configuration, and live Microsoft Fabric deployment.

### 1. Architectural Role & How It Works
Validates the primary happy path of the OmniFlow harness:
1. User supplies a prompt: *"Ingest customer data into Bronze Lakehouse and trigger daily pipeline"*.
2. pgvector returns semantic match ($\tau = 0.93$).
3. Decider routes to Branch A (Task Organizer).
4. Product Adapter parameters internal ingestion engine.
5. Fabric Engine provisions Lakehouse, Notebook, and Pipeline in `PBT_DATA_AGENT`.
6. Master DB records `COMPLETED` run with asset GUIDs.

### 2. What to Build in This Phase
Build test script `tests/e2e/test_scenario1_known_skill.py`:
```python
# tests/e2e/test_scenario1_known_skill.py
import pytest
from app.orchestrator.graph import run_omniflow_pipeline

@pytest.mark.asyncio
async def test_e2e_known_skill_flow():
    prompt = "Create Bronze Lakehouse for Customer Ingestion and deploy pipeline"
    result = await run_omniflow_pipeline(prompt)
    
    assert result["skill_found"] is True
    assert result["current_status"] == "COMPLETED"
    assert len(result["deployed_items"]) >= 2
    assert "plan_id" in result
```

### 3. Verification & Demonstration Proof
Execute the test and verify console trace showing green status across all 5 execution stages.

---

## Task 4.2: E2E Scenario 2: Zero-Shot Skill Synthesis & Persistence
> **Quick Summary**: End-to-end test verifying that an unindexed prompt triggers the Researcher Agent, dynamically synthesizes a new skill, inserts it into pgvector, and enables subsequent runs to match instantly.

### 1. Architectural Role & How It Works
Validates the self-learning capability of OmniFlow:
- **Run 1**: Novel prompt $\to$ pgvector similarity $< 0.70$ $\to$ Researcher Agent synthesizes skill $\to$ persists to PostgreSQL.
- **Run 2**: Same prompt $\to$ pgvector similarity $\ge 0.85$ (Branch A instant match!).

### 2. What to Build in This Phase
Build test script `tests/e2e/test_scenario2_zero_shot.py`:
```python
# tests/e2e/test_scenario2_zero_shot.py
import pytest
from app.orchestrator.graph import run_omniflow_pipeline
from app.services.skill_matcher import match_skill_for_prompt

@pytest.mark.asyncio
async def test_e2e_zero_shot_learning():
    unique_prompt = "Perform XML EDI 850 Purchase Order transformation to Delta Silver"
    
    # Run 1: Zero-shot learning
    res1 = await run_omniflow_pipeline(unique_prompt)
    assert res1["current_status"] in ("COMPLETED", "DEPLOYED")
    
    # Run 2: Verify instant vector hit
    match_res = await match_skill_for_prompt(unique_prompt)
    assert match_res.found is True
    assert match_res.similarity >= 0.82
```

### 3. Verification & Demonstration Proof
Run test and confirm that Run 2 matches the newly learned skill without invoking the Researcher Agent.

---

## Task 4.3: E2E Scenario 3: Execution Failure & Self-Healing
> **Quick Summary**: End-to-end test injecting an intentional defect into a Fabric deployment payload to verify that the Debugger node automatically diagnoses the error, patches the payload, and succeeds.

### 1. Architectural Role & How It Works
Proves operational resilience:
1. An intentional error (e.g. invalid JSON attribute in pipeline definition) is injected.
2. Fabric REST API rejects with HTTP 400.
3. Self-healing debugger intercepts error stack trace.
4. LLM generates syntax patch.
5. Engine re-deploys successfully on Retry 1.

### 2. What to Build in This Phase
Build test script `tests/e2e/test_scenario3_self_healing.py`:
```python
# tests/e2e/test_scenario3_self_healing.py
import pytest
from app.orchestrator.graph import run_omniflow_pipeline

@pytest.mark.asyncio
async def test_e2e_self_healing_recovery():
    prompt = "Create Test Notebook with injected syntax flaw"
    result = await run_omniflow_pipeline(prompt, inject_test_error=True)
    
    assert result["retry_count"] >= 1
    assert result["current_status"] == "COMPLETED"
```

### 3. Verification & Demonstration Proof
Verify logs show `Error intercepted` $\to$ `Patch applied` $\to$ `Deployment succeeded`.

---

## Task 4.4: Postgres + pgvector Latency & Lineage Benchmark
> **Quick Summary**: Executes automated benchmark scripts to measure pgvector cosine search latency under load ($<50$ms), concurrent session checkpoint writes, and lineage graph queries.

### 1. Architectural Role & How It Works
Validates the performance and scalability of the unified PostgreSQL + pgvector architecture. Measures:
- Vector search latency across 100 concurrent queries.
- Checkpoint commit latency in `PostgresSaver`.
- Recursive graph traversal performance on `deployed_assets`.

### 2. What to Build in This Phase
Build `scripts/run_benchmarks.py`:
```python
# scripts/run_benchmarks.py
import asyncio, time
from app.services.skill_matcher import match_skill_for_prompt

async def benchmark_vector_search(n_queries=50):
    start = time.perf_counter()
    tasks = [match_skill_for_prompt(f"Sample Ingestion Query {i}") for i in range(n_queries)]
    await asyncio.gather(*tasks)
    duration = time.perf_counter() - start
    avg_ms = (duration / n_queries) * 1000
    print(f"[BENCHMARK] {n_queries} Vector Searches completed in {duration:.2f}s (Avg: {avg_ms:.2f}ms/query)")
    assert avg_ms < 50.0

if __name__ == "__main__":
    asyncio.run(benchmark_vector_search())
```

### 3. Verification & Demonstration Proof
Run benchmark and generate summary markdown table with latency percentiles ($p50, p95, p99$).

---

## Task 4.5: Architecture Walkthrough & POC Demonstration
> **Quick Summary**: Prepares the live headless CLI demonstration, database ER diagrams, and technical presentation deck for internal JMAN stakeholders.

### 1. Architectural Role & How It Works
Synthesizes all technical deliverables into a clean, professional demonstration showing:
1. Live user prompt submission via CLI.
2. PostgreSQL + pgvector similarity matching visualization.
3. LangGraph state transitions and decision routing.
4. Autonomous artifact creation live inside the Microsoft Fabric workspace (`PBT_DATA_AGENT`).
5. Master DB persistent audit trail inspection.

### 2. Deliverables
- `POC_ARCHITECTURE_RUNBOOK.md` (complete command reference and ER diagram).
- Recorded execution logs and terminal output traces.

---

## Milestone 4 Gate (Day 20): Final POC Demonstration Sign-Off
> **Quick Summary**: Final stakeholder demonstration proving the complete multi-agent harness, PostgreSQL/pgvector backend, internal product adapter, and autonomous Fabric automation with 100% test pass rate.

### 1. Gate Criteria & Acceptance Tests
1. **100% Pass Rate**: All unit, integration, and E2E scenario test suites passing green.
2. **Live Fabric Verification**: Verified assets visible in `PBT_DATA_AGENT` workspace.
3. **Database Integrity**: Full audit trail and asset lineage verified in PostgreSQL.

---

## Complete 20-Day Task Matrix

| WBS | Phase | Task Name | Architecture Focus | Start | End | Target Deliverable |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **1.1** | Phase 1: DB & pgvector | Master DB Relational Schema Design | Master DB (Postgres) | D1 | D3 | Normalized PostgreSQL tables (`workspaces`, `plans`, `assets`, `audit_logs`) |
| **1.2** | Phase 1: DB & pgvector | PostgreSQL + pgvector Setup | Vector Store (pgvector) | D1 | D3 | Provision Postgres instance with `vector` extension & async connection pool |
| **1.3** | Phase 1: DB & pgvector | Structured Skill Schema Design | Skill DB Design | D2 | D4 | Pydantic Skill model (intents, scopes, parameter models, rules) |
| **1.4** | Phase 1: DB & pgvector | pgvector Table & HNSW Index | Vector Indexing | D3 | D5 | Create `skills` table with `vector(1536)` and HNSW cosine index |
| **1.5** | Phase 1: DB & pgvector | Skill Ingestion & Embedding Pipeline | Embedding Pipeline | D4 | D5 | Ingestion service calculating embeddings and upserting into Postgres |
| **1.6** | Phase 1: DB & pgvector | Ephemeral Task Checkpoint Schema | Task DB (Postgres) | D4 | D5 | LangGraph `PostgresSaver` schema for active run state & checkpoints |
| **M1** | **Phase 1: DB & pgvector** | **★ Gate 1: Storage & Skills Live** | **Milestone Gate** | **D5** | **D5** | **Postgres + pgvector live, skills indexed, SQL vector search verified** |
| **2.1** | Phase 2: Agent Harness | pgvector SQL Semantic Matcher | Skill Matcher Engine | D6 | D8 | SQL cosine distance query (`embedding <=> query_vec`) with $\tau \ge 0.82$ |
| **2.2** | Phase 2: Agent Harness | Granular Fabric Tool Registry | Tool Registry | D6 | D8 | Catalog granular item tools (`Notebook`, `Lakehouse`, `Pipeline`, `Folder`) |
| **2.3** | Phase 2: Agent Harness | Tech Lead / Task Decider Router | Decider Router | D7 | D9 | LangGraph router node: checks Master DB + pgvector skill match |
| **2.4** | Phase 2: Agent Harness | Branch A: Task Organizer | Task Organizer | D8 | D10 | Decomposes matched skill into subtask DAG with prerequisite sequencing |
| **2.5** | Phase 2: Agent Harness | Branch B: Researcher Agent | Researcher Agent | D8 | D10 | Zero-shot fallback: synthesizes tool code & auto-saves skill into Postgres |
| **2.6** | Phase 2: Agent Harness | Execution Plan Master DB Sync | Master DB Sync | D9 | D10 | Persists generated execution DAG with parameters into Master DB (`PLANNED`) |
| **M2** | **Phase 2: Agent Harness** | **★ Gate 2: Routing Verified** | **Milestone Gate** | **D10** | **D10** | **Automated tests verify Skill Hit (Branch A) and Skill Miss (Branch B) paths** |
| **3.1** | Phase 3: Engine & Adapter | Granular Fabric Item Provisioning | Fabric Client Engine | D11 | D13 | 2-phase REST deployment (`create_item` + Base64 `updateDefinition`) |
| **3.2** | Phase 3: Engine & Adapter | Internal Product Adapter Interface | Product Adapter Hook | D12 | D14 | Pluggable adapter contract (`BaseProductAdapter`) to host internal JMAN products |
| **3.3** | Phase 3: Engine & Adapter | Product-to-Fabric Orchestration | Orchestrator Wiring | D13 | D15 | Wire execution path: harness invokes product & provisions to Fabric |
| **3.4** | Phase 3: Engine & Adapter | Self-Healing Debugger Loop | Feedback / Debugger | D13 | D15 | Cyclic LangGraph node: intercepts execution errors, patches & retries |
| **3.5** | Phase 3: Engine & Adapter | Master DB Lineage Hydration | Master DB Hydrator | D14 | D15 | On success, writes deployed item GUIDs, telemetry, and lineage edges to DB |
| **M3** | **Phase 3: Engine & Adapter** | **★ Gate 3: Product Deployment Live** | **Milestone Gate** | **D15** | **D15** | **Deployment of product payload into Fabric with self-healing verified** |
| **4.1** | Phase 4: E2E & Demo | E2E Scenario 1: Known Skill Flow | Product Test Suite | D16 | D17 | Prompt $\to$ pgvector Skill Hit $\to$ Product Parameterization $\to$ Fabric Run |
| **4.2** | Phase 4: E2E & Demo | E2E Scenario 2: Zero-Shot Learning | Product Test Suite | D17 | D18 | Unknown Workflow $\to$ Skill Miss $\to$ Researcher builds tool $\to$ persists to vector |
| **4.3** | Phase 4: E2E & Demo | E2E Scenario 3: Failure & Healing | Product Test Suite | D18 | D19 | Injected error $\to$ Debugger patches config/code $\to$ runs green |
| **4.4** | Phase 4: E2E & Demo | Postgres + pgvector Benchmark | Benchmark Suite | D19 | D20 | Benchmark pgvector cosine search latency (<50ms) and concurrent checkpoints |
| **4.5** | Phase 4: E2E & Demo | Architecture Walkthrough & Demo | POC Demo Assets | D19 | D20 | Prepare headless execution walkthrough, ER diagrams, and demo assets |
| **M4** | **Phase 4: E2E & Demo** | **★ Gate 4: POC Sign-Off & Demo** | **Milestone Gate** | **D20** | **D20** | **Live demonstration of multi-agent harness, pgvector, product, and Fabric** |
"""
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"[SUCCESS] Execution guide written to: {output_file}")

if __name__ == "__main__":
    out = os.path.join(os.getcwd(), "OMNIFLOW_POC_20DAY_EXECUTION_GUIDE.md")
    generate_guide(out)
