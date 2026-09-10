"""
scripts/generate_jman_poc_gantt_v2.py
-------------------------------------
Generates the revised, strictly aligned JMAN OmniFlow 4-Week POC Gantt Chart (.xlsx)
reflecting:
1. PostgreSQL + pgvector (Unified Database & Vector Store, NO SQLite, NO ChromaDB).
2. Upfront DB & Schema Design.
3. Granular Fabric Item Automation (Lakehouse, Notebook, Pipeline, Folder, Environment).
4. Explicit Internal Product Integration (Pluggable Product Adapter & Orchestration).
5. No 'Completed' status (all Planned/Milestone), No Estimated Hours column.
6. Minimal, executive JMAN Dark Navy palette.
"""

import os
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

def create_revised_jman_gantt(output_path: str):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # ── JMAN Color Palette (Clean, Minimal, Professional) ─────────────────────
    JMAN_NAVY_DARK  = "0A2540"  # JMAN Header Navy
    JMAN_NAVY_MID   = "1B365D"  # Subheader & Week Group Navy
    JMAN_BAR_FILL   = "205493"  # Single Consistent Gantt Bar Fill
    JMAN_MILESTONE  = "D9381E"  # Milestone Accent
    BG_LIGHT_GRAY   = "F8FAFC"  # Row alternating fill
    BG_CARD         = "EDF2F7"  # KPI card fill
    BORDER_COLOR    = "CBD5E1"  # Subtle gridlines
    TEXT_DARK       = "1E293B"  # Text color
    WHITE           = "FFFFFF"

    STATUS_STYLES = {
        "Planned":   ("F1F5F9", "475569"),
        "Milestone": ("FEE2E2", "991B1B"),
    }

    thin_border = Border(
        left=Side(style="thin", color=BORDER_COLOR),
        right=Side(style="thin", color=BORDER_COLOR),
        top=Side(style="thin", color=BORDER_COLOR),
        bottom=Side(style="thin", color=BORDER_COLOR),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 1: Gantt Schedule
    # ══════════════════════════════════════════════════════════════════════════
    ws = wb.create_sheet(title="POC Gantt Schedule")
    ws.views.sheetView[0].showGridLines = True

    # Main Title Header
    ws.merge_cells("A1:AB1")
    ws["A1"] = "JMAN GROUP — OmniFlow Multi-Agent Harness & Fabric AI POC"
    ws["A1"].font = Font(name="Segoe UI", size=14, bold=True, color=WHITE)
    ws["A1"].fill = PatternFill(start_color=JMAN_NAVY_DARK, end_color=JMAN_NAVY_DARK, fill_type="solid")
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 36

    # Subtitle / Architectural Note
    ws.merge_cells("A2:AB2")
    ws["A2"] = "4-Week POC Plan | Tech Stack: PostgreSQL + pgvector, FastAPI, LangGraph, Microsoft Fabric & Internal Product Adapter | Capacity: 3 Devs × 2.5 hrs/day"
    ws["A2"].font = Font(name="Segoe UI", size=9, italic=True, color="E2E8F0")
    ws["A2"].fill = PatternFill(start_color=JMAN_NAVY_MID, end_color=JMAN_NAVY_MID, fill_type="solid")
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 22

    # KPI Summary Cards (Row 4 & 5)
    kpis = [
        ("TIMELINE", "4 Weeks (20 Working Days)", "A4:C5"),
        ("DATABASE ENGINE", "PostgreSQL + pgvector (Unified)", "D4:G5"),
        ("ORCHESTRATION", "LangGraph Multi-Agent StateGraph", "H4:L5"),
        ("PLATFORM TARGET", "Microsoft Fabric Granular APIs", "M4:Q5"),
        ("PRODUCT INTEGRATION", "Internal Product Adapter Plugin", "R4:V5"),
        ("DELIVERY FOCUS", "Backend Harness POC Demo", "W4:AB5"),
    ]
    for label, val, rng in kpis:
        ws.merge_cells(rng)
        top_left = rng.split(":")[0]
        cell = ws[top_left]
        cell.value = f"{label}\n{val}"
        cell.font = Font(name="Segoe UI", size=8.5, bold=True, color=JMAN_NAVY_DARK)
        cell.fill = PatternFill(start_color=BG_CARD, end_color=BG_CARD, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.row_dimensions[4].height = 16
    ws.row_dimensions[5].height = 18

    # Metadata Headers (Cols 1 to 8)
    meta_cols = [
        ("WBS", 6),
        ("Phase", 24),
        ("Task Name", 28),
        ("Architecture Focus", 22),
        ("Key Technical Deliverable", 44),
        ("Status", 11),
        ("Start", 6),
        ("End", 6),
    ]

    for col_idx, (h_name, width) in enumerate(meta_cols, start=1):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width
        ws.merge_cells(start_row=7, start_column=col_idx, end_row=8, end_column=col_idx)
        cell = ws.cell(row=7, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=JMAN_NAVY_DARK, end_color=JMAN_NAVY_DARK, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Week Grouping Headers (Cols 9 to 28 -> Days 1 to 20)
    week_groups = [
        ("Week 1: Postgres, pgvector & Skill Schema Design", 9, 13),
        ("Week 2: Semantic Router, Agent Harness & Tool Registry", 14, 18),
        ("Week 3: Granular Fabric Engine & Product Adapter", 19, 23),
        ("Week 4: E2E Integration, Benchmarks & POC Demo", 24, 28),
    ]
    for w_title, start_c, end_c in week_groups:
        ws.merge_cells(start_row=7, start_column=start_c, end_row=7, end_column=end_c)
        cell = ws.cell(row=7, column=start_c)
        cell.value = w_title
        cell.font = Font(name="Segoe UI", size=8.5, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=JMAN_NAVY_MID, end_color=JMAN_NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Day Columns D1..D20
    for d in range(1, 21):
        col_idx = 8 + d
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = 4.2
        cell = ws.cell(row=8, column=col_idx)
        cell.value = f"D{d}"
        cell.font = Font(name="Segoe UI", size=8, bold=True, color=TEXT_DARK)
        cell.fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    ws.row_dimensions[7].height = 20
    ws.row_dimensions[8].height = 18

    # Task Rows (Refined for PostgreSQL + pgvector, Schema Design, Product Integration, Granular Automation)
    tasks = [
        # Phase 1: DB & pgvector Schema Design & Storage Engine (Week 1)
        ("1.1", "Phase 1: DB & pgvector Layer", "Master DB Relational Schema Design", "Master DB (Postgres)", 
         "Design normalized PostgreSQL schema for workspaces, master execution plans, asset lineage DAG, and audit logs.", "Planned", 1, 3),
        ("1.2", "Phase 1: DB & pgvector Layer", "PostgreSQL + pgvector Infrastructure Setup", "Vector Store (pgvector)", 
         "Provision PostgreSQL with pgvector extension; create vector tables (1536-dim embeddings) and HNSW cosine index.", "Planned", 1, 3),
        ("1.3", "Phase 1: DB & pgvector Layer", "Structured Skill Schema & Representation Design", "Skill DB Design", 
         "Design structured Skill schema (trigger intents, operation scopes, parameter models, preconditions, and embedding chunks).", "Planned", 2, 4),
        ("1.4", "Phase 1: DB & pgvector Layer", "Skill Ingestion & pgvector Embedding Pipeline", "Embedding Pipeline", 
         "Pipeline to ingest structured skill definitions into PostgreSQL with generated vector embeddings and metadata tags.", "Planned", 3, 5),
        ("1.5", "Phase 1: DB & pgvector Layer", "Ephemeral Task & Checkpoint State Schema", "Task DB (Postgres)", 
         "Design LangGraph session state schema (PostgresSaver / JSONB checkpoints) for active run state and subtask tracking.", "Planned", 4, 5),
        ("M1",  "Phase 1: DB & pgvector Layer", "★ Gate 1: Postgres + pgvector Storage Live", "Milestone", 
         "Database schema migrated, skills indexed with pgvector, and SQL vector similarity queries verified.", "Milestone", 5, 5),

        # Phase 2: Agent Harness & Dual-Branch Router (Week 2)
        ("2.1", "Phase 2: Agent Harness & Router", "pgvector Semantic Skill Matcher", "Skill Matcher Engine", 
         "Implement SQL-based cosine distance matching (embedding <=> query_vec) with confidence threshold gate (τ >= 0.82).", "Planned", 6, 8),
        ("2.2", "Phase 2: Agent Harness & Router", "Granular Fabric Tool Registry", "Tool Registry", 
         "Catalog granular Fabric item tools (Notebook, Lakehouse, Pipeline, Folder, Environment) with Pydantic JSON schemas.", "Planned", 6, 8),
        ("2.3", "Phase 2: Agent Harness & Router", "Tech Lead / Task Decider Router Node", "Decider Router", 
         "LangGraph router node: queries Master DB for historical plans and pgvector for skill match -> routes to Branch A or B.", "Planned", 7, 9),
        ("2.4", "Phase 2: Agent Harness & Router", "Branch A: Task Organizer (DAG Planner)", "Task Organizer", 
         "Decomposes matched skill into structured subtask DAG with prerequisite sequencing and parameter bindings.", "Planned", 8, 10),
        ("2.5", "Phase 2: Agent Harness & Router", "Branch B: Researcher & Dynamic Tool Synthesis", "Researcher Agent", 
         "Fallback for novel requests: inspects schemas, synthesizes tool code, and persists new skill + vector into Postgres.", "Planned", 8, 10),
        ("2.6", "Phase 2: Agent Harness & Router", "Execution Plan Master DB Sync", "Master DB Sync", 
         "Persists generated execution DAG with parameters and expected blast-zone into Master DB with status PLANNED.", "Planned", 9, 10),
        ("M2",  "Phase 2: Agent Harness & Router", "★ Gate 2: Dual-Branch Routing Verified", "Milestone", 
         "Automated tests verify Skill Hit (Branch A) and Skill Miss / Dynamic Synthesis (Branch B) execution paths.", "Milestone", 10, 10),

        # Phase 3: Granular Fabric Engine & Product Adapter (Week 3)
        ("3.1", "Phase 3: Fabric Engine & Adapter", "Granular Fabric Item Provisioning Engine", "Fabric Client Engine", 
         "Execute 2-phase deployment (create_item + updateDefinition Base64) for Lakehouses, Notebooks, Pipelines, Environments.", "Planned", 11, 13),
        ("3.2", "Phase 3: Fabric Engine & Adapter", "Internal Product Adapter Interface", "Product Adapter Hook", 
         "Build pluggable adapter contract (BaseProductAdapter) allowing internal JMAN products to be parameterized as sub-agents.", "Planned", 12, 14),
        ("3.3", "Phase 3: Fabric Engine & Adapter", "Product-to-Fabric Orchestration Wiring", "Orchestrator Wiring", 
         "Wire execution path where harness invokes internal product, captures output artifacts, and provisions them into Fabric.", "Planned", 13, 15),
        ("3.4", "Phase 3: Fabric Engine & Adapter", "Self-Healing Debugger Loop", "Feedback / Debugger", 
         "Cyclic LangGraph node: intercepts Fabric/Product execution errors, parses stack traces, patches payloads, and retries.", "Planned", 13, 15),
        ("3.5", "Phase 3: Fabric Engine & Adapter", "Post-Execution Master DB Lineage Hydration", "Master DB Hydrator", 
         "On successful run, updates Master DB with live item GUIDs, execution telemetry, and lineage DAG edges.", "Planned", 14, 15),
        ("M3",  "Phase 3: Fabric Engine & Adapter", "★ Gate 3: Integrated Product Deployment Live", "Milestone", 
         "Autonomous deployment of internal product payload into Microsoft Fabric with self-healing recovery verified.", "Milestone", 15, 15),

        # Phase 4: E2E Scenarios, Benchmarks & POC Demo (Week 4)
        ("4.1", "Phase 4: E2E Scenarios & Demo", "E2E Scenario 1: Known Skill + Product Orchestration", "E2E Test Suite", 
         "Prompt -> pgvector Skill Hit -> Product Parameterization -> Granular Fabric Deployment & Pipeline Run.", "Planned", 16, 17),
        ("4.2", "Phase 4: E2E Scenarios & Demo", "E2E Scenario 2: Zero-Shot Skill Synthesis & Persistence", "E2E Test Suite", 
         "Unknown Workflow -> Skill Miss -> Researcher builds tool -> persists to pgvector -> second run hits vector store.", "Planned", 17, 18),
        ("4.3", "Phase 4: E2E Scenarios & Demo", "E2E Scenario 3: Execution Failure & Self-Healing", "E2E Test Suite", 
         "Injected error during product execution -> Debugger patches config/code -> re-runs and successfully deploys.", "Planned", 18, 19),
        ("4.4", "Phase 4: E2E Scenarios & Demo", "Postgres + pgvector Latency & Lineage Benchmark", "Benchmark Suite", 
         "Benchmark pgvector cosine similarity search (<50ms), concurrent session checkpoints, and lineage graph queries.", "Planned", 19, 20),
        ("4.5", "Phase 4: E2E Scenarios & Demo", "Architecture Walkthrough & POC Demonstration", "POC Demo Assets", 
         "Prepare headless execution walkthrough, database ER diagrams, and live demonstration for stakeholders.", "Planned", 19, 20),
        ("M4",  "Phase 4: E2E Scenarios & Demo", "★ Final Gate: POC Demonstration Sign-Off", "Milestone", 
         "Live demonstration of multi-agent harness, pgvector skill retrieval, internal product integration, and Fabric automation.", "Milestone", 20, 20),
    ]

    curr_row = 9
    for row_item in tasks:
        wbs, phase, t_name, focus, deliverable, status, s_day, e_day = row_item
        is_m = (status == "Milestone")

        ws.row_dimensions[curr_row].height = 22 if is_m else 19
        row_bg = "FFF5F5" if is_m else (BG_LIGHT_GRAY if curr_row % 2 == 0 else WHITE)

        meta_values = [
            (1, wbs, Alignment(horizontal="center", vertical="center")),
            (2, phase, Alignment(horizontal="left", vertical="center")),
            (3, t_name, Alignment(horizontal="left", vertical="center")),
            (4, focus, Alignment(horizontal="left", vertical="center")),
            (5, deliverable, Alignment(horizontal="left", vertical="center")),
            (6, status, Alignment(horizontal="center", vertical="center")),
            (7, f"D{s_day}", Alignment(horizontal="center", vertical="center")),
            (8, f"D{e_day}", Alignment(horizontal="center", vertical="center")),
        ]

        for c_idx, val, align in meta_values:
            cell = ws.cell(row=curr_row, column=c_idx)
            cell.value = val
            cell.alignment = align
            cell.border = thin_border
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")

            if is_m:
                cell.font = Font(name="Segoe UI", size=8.5, bold=True, color=JMAN_MILESTONE)
            else:
                cell.font = Font(name="Segoe UI", size=8.5, color=TEXT_DARK)

        # Status styling
        s_cell = ws.cell(row=curr_row, column=6)
        if status in STATUS_STYLES:
            s_bg, s_fg = STATUS_STYLES[status]
            s_cell.fill = PatternFill(start_color=s_bg, end_color=s_bg, fill_type="solid")
            s_cell.font = Font(name="Segoe UI", size=8, bold=True, color=s_fg)

        # Gantt Timeline Bars (Cols 9 to 28)
        for day in range(1, 21):
            col_idx = 8 + day
            bar_cell = ws.cell(row=curr_row, column=col_idx)
            bar_cell.border = thin_border

            if s_day <= day <= e_day:
                if is_m:
                    bar_cell.value = "★"
                    bar_cell.font = Font(name="Segoe UI", size=9, bold=True, color=JMAN_MILESTONE)
                    bar_cell.alignment = Alignment(horizontal="center", vertical="center")
                    bar_cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                else:
                    bar_cell.fill = PatternFill(start_color=JMAN_BAR_FILL, end_color=JMAN_BAR_FILL, fill_type="solid")
            else:
                bar_cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")

        curr_row += 1

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 2: PostgreSQL & pgvector Schema Design
    # ══════════════════════════════════════════════════════════════════════════
    ws2 = wb.create_sheet(title="Postgres & pgvector Schemas")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells("A1:E1")
    ws2["A1"] = "Unified PostgreSQL + pgvector Architecture & Table Specifications"
    ws2["A1"].font = Font(name="Segoe UI", size=13, bold=True, color=WHITE)
    ws2["A1"].fill = PatternFill(start_color=JMAN_NAVY_DARK, end_color=JMAN_NAVY_DARK, fill_type="solid")
    ws2["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws2.row_dimensions[1].height = 32

    schema_headers = [
        ("Table Name", 24),
        ("Storage Classification", 24),
        ("Column Definitions & Data Types", 46),
        ("Index / Vector Search Strategy", 32),
        ("Architectural Role in OmniFlow", 38),
    ]

    for col_idx, (h_name, width) in enumerate(schema_headers, start=1):
        col_letter = get_column_letter(col_idx)
        ws2.column_dimensions[col_letter].width = width
        cell = ws2.cell(row=3, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=JMAN_NAVY_MID, end_color=JMAN_NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws2.row_dimensions[3].height = 24

    schema_rows = [
        ("skills", "Vector Store (pgvector)", 
         "id (UUID PK), skill_name (VARCHAR), description (TEXT), trigger_intent (TEXT), embedding (vector(1536)), rules_json (JSONB), created_at",
         "HNSW Index on embedding (vector_cosine_ops, m=16, ef_construction=64)",
         "Stores structured skill definitions. Used by Task Decider for cosine distance lookup (embedding <=> query_vec)."),
        
        ("master_plans", "Relational (Master DB)", 
         "id (UUID PK), workspace_id (UUID), prompt_raw (TEXT), matched_skill_id (UUID FK), plan_dag (JSONB), status (VARCHAR), duration_ms, created_at",
         "B-Tree on (workspace_id, status), GIN index on plan_dag",
         "Stores validated execution DAGs, parameter bindings, and historical run status for query reuse."),
        
        ("deployed_assets", "Relational (Master DB)", 
         "id (UUID PK), plan_id (UUID FK), item_guid (UUID), item_name (VARCHAR), item_type (VARCHAR), parent_folder_id (UUID), metadata (JSONB)",
         "B-Tree on item_guid, (workspace_id, item_type)",
         "Persistent catalog of live Fabric items provisioned by the harness (Lakehouses, Notebooks, Pipelines)."),
        
        ("task_checkpoints", "Ephemeral State (Task DB)", 
         "task_id (VARCHAR PK), session_id (VARCHAR), checkpoint_seq (INT), state_json (JSONB), subtask_statuses (JSONB), updated_at",
         "B-Tree on (task_id, checkpoint_seq DESC)",
         "PostgresSaver checkpoint store for LangGraph active workflow state, intermediate code blobs, and error stacks."),
        
        ("audit_logs", "Relational Audit (Master DB)", 
         "id (BIGSERIAL PK), task_id (VARCHAR), event_type (VARCHAR), payload (JSONB), error_message (TEXT), execution_timestamp (TIMESTAMPTZ)",
         "BRIN / B-Tree on execution_timestamp",
         "Immutable telemetry and error trace logs for self-healing diagnostics and run audits."),
    ]

    for idx, r_data in enumerate(schema_rows, start=4):
        ws2.row_dimensions[idx].height = 44
        row_bg = BG_LIGHT_GRAY if idx % 2 == 0 else WHITE
        for c_idx, val in enumerate(r_data, start=1):
            cell = ws2.cell(row=idx, column=c_idx)
            cell.value = val
            cell.font = Font(name="Segoe UI", size=8.5, color=TEXT_DARK)
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wb.save(output_path)
    print(f"[SUCCESS] Revised JMAN Gantt generated at: {output_path}")

if __name__ == "__main__":
    out_path = os.path.join(os.getcwd(), "OmniFlow_JMAN_POC_Gantt_Schedule.xlsx")
    create_revised_jman_gantt(out_path)
