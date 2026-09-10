"""
scripts/generate_poc_gantt_chart.py
-----------------------------------
Generates an executive-grade, beautifully styled Excel Gantt chart (.xlsx)
for the 4-Week OmniFlow & Fabric AI POC based on the OmniFlow architecture diagram
and 4-week condensed roadmap focusing on Backend, Databases, Vector DB, Skills, and Fabric Integration.
"""

import os
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

def build_poc_gantt_workbook(output_path: str):
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Styles & Colors (Executive Navy / Indigo / Cyan Palette)
    NAVY_DARK = "1B365D"
    NAVY_MID = "2C5282"
    BLUE_ACCENT = "3182CE"
    CYAN_ACCENT = "00B4D8"
    TEAL_DARK = "007791"
    GRAY_BG = "F7FAFC"
    GRAY_BORDER = "CBD5E0"
    WHITE = "FFFFFF"
    
    # Phase Colors for Gantt Bars
    PHASE_COLORS = {
        "Phase 1: DB, Vector & Knowledge Layer": "3182CE",   # Blue
        "Phase 2: Agent Harness & Decider Routing": "6B46C1", # Purple
        "Phase 3: Fabric Engine & Self-Healing": "DD6B20",    # Amber/Orange
        "Phase 4: E2E Scenarios & Verification": "38A169",    # Green
        "Milestone Gate": "D69E2E",                           # Gold
    }

    STATUS_COLORS = {
        "Planned": ("EBF8FF", "2B6CB0"),
        "In Progress": ("FEFCBF", "B7791F"),
        "Completed": ("C6F6D5", "22543D"),
        "Milestone": ("FED7D7", "9B2C2C"),
    }

    thin_border = Border(
        left=Side(style="thin", color=GRAY_BORDER),
        right=Side(style="thin", color=GRAY_BORDER),
        top=Side(style="thin", color=GRAY_BORDER),
        bottom=Side(style="thin", color=GRAY_BORDER),
    )

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 1: Gantt Chart
    # ══════════════════════════════════════════════════════════════════════════
    ws1 = wb.create_sheet(title="4-Week POC Gantt Chart")
    ws1.views.sheetView[0].showGridLines = True

    # Title Block
    ws1.merge_cells("A1:AE1")
    ws1["A1"] = "OmniFlow Multi-Agent Execution Harness — 4-Week POC Gantt Roadmap"
    ws1["A1"].font = Font(name="Segoe UI", size=16, bold=True, color=WHITE)
    ws1["A1"].fill = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
    ws1["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws1.row_dimensions[1].height = 40

    ws1.merge_cells("A2:AE2")
    ws1["A2"] = "Scope: Core Backend Architecture, Master DB, Vector DB Skill Store, Ephemeral Task DB, Tool Registry & Microsoft Fabric Automation"
    ws1["A2"].font = Font(name="Segoe UI", size=10, italic=True, color="E2E8F0")
    ws1["A2"].fill = PatternFill(start_color=NAVY_MID, end_color=NAVY_MID, fill_type="solid")
    ws1["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws1.row_dimensions[2].height = 24

    # KPI Summary Cards Block (Row 4 to 5)
    kpis = [
        ("TOTAL DURATION", "4 Weeks (20 Days)", "B4:E5", "3182CE"),
        ("CORE FOCUS", "DBs, Vector & Agentic Harness", "F4:K5", "6B46C1"),
        ("TARGET PLATFORM", "Microsoft Fabric (P1/P2 Items)", "L4:P5", "DD6B20"),
        ("KEY SUCCESS METRICS", "100% Autonomous Skill Hit / Miss Flow", "Q4:V5", "38A169"),
        ("UI REQUIREMENT", "Headless / CLI & API Only (No UI)", "W4:AE5", "4A5568"),
    ]
    for label, val, rng, color in kpis:
        ws1.merge_cells(rng)
        top_left = rng.split(":")[0]
        cell = ws1[top_left]
        cell.value = f"{label}\n{val}"
        cell.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws1.row_dimensions[4].height = 18
    ws1.row_dimensions[5].height = 20

    # Headers (Row 7 & 8)
    headers_meta = [
        ("WBS", 6),
        ("Phase", 26),
        ("Task Name", 32),
        ("Architecture Component", 24),
        ("Detailed Deliverables & Engineering Scope", 48),
        ("Owner", 14),
        ("Status", 12),
        ("Start", 7),
        ("End", 7),
        ("Days", 7),
    ]

    # Set Column Widths for Metadata
    for col_idx, (h_name, width) in enumerate(headers_meta, start=1):
        col_letter = get_column_letter(col_idx)
        ws1.column_dimensions[col_letter].width = width

    # Weekly timeline header setup (Cols 11 to 30 -> Day 1 to Day 20)
    # Row 7: Week grouping headers
    week_spans = [
        ("Week 1: Core DBs, Vector Store & Skill Engine", 11, 15),
        ("Week 2: Agent Harness & Task Decider Routing", 16, 20),
        ("Week 3: Code Gen, Fabric Engine & Self-Healing", 21, 25),
        ("Week 4: E2E Integration, Benchmarks & POC Sign-off", 26, 30),
    ]
    for w_title, start_c, end_c in week_spans:
        ws1.merge_cells(start_row=7, start_column=start_c, end_row=7, end_column=end_c)
        cell = ws1.cell(row=7, column=start_c)
        cell.value = w_title
        cell.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=NAVY_MID, end_color=NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # Metadata headers on Row 7 & 8 (Merged vertically)
    for col_idx, (h_name, _) in enumerate(headers_meta, start=1):
        ws1.merge_cells(start_row=7, start_column=col_idx, end_row=8, end_column=col_idx)
        cell = ws1.cell(row=7, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Row 8: Day numbers D1 to D20
    for day in range(1, 21):
        col_idx = 10 + day
        col_letter = get_column_letter(col_idx)
        ws1.column_dimensions[col_letter].width = 4.5
        cell = ws1.cell(row=8, column=col_idx)
        cell.value = f"D{day}"
        cell.font = Font(name="Segoe UI", size=8, bold=True, color="2D3748")
        cell.fill = PatternFill(start_color="EDF2F7", end_color="EDF2F7", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    ws1.row_dimensions[7].height = 22
    ws1.row_dimensions[8].height = 20

    # Task Data Breakdown (3-4 Week POC)
    tasks_data = [
        # Phase 1: DB, Vector & Knowledge Layer (Week 1)
        ("1.1", "Phase 1: DB, Vector & Knowledge Layer", "Master DB Schema & Persistence Engine", "Master DB (Relational)", 
         "Design & deploy relational schema (PostgreSQL/SQLite) for Workspaces, Projects, Master Tasks, Execution Plans, Asset Lineage DAG, and Audit Logs.", "Data Architect", "Completed", 1, 3, 3),
        ("1.2", "Phase 1: DB, Vector & Knowledge Layer", "Vector DB & Embeddings Pipeline Setup", "Vector DB (Chroma/pgvector)", 
         "Setup ChromaDB / pgvector store with text-embedding-3-small for semantic skill search, few-shot prompt storage, and metadata indexing.", "AI Engineer", "Completed", 1, 3, 3),
        ("1.3", "Phase 1: DB, Vector & Knowledge Layer", "Skill Store Schema & Markdown Ingestion", "Skill DB / Vector DB", 
         "Define atomic Skill schema (intent triggers, prompt templates, rule constraints) and bulk-index core Fabric skills into Vector DB.", "AI Engineer", "Completed", 2, 4, 3),
        ("1.4", "Phase 1: DB, Vector & Knowledge Layer", "Semantic Skill Matcher & Cosine Similarity", "Skill Matcher Engine", 
         "Build top-k semantic retrieval with confidence score threshold (tau >= 0.82) to evaluate: 'Do we have skills/instructions in DB?'.", "AI Engineer", "Completed", 3, 5, 3),
        ("1.5", "Phase 1: DB, Vector & Knowledge Layer", "Ephemeral Task DB & Checkpointing State", "Task DB (Intermediate)", 
         "Implement scoped execution session store (LangGraph StateGraph checkpoints) for sub-task tracking, artifact scopes, and temp PySpark scripts.", "Backend Dev", "Completed", 4, 5, 2),
        ("M1", "Phase 1: DB, Vector & Knowledge Layer", "★ MILESTONE 1: Core DBs & Vector Skill Store Operational", "Milestone Gate", 
         "Master DB, Vector DB, Task DB, and Skill semantic search validated with 100% automated test coverage.", "Lead Architect", "Milestone", 5, 5, 1),

        # Phase 2: Agent Harness & Decider Routing (Week 2)
        ("2.1", "Phase 2: Agent Harness & Decider Routing", "Tool Registry & Universal Schema Dispatcher", "Tool Registry", 
         "Catalog priority tools (Lakehouse, Notebook, Pipeline, Shortcuts, TMDL) with strict Pydantic JSON schemas and argument validation.", "Backend Dev", "Planned", 6, 8, 3),
        ("2.2", "Phase 2: Agent Harness & Decider Routing", "Task Decider / Tech Lead Agent", "Decision Router", 
         "LangGraph router node: queries Master DB for historical plans and Vector DB for skill match -> routes to Branch A (Organizer) or Branch B (Researcher).", "AI Engineer", "Planned", 7, 9, 3),
        ("2.3", "Phase 2: Agent Harness & Decider Routing", "Branch A: Task Organizer Agent (Skill Found)", "Task Organizer", 
         "Decomposes request into structured sub-task DAG, enforces prerequisite dependencies, validates credentials, and outputs execution plan.", "AI Engineer", "Planned", 8, 10, 3),
        ("2.4", "Phase 2: Agent Harness & Decider Routing", "Branch B: Researcher & Tool Synthesis Agent (Skill Miss)", "Researcher Agent", 
         "Autonomous fallback: queries OpenAPI specs / schema catalog, dynamically synthesizes missing PySpark/REST code, and stores new skill into Skill DB.", "AI Engineer", "Planned", 8, 10, 3),
        ("2.5", "Phase 2: Agent Harness & Decider Routing", "Plan Serialization & Master DB Sync", "Master DB Sync", 
         "Persists generated execution DAG, parameter bindings, and expected blast-zone into Master DB with status PLANNED.", "Backend Dev", "Planned", 9, 10, 2),
        ("M2", "Phase 2: Agent Harness & Decider Routing", "★ MILESTONE 2: Decider Dual-Branch Routing Verified", "Milestone Gate", 
         "Zero-shot and few-shot skill routing verified via automated integration tests without human intervention.", "Lead Architect", "Milestone", 10, 10, 1),

        # Phase 3: Fabric Engine & Self-Healing (Week 3)
        ("3.1", "Phase 3: Fabric Engine & Self-Healing", "PySpark Medallion & Delta Code Generator", "Content Gen Agent", 
         "Generates production PySpark code: Bronze raw append, Silver MERGE deduplication (SCD-1/2), Gold Kimball star aggregations.", "Data Architect", "Planned", 11, 13, 3),
        ("3.2", "Phase 3: Fabric Engine & Self-Healing", "Direct Lake TMDL & Shortcut Compiler", "Semantic / Shortcut Gen", 
         "Compiles Power BI Direct Lake TMDL models (tables, partitions, DAX measures) and OneLake internal/ADLS/S3 shortcut payloads.", "Data Architect", "Planned", 12, 14, 3),
        ("3.3", "Phase 3: Fabric Engine & Self-Healing", "Universal Fabric REST Execution Engine", "Universal API Engine", 
         "Executes 2-phase deployment (create_item + updateDefinition Base64), polls LRO async operations, and triggers Notebook/Pipeline jobs.", "Backend Dev", "Planned", 13, 15, 3),
        ("3.4", "Phase 3: Fabric Engine & Self-Healing", "Self-Healing Debugger & Feedback Loop", "Feedback/Debugger Agent", 
         "Cyclic self-healer: intercepts execution/compilation errors, parses stack traces, applies targeted AST/code patches, and retries up to 3x.", "AI Engineer", "Planned", 13, 15, 3),
        ("3.5", "Phase 3: Fabric Engine & Self-Healing", "Post-Execution Master DB Hydration", "Master DB Hydrator", 
         "On successful execution, stores live artifact GUIDs, runtime execution duration, lineage edges, and snapshot backups to Master DB.", "Backend Dev", "Planned", 14, 15, 2),
        ("M3", "Phase 3: Fabric Engine & Self-Healing", "★ MILESTONE 3: Autonomous Fabric Deployment & Healing Live", "Milestone Gate", 
         "End-to-end artifact creation in Microsoft Fabric (PBT_DATA_AGENT) with self-healing recovery validated live.", "Lead Architect", "Milestone", 15, 15, 1),

        # Phase 4: E2E Scenarios & Verification (Week 4)
        ("4.1", "Phase 4: E2E Scenarios & Verification", "E2E Test Scenario 1: Known Skill Direct Lake Ingestion", "E2E Test Harness", 
         "Prompt -> Semantic Skill Hit -> Master DB Plan -> Bronze/Silver/Gold Lakehouses + Pipeline deployed & run in Fabric.", "QA / AI Eng", "Planned", 16, 17, 2),
        ("4.2", "Phase 4: E2E Scenarios & Verification", "E2E Test Scenario 2: Zero-Shot Unknown Source (Researcher)", "E2E Test Harness", 
         "Prompt with new schema -> Skill Miss -> Researcher synthesizes new tool -> saves to Skill DB -> executes pipeline in Fabric.", "QA / AI Eng", "Planned", 17, 18, 2),
        ("4.3", "Phase 4: E2E Scenarios & Verification", "E2E Test Scenario 3: Intentional Failure & Self-Healing", "E2E Test Harness", 
         "Inject syntax & schema errors -> Debugger diagnoses error -> generates code fix -> re-deploys successfully.", "QA / AI Eng", "Planned", 18, 19, 2),
        ("4.4", "Phase 4: E2E Scenarios & Verification", "Database & Vector Latency Benchmark", "Benchmark Suite", 
         "Measure sub-100ms vector retrieval, concurrent task state handling in Task DB, and blast-zone graph query performance.", "Backend Dev", "Planned", 18, 19, 2),
        ("4.5", "Phase 4: E2E Scenarios & Verification", "Architecture Runbook & POC Handover Report", "Documentation", 
         "Finalize technical architecture report, ER diagrams, vector search benchmarks, and automated test execution logs.", "Lead Architect", "Planned", 19, 20, 2),
        ("M4", "Phase 4: E2E Scenarios & Verification", "★ FINAL MILESTONE: POC Acceptance & Demo Sign-off", "Milestone Gate", 
         "Full executive demonstration of headless multi-agent harness, Master DB/Vector DB, and autonomous Fabric automation.", "Stakeholders", "Milestone", 20, 20, 1),
    ]

    current_row = 9
    for row_data in tasks_data:
        wbs, phase, task_name, comp, desc, owner, status, start_day, end_day, duration = row_data
        is_milestone = (status == "Milestone")

        ws1.row_dimensions[current_row].height = 24 if is_milestone else 20

        # Cells 1 to 10
        cells = [
            (1, wbs, Alignment(horizontal="center", vertical="center")),
            (2, phase, Alignment(horizontal="left", vertical="center")),
            (3, task_name, Alignment(horizontal="left", vertical="center")),
            (4, comp, Alignment(horizontal="left", vertical="center")),
            (5, desc, Alignment(horizontal="left", vertical="center")),
            (6, owner, Alignment(horizontal="center", vertical="center")),
            (7, status, Alignment(horizontal="center", vertical="center")),
            (8, f"D{start_day}", Alignment(horizontal="center", vertical="center")),
            (9, f"D{end_day}", Alignment(horizontal="center", vertical="center")),
            (10, duration, Alignment(horizontal="center", vertical="center")),
        ]

        row_bg = "FFF5F5" if is_milestone else (GRAY_BG if current_row % 2 == 0 else WHITE)

        for col_idx, val, align in cells:
            cell = ws1.cell(row=current_row, column=col_idx)
            cell.value = val
            cell.alignment = align
            cell.border = thin_border
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")

            if is_milestone:
                cell.font = Font(name="Segoe UI", size=9, bold=True, color="9B2C2C")
            else:
                cell.font = Font(name="Segoe UI", size=9, color="2D3748")

        # Style status tag specifically
        status_cell = ws1.cell(row=current_row, column=7)
        if status in STATUS_COLORS:
            s_bg, s_fg = STATUS_COLORS[status]
            status_cell.fill = PatternFill(start_color=s_bg, end_color=s_bg, fill_type="solid")
            status_cell.font = Font(name="Segoe UI", size=8.5, bold=True, color=s_fg)

        # Timeline Gantt Bars (Cols 11 to 30)
        bar_color = PHASE_COLORS.get(phase, "3182CE")
        for day in range(1, 21):
            col_idx = 10 + day
            bar_cell = ws1.cell(row=current_row, column=col_idx)
            bar_cell.border = thin_border

            if start_day <= day <= end_day:
                if is_milestone:
                    bar_cell.value = "★"
                    bar_cell.font = Font(name="Segoe UI", size=10, bold=True, color="9B2C2C")
                    bar_cell.alignment = Alignment(horizontal="center", vertical="center")
                    bar_cell.fill = PatternFill(start_color="FED7D7", end_color="FED7D7", fill_type="solid")
                else:
                    bar_cell.fill = PatternFill(start_color=bar_color, end_color=bar_color, fill_type="solid")
            else:
                bar_cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")

        current_row += 1

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 2: Architecture Mapping (OmniFlow vs POC Implementation)
    # ══════════════════════════════════════════════════════════════════════════
    ws2 = wb.create_sheet(title="Architecture Mapping")
    ws2.views.sheetView[0].showGridLines = True

    ws2.merge_cells("A1:F1")
    ws2["A1"] = "OmniFlow Architecture Node Mapping -> 4-Week POC Technical Stack"
    ws2["A1"].font = Font(name="Segoe UI", size=14, bold=True, color=WHITE)
    ws2["A1"].fill = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
    ws2["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws2.row_dimensions[1].height = 35

    arch_headers = [
        ("OmniFlow Diagram Node", 26),
        ("Role & Function in Architecture", 32),
        ("Database / Storage Layer Used", 28),
        ("POC Implementation Component", 32),
        ("Technical Stack / Library", 26),
        ("Weekly Milestone", 18),
    ]

    for col_idx, (h_name, width) in enumerate(arch_headers, start=1):
        col_letter = get_column_letter(col_idx)
        ws2.column_dimensions[col_letter].width = width
        cell = ws2.cell(row=3, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9.5, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=NAVY_MID, end_color=NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws2.row_dimensions[3].height = 25

    arch_rows = [
        ("User Prompt / CLI", "Initiates natural language data engineering intent", "Session Cache", "Headless Runner / FastAPI CLI", "Python CLI / Requests", "Week 1"),
        ("Authentication & Session Manager", "Multi-tenant auth & workspace security lock", "Token Cache & Config", "app/auth.py & app/config.py", "Azure Identity / MSAL", "Week 1"),
        ("Tech Lead / Task Decider Agent", "Evaluates if required skill exists in DB", "Vector DB & Master DB", "app/orchestrator/decider.py", "LangGraph Router Node", "Week 2"),
        ("Decision Gate: Skill in DB?", "Branching decision: Similarity score >= 0.82", "Vector DB (ChromaDB)", "Cosine Similarity Matcher", "text-embedding-3-small", "Week 1 - 2"),
        ("Branch A: Task Organizer Agent", "Decomposes known skill into activity DAG", "Task DB (Intermediate)", "app/generators/pipeline_gen.py", "NetworkX DAG / Pydantic", "Week 2"),
        ("Branch B: Researcher Agent", "Dynamic schema inspection & tool authoring", "Skill DB & Tool Registry", "app/orchestrator/researcher.py", "LLM Code Synthesizer", "Week 2"),
        ("Tool Registry", "Dynamic catalog of executable API tools", "In-Memory / SQLite Tool Store", "app/tools/tool_registry.py", "Pydantic Tool Schemas", "Week 2"),
        ("Master Database (Master DB)", "Global persistent storage of assets, plans, lineage", "PostgreSQL / SQLite", "app/session_store.py", "SQLAlchemy / SQLite", "Week 1"),
        ("Vector Database (Vector DB)", "Semantic index for skills, templates & schemas", "ChromaDB / pgvector", "app/memory/vector_store.py", "ChromaDB / NumPy", "Week 1"),
        ("Task DB (Intermediate / Scoped)", "Ephemeral checkpointing for active sub-tasks", "SQLite / Redis", "LangGraph Memory Checkpointer", "LangGraph StateGraph", "Week 1 - 2"),
        ("Skill DB (Skill Store)", "Repository of atomic skill definitions & rules", "Vector DB + Markdown Files", "skills/<skill_name>/SKILL.md", "YAML Frontmatter + AST", "Week 1"),
        ("Content Generation Agent", "Generates PySpark, TMDL, and Pipeline JSON", "Task DB Scratchpad", "app/generators/notebook_gen.py", "SQLGlot / Jinja2", "Week 3"),
        ("Universal API Engine", "Executes REST calls with Base64 inline parts", "Fabric REST APIs", "app/fabric_client.py", "Requests / LRO Poller", "Week 3"),
        ("Continuous Feedback / Debugger", "Self-healing loop on execution failures", "Audit Logs / Task DB", "app/self_healer.py", "LangGraph Cyclic Graph", "Week 3"),
        ("Data Platform (Single Product)", "Target Microsoft Fabric workspace & OneLake", "Microsoft Fabric (OneLake)", "PBT_DATA_AGENT Workspace", "Delta Lake / Fabric REST", "Week 3 - 4"),
    ]

    for idx, r_data in enumerate(arch_rows, start=4):
        ws2.row_dimensions[idx].height = 22
        row_bg = GRAY_BG if idx % 2 == 0 else WHITE
        for c_idx, val in enumerate(r_data, start=1):
            cell = ws2.cell(row=idx, column=c_idx)
            cell.value = val
            cell.font = Font(name="Segoe UI", size=9, color="2D3748")
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left" if c_idx in (1, 2, 4) else "center", vertical="center")

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 3: Database & Vector Specs (The Core POC Focus)
    # ══════════════════════════════════════════════════════════════════════════
    ws3 = wb.create_sheet(title="Database & Vector Specs")
    ws3.views.sheetView[0].showGridLines = True

    ws3.merge_cells("A1:E1")
    ws3["A1"] = "Database & Vector Store Architecture Specifications (POC Core Focus)"
    ws3["A1"].font = Font(name="Segoe UI", size=14, bold=True, color=WHITE)
    ws3["A1"].fill = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
    ws3["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws3.row_dimensions[1].height = 35

    db_headers = [
        ("Storage Layer", 24),
        ("Store Type & Technology", 28),
        ("Key Tables / Collections", 32),
        ("Schema & Key Attributes", 46),
        ("POC Role & Integration Pattern", 36),
    ]

    for col_idx, (h_name, width) in enumerate(db_headers, start=1):
        col_letter = get_column_letter(col_idx)
        ws3.column_dimensions[col_letter].width = width
        cell = ws3.cell(row=3, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9.5, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=NAVY_MID, end_color=NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws3.row_dimensions[3].height = 25

    db_rows = [
        ("Master DB", "Relational (PostgreSQL / SQLite)", "workspaces, projects, master_plans, deployed_assets, audit_logs", 
         "id (UUID PK), workspace_id, plan_dag_json, item_guid, item_type, blast_zone_nodes, execution_time_ms, created_at",
         "Persistent long-term memory. Stores global verified execution plans, asset GUIDs, blast-zone lineage DAG, and audit trails."),
        ("Vector DB", "Vector Embedding Store (ChromaDB / pgvector)", "skills_collection, prompt_templates_collection, schema_catalog_vectors", 
         "id, embedding (1536-dim float), document_text, metadata: {skill_name, trigger_keywords, category, confidence_threshold}",
         "Semantic knowledge retrieval. Computes cosine similarity to answer 'Do we have skills in DB?' and retrieves few-shot templates."),
        ("Task DB (Intermediate)", "Ephemeral State Store (SQLite / Redis)", "active_task_sessions, subtasks, scratch_artifacts", 
         "task_id, session_id, current_step, subtask_statuses (JSON), temp_code_blobs, error_stack, retry_count",
         "Scoped memory for active agent workflow execution. Manages LangGraph state checkpointing and intermediate cell code generation."),
        ("Skill DB (Skill Store)", "File-Backed Vector Hybrid (Markdown + ChromaDB)", ".agents/skills/*/SKILL.md & indexed vectors", 
         "name, description, intent_embeddings, execution_rules, templates (Bronze/Silver/Gold/TMDL/Pipelines)",
         "High-precision rule store. Researcher Agent persists newly synthesized skills here, making them instantly available for future runs."),
        ("Tool Registry", "Dynamic Schema Catalog (Pydantic / SQLite)", "tool_definitions, platform_apis, active_invokers", 
         "tool_name, description, parameters_json_schema, http_endpoint, platform (Fabric/Databricks), auth_scope",
         "Decoupled tool catalog. Standardizes tool invocation contracts so agents can seamlessly invoke Fabric REST APIs."),
    ]

    for idx, r_data in enumerate(db_rows, start=4):
        ws3.row_dimensions[idx].height = 42
        row_bg = GRAY_BG if idx % 2 == 0 else WHITE
        for c_idx, val in enumerate(r_data, start=1):
            cell = ws3.cell(row=idx, column=c_idx)
            cell.value = val
            cell.font = Font(name="Segoe UI", size=9, color="2D3748")
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # ══════════════════════════════════════════════════════════════════════════
    # SHEET 4: Weekly Milestones & Gate Criteria
    # ══════════════════════════════════════════════════════════════════════════
    ws4 = wb.create_sheet(title="Milestones & Gate Criteria")
    ws4.views.sheetView[0].showGridLines = True

    ws4.merge_cells("A1:E1")
    ws4["A1"] = "4-Week POC Weekly Gate Criteria & Success Deliverables"
    ws4["A1"].font = Font(name="Segoe UI", size=14, bold=True, color=WHITE)
    ws4["A1"].fill = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
    ws4["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws4.row_dimensions[1].height = 35

    gate_headers = [
        ("Week & Gate", 16),
        ("Milestone Theme", 30),
        ("Mandatory Technical Deliverables", 48),
        ("Automated Verification Gate / Acceptance Criteria", 44),
        ("Sign-off Role", 18),
    ]

    for col_idx, (h_name, width) in enumerate(gate_headers, start=1):
        col_letter = get_column_letter(col_idx)
        ws4.column_dimensions[col_letter].width = width
        cell = ws4.cell(row=3, column=col_idx)
        cell.value = h_name
        cell.font = Font(name="Segoe UI", size=9.5, bold=True, color=WHITE)
        cell.fill = PatternFill(start_color=NAVY_MID, end_color=NAVY_MID, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border

    ws4.row_dimensions[3].height = 25

    gate_rows = [
        ("Week 1 (Gate 1)", "Core DBs & Vector Skill Store", 
         "1. Master DB schema initialized (projects, plans, lineage DAG).\n2. Vector DB (ChromaDB) running with embedding pipeline.\n3. Skill Store indexed with Fabric Medallion & TMDL skills.\n4. Ephemeral Task DB state checkpointer functional.",
         "Automated test validates Vector DB semantic search returns correct skill for test prompt with cosine similarity >= 0.82 in <100ms.", "Lead Data Architect"),
        ("Week 2 (Gate 2)", "Agent Harness & Decider Dual Routing", 
         "1. Tool Registry active with Priority 1-2 Fabric API schemas.\n2. Task Decider LangGraph node operational.\n3. Branch A (Task Organizer) creates subtask DAGs.\n4. Branch B (Researcher Agent) synthesizes missing tools dynamically.",
         "Integration test confirms both Branch A (known skill) and Branch B (zero-shot unknown skill) produce valid execution DAGs in Master DB.", "AI Engineering Lead"),
        ("Week 3 (Gate 3)", "Fabric Engine & Autonomous Self-Healing", 
         "1. PySpark generator produces valid Bronze/Silver/Gold code.\n2. Direct Lake TMDL & OneLake shortcut compiler functional.\n3. Universal API engine deploys items into PBT_DATA_AGENT.\n4. Debugger self-healing loop patches failed cell errors.",
         "Live headless run deploys Lakehouse, Notebook, and Pipeline into Fabric workspace with 0 manual touches, and recovers from 1 injected syntax bug.", "Principal Backend Dev"),
        ("Week 4 (Gate 4)", "E2E POC Sign-Off & Handover", 
         "1. 3 full E2E execution scenarios verified end-to-end.\n2. Database latency & Vector DB benchmark report.\n3. Technical Architecture Runbook & schema documentation.\n4. Headless execution telemetry recordings.",
         "100% test pass rate across all unit and E2E suites. Executive presentation demonstrating decoupled harness automation in Microsoft Fabric.", "Executive Stakeholders"),
    ]

    for idx, r_data in enumerate(gate_rows, start=4):
        ws4.row_dimensions[idx].height = 55
        row_bg = GRAY_BG if idx % 2 == 0 else WHITE
        for c_idx, val in enumerate(r_data, start=1):
            cell = ws4.cell(row=idx, column=c_idx)
            cell.value = val
            cell.font = Font(name="Segoe UI", size=9, color="2D3748")
            cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left" if c_idx in (2, 3, 4) else "center", vertical="center", wrap_text=True)

    # Save workbook
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wb.save(output_path)
    print(f"[SUCCESS] POC Gantt Chart generated successfully at: {output_path}")

if __name__ == "__main__":
    out_file = os.path.join(os.getcwd(), "OmniFlow_Fabric_POC_4Week_Gantt_Chart.xlsx")
    build_poc_gantt_workbook(out_file)
