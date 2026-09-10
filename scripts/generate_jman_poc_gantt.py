"""
scripts/generate_jman_poc_gantt.py
----------------------------------
Generates a clean, simplified, executive-styled Excel Gantt Chart
following the JMAN Group brand color schema (Deep Navy Blue #002B49 / #0F2042 / #1B365D).
Designed for a 3-person team working 2-3 hours/day (total ~35-40 hrs/week, 150 hrs POC).
"""

import os
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

def create_jman_gantt(output_path: str):
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default sheet

    # ── JMAN Group Color Palette ──────────────────────────────────────────────
    JMAN_NAVY_DARK  = "0A2540"  # Header Primary Navy
    JMAN_NAVY_MID   = "1B365D"  # Sub-header / Week Band
    JMAN_BLUE_BAR   = "205493"  # Gantt Bar Fill
    JMAN_MILESTONE  = "D9381E"  # Milestone Red/Accent
    BG_LIGHT_GRAY   = "F8FAFC"  # Zebra stripe light background
    BG_CARD         = "EDF2F7"  # KPI card background
    BORDER_COLOR    = "CBD5E1"  # Subtle border
    TEXT_DARK       = "1E293B"  # Primary text
    TEXT_MUTED      = "64748B"  # Muted secondary text
    WHITE           = "FFFFFF"

    # Status fills (Minimal, clean)
    STATUS_STYLES = {
        "Planned":     ("F1F5F9", "475569"),
        "In Progress": ("FEF3C7", "92400E"),
        "Completed":   ("DCFCE7", "166534"),
        "Milestone":   ("FEE2E2", "991B1B"),
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

    # Main Title
    ws.merge_cells("A1:AC1")
    ws["A1"] = "JMAN GROUP — OmniFlow Multi-Agent Harness & Fabric AI POC"
    ws["A1"].font = Font(name="Segoe UI", size=15, bold=True, color=WHITE)
    ws["A1"].fill = PatternFill(start_color=JMAN_NAVY_DARK, end_color=JMAN_NAVY_DARK, fill_type="solid")
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 36

    # Subtitle / Capacity Note
    ws.merge_cells("A2:AC2")
    ws["A2"] = "4-Week POC Plan | Team Capacity: 3 Engineers × 2.5 hrs/day (~37.5 hrs/week | ~150 hrs total) | Scope: Backend, DBs, Vector DB, Skills & Fabric Engine"
    ws["A2"].font = Font(name="Segoe UI", size=9.5, italic=True, color="E2E8F0")
    ws["A2"].fill = PatternFill(start_color=JMAN_NAVY_MID, end_color=JMAN_NAVY_MID, fill_type="solid")
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 22

    # KPI Summary Cards (Row 4 & 5)
    kpis = [
        ("DURATION", "4 Weeks (20 Days)", "A4:D5"),
        ("TEAM CAPACITY", "3 Devs × 2.5 hrs/day (150 hrs)", "E4:I5"),
        ("CORE STORAGE", "Master DB + Vector DB + Task DB", "J4:N5"),
        ("INTEGRATIONS", "Fabric REST + Pluggable Product Hook", "O4:S5"),
        ("FRONTEND / UI", "Headless / REST & CLI (No UI required)", "T4:AC5"),
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

    # Metadata Headers (Cols 1 to 9)
    meta_cols = [
        ("WBS", 6),
        ("Phase", 24),
        ("Task Name", 28),
        ("Architecture Focus", 20),
        ("Key Technical Deliverable", 42),
        ("Est. Hours", 11),
        ("Status", 12),
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

    # Week Grouping Headers (Cols 10 to 29 -> Days 1 to 20)
    week_groups = [
        ("Week 1: Core DBs, Vector Store & Skills", 10, 14),
        ("Week 2: Agent Harness & Decider Router", 15, 19),
        ("Week 3: Code Gen, Fabric Engine & Healing", 20, 24),
        ("Week 4: E2E Scenarios & Verification", 25, 29),
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
        col_idx = 9 + d
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

    # Realistic Task Rows
    tasks = [
        # Week 1
        ("1.1", "Phase 1: DB & Vector Layer", "Master DB Schema & SQLite Store", "Master DB", "Relational schema (workspaces, plans, assets, audit_logs)", "8 hrs", "Completed", 1, 3),
        ("1.2", "Phase 1: DB & Vector Layer", "Vector DB Setup & Embedding Pipeline", "Vector DB", "ChromaDB store with embeddings indexer for skill definitions", "8 hrs", "Completed", 1, 3),
        ("1.3", "Phase 1: DB & Vector Layer", "Skill Store Ingestion & Schema", "Skill DB", "Atomic skill Markdown ingest (.agents/skills) into Vector DB", "8 hrs", "Completed", 2, 4),
        ("1.4", "Phase 1: DB & Vector Layer", "Semantic Skill Matcher (τ ≥ 0.82)", "Skill Matcher", "Cosine similarity search answering: 'Do we have skill in DB?'", "8 hrs", "Completed", 3, 5),
        ("1.5", "Phase 1: DB & Vector Layer", "Task DB (Ephemeral Scoped State)", "Task DB", "LangGraph state checkpointing store for active runs & subtasks", "8 hrs", "Completed", 4, 5),
        ("M1",  "Phase 1: DB & Vector Layer", "★ Gate 1: DBs & Vector Skill Store Verified", "Milestone", "100% automated test pass on Vector DB search & Master DB CRUD", "4 hrs", "Milestone", 5, 5),

        # Week 2
        ("2.1", "Phase 2: Agent Harness", "Tool Registry & Dispatcher", "Tool Registry", "Standardized JSON Schema catalog wrapping platform API endpoints", "8 hrs", "Planned", 6, 8),
        ("2.2", "Phase 2: Agent Harness", "Tech Lead / Task Decider Node", "Decider Router", "LangGraph router node: queries Master DB & Vector DB for skill match", "8 hrs", "Planned", 7, 9),
        ("2.3", "Phase 2: Agent Harness", "Branch A: Task Organizer Agent", "Task Organizer", "Decomposes known skill into subtask DAG & dependency sequence", "8 hrs", "Planned", 8, 10),
        ("2.4", "Phase 2: Agent Harness", "Branch B: Researcher Agent", "Researcher Agent", "Dynamic schema inspector & tool author; saves new skill to Skill DB", "8 hrs", "Planned", 8, 10),
        ("2.5", "Phase 2: Agent Harness", "Execution Plan Master DB Sync", "Master DB Sync", "Persists generated execution graph with status PLANNED to DB", "4 hrs", "Planned", 9, 10),
        ("M2",  "Phase 2: Agent Harness", "★ Gate 2: Dual-Branch Routing Live", "Milestone", "Automated test verifies both Skill Hit and Skill Miss fallback paths", "4 hrs", "Milestone", 10, 10),

        # Week 3
        ("3.1", "Phase 3: Engine & Self-Healing", "Medallion PySpark & TMDL Gen", "Content Gen", "Bronze raw ingest, Silver MERGE, Gold star, Direct Lake TMDL", "8 hrs", "Planned", 11, 13),
        ("3.2", "Phase 3: Engine & Self-Healing", "Universal Fabric REST Engine", "Fabric Client", "2-phase item provisioner (create_item + updateDefinition Base64)", "8 hrs", "Planned", 12, 14),
        ("3.3", "Phase 3: Engine & Self-Healing", "Pluggable Internal Product Hook", "Product Adapter", "Generic adapter interface to host internal JMAN tools as sub-agents", "8 hrs", "Planned", 13, 15),
        ("3.4", "Phase 3: Engine & Self-Healing", "Self-Healing Debugger Loop", "Debugger Agent", "Cyclic error interceptor: parses stack trace, patches code, retries", "10 hrs", "Planned", 13, 15),
        ("M3",  "Phase 3: Engine & Self-Healing", "★ Gate 3: Autonomous Fabric Deploy & Heal", "Milestone", "Headless deployment to Fabric workspace with self-healing recovery", "4 hrs", "Milestone", 15, 15),

        # Week 4
        ("4.1", "Phase 4: E2E Verification", "Scenario 1: Known Skill Ingestion", "E2E Test Suite", "Prompt -> Semantic Skill Hit -> Lakehouse & Pipeline run in Fabric", "8 hrs", "Planned", 16, 17),
        ("4.2", "Phase 4: E2E Verification", "Scenario 2: Zero-Shot Researcher Fallback", "E2E Test Suite", "Unknown Schema -> Skill Miss -> Researcher builds & saves skill -> runs", "8 hrs", "Planned", 17, 18),
        ("4.3", "Phase 4: E2E Verification", "Scenario 3: Error Injection & Self-Heal", "E2E Test Suite", "Inject syntax error -> Debugger patches code -> successful execution", "7 hrs", "Planned", 18, 19),
        ("4.4", "Phase 4: E2E Verification", "Storage Benchmark & Architecture Runbook", "Documentation", "Vector retrieval latency benchmark (<100ms) & technical runbook", "8 hrs", "Planned", 19, 20),
        ("M4",  "Phase 4: E2E Verification", "★ Final Gate: POC Sign-Off & Demo", "Milestone", "Complete headless multi-agent harness verified with 100% test pass", "4 hrs", "Milestone", 20, 20),
    ]

    curr_row = 9
    for row_item in tasks:
        wbs, phase, t_name, focus, deliverable, est_hrs, status, s_day, e_day = row_item
        is_m = (status == "Milestone")

        ws.row_dimensions[curr_row].height = 22 if is_m else 19
        row_bg = "FFF5F5" if is_m else (BG_LIGHT_GRAY if curr_row % 2 == 0 else WHITE)

        meta_values = [
            (1, wbs, Alignment(horizontal="center", vertical="center")),
            (2, phase, Alignment(horizontal="left", vertical="center")),
            (3, t_name, Alignment(horizontal="left", vertical="center")),
            (4, focus, Alignment(horizontal="left", vertical="center")),
            (5, deliverable, Alignment(horizontal="left", vertical="center")),
            (6, est_hrs, Alignment(horizontal="center", vertical="center")),
            (7, status, Alignment(horizontal="center", vertical="center")),
            (8, f"D{s_day}", Alignment(horizontal="center", vertical="center")),
            (9, f"D{e_day}", Alignment(horizontal="center", vertical="center")),
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

        # Status Tag
        s_cell = ws.cell(row=curr_row, column=7)
        if status in STATUS_STYLES:
            s_bg, s_fg = STATUS_STYLES[status]
            s_cell.fill = PatternFill(start_color=s_bg, end_color=s_bg, fill_type="solid")
            s_cell.font = Font(name="Segoe UI", size=8, bold=True, color=s_fg)

        # Gantt Timeline Bars (Cols 10 to 29)
        for day in range(1, 21):
            col_idx = 9 + day
            bar_cell = ws.cell(row=curr_row, column=col_idx)
            bar_cell.border = thin_border

            if s_day <= day <= e_day:
                if is_m:
                    bar_cell.value = "★"
                    bar_cell.font = Font(name="Segoe UI", size=9, bold=True, color=JMAN_MILESTONE)
                    bar_cell.alignment = Alignment(horizontal="center", vertical="center")
                    bar_cell.fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
                else:
                    bar_cell.fill = PatternFill(start_color=JMAN_BLUE_BAR, end_color=JMAN_BLUE_BAR, fill_type="solid")
            else:
                bar_cell.fill = PatternFill(start_color=row_bg, end_color=row_bg, fill_type="solid")

        curr_row += 1

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wb.save(output_path)
    print(f"[SUCCESS] JMAN POC Gantt Chart generated at: {output_path}")

if __name__ == "__main__":
    out_path = os.path.join(os.getcwd(), "JMAN_OmniFlow_POC_Gantt_Chart.xlsx")
    create_jman_gantt(out_path)
