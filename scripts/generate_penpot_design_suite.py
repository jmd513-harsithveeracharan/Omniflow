"""
generate_penpot_design_suite.py — Automated Penpot UI Generation Suite
----------------------------------------------------------------------
Constructs the complete Fabric AI Studio design system and artboards:
1. Board 1: Master Agent Workbench (Chat, Sidebar, Streaming Timeline, 4-Stage Card)
2. Board 2: Medallion DAG Visualizer (Source -> Bronze -> Silver -> Gold + Pipeline)
3. Board 3: Governance & Modals (Blast-Radius Confirmation, Monaco PySpark Viewer, Zero-Leak Vault)
4. Board 4: UI Atoms & Design System Component Library
"""

import json
import time
import requests

REPL_URL = "http://localhost:4403/execute"

PENPOT_JS_CODE = """
(() => {
    const page = penpot.currentPage;
    if (!page) return { error: "No active page found in Penpot" };

    // Clean existing shapes if any
    // Helper color palette
    const C = {
        bgBase: "#131314",
        bgSidebar: "#131314",
        bgSurface: "#1e1f20",
        bgSurfaceRaised: "#282a2c",
        bgCard: "#1e1f20",
        borderSubtle: "#2d2e31",
        borderCard: "#333538",
        emerald: "#10b981",
        emeraldGlow: "#059669",
        cyan: "#06b6d4",
        indigo: "#6366f1",
        amber: "#f59e0b",
        rose: "#f28b82",
        textPrimary: "#e3e3e3",
        textSecondary: "#c4c7c5",
        textMuted: "#8e918f",
        white: "#ffffff"
    };

    // Helper: create rect
    function makeRect(parent, x, y, w, h, fill, radius = 8, stroke = null, strokeW = 1) {
        const r = penpot.createRectangle();
        r.x = x; r.y = y;
        r.resize(w, h);
        if (fill) r.fills = [{ fillColor: fill }];
        else r.fills = [];
        if (radius) r.borderRadius = radius;
        if (stroke) {
            r.strokes = [{ strokeColor: stroke, strokeWidth: strokeW, strokeStyle: "solid", strokeAlignment: "center" }];
        }
        parent.appendChild(r);
        return r;
    }

    // Helper: create text
    function makeText(parent, x, y, str, size = 13, fill = C.textPrimary, bold = false) {
        const t = penpot.createText(str);
        if (!t) return null;
        t.x = x; t.y = y;
        t.fontSize = String(size);
        t.fills = [{ fillColor: fill }];
        parent.appendChild(t);
        return t;
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 1: MASTER AGENT WORKBENCH (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b1 = penpot.createBoard();
    b1.name = "01 — Fabric AI Studio Master Workbench";
    b1.x = 0; b1.y = 0;
    b1.resize(1440, 900);
    b1.fills = [{ fillColor: C.bgBase }];

    // Left Sidebar (260px)
    makeRect(b1, 0, 0, 260, 900, C.bgSidebar, 0, C.borderSubtle, 1);
    
    // Brand Header
    makeRect(b1, 16, 16, 228, 44, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeRect(b1, 26, 24, 28, 28, C.emerald, 8);
    makeText(b1, 62, 28, "Fabric.AI Studio", 14, C.textPrimary, true);
    
    // New Chat Button
    makeRect(b1, 16, 76, 228, 40, C.emerald, 10);
    makeText(b1, 80, 87, "+ New Chat", 13, C.bgBase, true);

    // Nav Items
    const navs = ["📁  Projects", "⚡  Skills & Engine", "🏛️  Workspaces & OneLake", "🔌  Apps & Connectors", "⚙️  Customize & Vault"];
    navs.forEach((item, idx) => {
        makeRect(b1, 16, 130 + idx * 40, 228, 34, C.bgSurface, 8);
        makeText(b1, 30, 138 + idx * 40, item, 12, C.textSecondary);
    });

    // Recent Chats Header & Items
    makeText(b1, 20, 350, "RECENT CHATS", 11, C.textMuted, true);
    const chats = ["Enterprise Retail Medallion", "FinTech Risk Delta Lake", "SAP Sales Nightly Pipeline", "Customer 360 Reconciliation"];
    chats.forEach((c, idx) => {
        makeRect(b1, 16, 375 + idx * 36, 228, 30, idx === 0 ? C.bgSurfaceRaised : "transparent", 6);
        makeText(b1, 28, 382 + idx * 36, c, 12, idx === 0 ? C.emerald : C.textSecondary);
    });

    // Topbar
    makeRect(b1, 260, 0, 1180, 56, C.bgBase, 0, C.borderSubtle, 1);
    makeText(b1, 285, 18, "Workspace: PBT_DATA_AGENT", 14, C.textPrimary, true);
    makeRect(b1, 1180, 12, 200, 32, C.bgSurfaceRaised, 16, C.borderCard, 1);
    makeText(b1, 1205, 20, "🟢 OneLake Connected", 12, C.emerald);

    // Chat Message Container (User Message)
    makeRect(b1, 360, 90, 800, 70, C.bgSurfaceRaised, 16, C.borderCard, 1);
    makeText(b1, 385, 105, "👤 User Directive", 11, C.textMuted, true);
    makeText(b1, 385, 125, "Architect a 3-tier Medallion lakehouse for CustomerDB with nightly incremental Delta MERGE", 13, C.textPrimary);

    // 4-Stage Multi-Agent Execution Card (Assistant Output)
    makeRect(b1, 360, 180, 800, 480, C.bgSurface, 18, C.emerald, 1.5);
    makeRect(b1, 360, 180, 800, 50, C.bgSurfaceRaised, 18);
    makeText(b1, 385, 195, "⚡ Multi-Agent Forward Chaining Engine", 14, C.emerald, true);
    makeRect(b1, 1020, 190, 120, 30, C.emerald, 15);
    makeText(b1, 1035, 197, "RUNNING (11.2s)", 11, C.bgBase, true);

    // Stage 1: Meta-Planner
    makeRect(b1, 385, 250, 750, 60, C.bgBase, 10, C.borderCard, 1);
    makeText(b1, 405, 260, "🗺️ Stage 1: Meta-Planner & Strategy Classifier", 13, C.cyan, true);
    makeText(b1, 405, 282, "Classified: Orders -> Incremental (MERGE_UPSERT), Customers -> Full (OVERWRITE)", 12, C.textSecondary);

    // Stage 2: Parallel PySpark Workers
    makeRect(b1, 385, 325, 750, 60, C.bgBase, 10, C.borderCard, 1);
    makeText(b1, 405, 335, "⚡ Stage 2: Parallel SQLGlot AST & PySpark Workers", 13, C.indigo, true);
    makeText(b1, 405, 357, "Transpiled 14 T-SQL stored procedures to native Spark SQL Delta format", 12, C.textSecondary);

    // Stage 3: Builder & Deep Reconciliation
    makeRect(b1, 385, 400, 750, 60, C.bgBase, 10, C.borderCard, 1);
    makeText(b1, 405, 410, "🏗️ Stage 3: Medallion Lakehouse Builder", 13, C.amber, true);
    makeText(b1, 405, 432, "Provisioned: lh_customer_bronze, lh_customer_silver, lh_customer_gold", 12, C.textSecondary);

    // Stage 4: Auditor & Self-Healing
    makeRect(b1, 385, 475, 750, 60, C.bgBase, 10, C.borderCard, 1);
    makeText(b1, 405, 485, "🔍 Stage 4: Auditor & Closed-Loop Self-Healing", 13, C.emerald, true);
    makeText(b1, 405, 507, "Verified Delta schema constraints & foreign-key surrogate integrity. 0 errors detected.", 12, C.textSecondary);

    // Deployment receipt bar
    makeRect(b1, 385, 550, 750, 80, C.bgSurfaceRaised, 12, C.emerald, 1);
    makeText(b1, 405, 565, "🚀 Live OneLake Deployment Complete", 13, C.emerald, true);
    makeText(b1, 405, 590, "Pipeline: pl_customer_nightly | Target: AI_Test_Folder | Base64 Definition: Synapse PySpark v3.4", 12, C.textMuted);

    // Bottom Prompt Bar Dock
    makeRect(b1, 360, 780, 800, 70, C.bgSurfaceRaised, 35, C.emerald, 2);
    makeText(b1, 395, 805, "Ask Fabric AI Studio to generate lakehouses, pipelines, or transpiled SQL...", 13, C.textMuted);
    
    // Model pill inside dock
    makeRect(b1, 980, 792, 100, 46, C.bgBase, 23, C.borderCard, 1);
    makeText(b1, 995, 808, "Claude 3.7", 12, C.textSecondary);
    
    // Send button
    makeRect(b1, 1090, 792, 55, 46, C.emerald, 23);
    makeText(b1, 1108, 808, "➔", 16, C.bgBase, true);

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 2: MEDALLION DAG TOPOLOGY VISUALIZER (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b2 = penpot.createBoard();
    b2.name = "02 — Medallion DAG Ingestion Visualizer";
    b2.x = 1520; b2.y = 0;
    b2.resize(1440, 900);
    b2.fills = [{ fillColor: C.bgBase }];

    // Title & Header
    makeText(b2, 40, 35, "🏛️ Medallion Lakehouse Topology & Pipeline DAG", 20, C.white, true);
    makeText(b2, 40, 68, "Visualizing Source Ingestion -> Bronze -> Silver (Delta MERGE) -> Gold (Direct Lake)", 13, C.textSecondary);

    // 1. Source Database Node
    makeRect(b2, 60, 160, 240, 520, C.bgSurface, 16, C.borderCard, 1);
    makeRect(b2, 60, 160, 240, 45, C.bgSurfaceRaised, 16);
    makeText(b2, 80, 175, "🔌 Source: Azure SQL DB", 13, C.cyan, true);
    const srcTbls = ["dbo.Orders (500K rows)", "dbo.Customers (50K rows)", "dbo.Products (12K rows)", "dbo.Transactions (1.2M rows)", "dbo.Config (50 rows)"];
    srcTbls.forEach((t, i) => {
        makeRect(b2, 80, 225 + i * 65, 200, 50, C.bgBase, 8, C.borderCard, 1);
        makeText(b2, 92, 240 + i * 65, t, 11, C.textPrimary);
    });

    // Arrow 1
    makeRect(b2, 300, 400, 80, 4, C.cyan);

    // 2. Bronze Lakehouse Node
    makeRect(b2, 380, 160, 260, 520, C.bgSurface, 16, C.amber, 1.5);
    makeRect(b2, 380, 160, 260, 45, "#78350f", 16);
    makeText(b2, 400, 175, "🥉 lh_customer_bronze", 13, C.amber, true);
    const bronzeTbls = ["raw_orders (Append)", "raw_customers (Full)", "raw_products (Full)", "raw_transactions (Append)", "raw_config (Full)"];
    bronzeTbls.forEach((t, i) => {
        makeRect(b2, 400, 225 + i * 65, 220, 50, C.bgBase, 8, C.borderCard, 1);
        makeText(b2, 412, 235 + i * 65, t, 11, C.amber);
        makeText(b2, 412, 252 + i * 65, "Format: Parquet / Schema Raw", 9, C.textMuted);
    });

    // Arrow 2
    makeRect(b2, 640, 400, 80, 4, C.indigo);

    // 3. Silver Lakehouse Node (Delta MERGE)
    makeRect(b2, 720, 160, 280, 520, C.bgSurface, 16, C.indigo, 1.5);
    makeRect(b2, 720, 160, 280, 45, "#312e81", 16);
    makeText(b2, 740, 175, "🥈 lh_customer_silver", 13, C.indigo, true);
    const silverTbls = ["silver_orders (Delta MERGE PK)", "silver_customers (SCD Type 2)", "silver_products (Cleaned)", "silver_transactions (Deduplicated)"];
    silverTbls.forEach((t, i) => {
        makeRect(b2, 740, 225 + i * 75, 240, 60, C.bgBase, 8, C.borderCard, 1);
        makeText(b2, 752, 238 + i * 75, t, 11, C.indigo);
        makeText(b2, 752, 258 + i * 75, "⚡ Delta MERGE on OrderID + Watermark", 9, C.textSecondary);
    });

    // Arrow 3
    makeRect(b2, 1000, 400, 80, 4, C.emerald);

    // 4. Gold Lakehouse Node (Star Schema & Direct Lake)
    makeRect(b2, 1080, 160, 280, 520, C.bgSurface, 16, C.emerald, 1.5);
    makeRect(b2, 1080, 160, 280, 45, "#064e3b", 16);
    makeText(b2, 1100, 175, "🥇 lh_customer_gold", 13, C.emerald, true);
    const goldTbls = ["fact_sales_daily", "dim_customer_360", "dim_product_hierarchy", "semantic_sales_model"];
    goldTbls.forEach((t, i) => {
        makeRect(b2, 1100, 225 + i * 75, 240, 60, C.bgBase, 8, C.borderCard, 1);
        makeText(b2, 1112, 238 + i * 75, t, 11, C.emerald);
        makeText(b2, 1112, 258 + i * 75, "📊 Power BI Direct Lake Ready", 9, C.textSparkle || C.emerald);
    });

    // Bottom Pipeline Orchestration Bar
    makeRect(b2, 60, 720, 1300, 120, C.bgSurfaceRaised, 16, C.borderCard, 1);
    makeText(b2, 90, 740, "🔄 Orchestration Pipeline: pl_customer_daily_ingestion", 14, C.white, true);
    makeText(b2, 90, 765, "Schedule: Nightly at 02:00 UTC | Trigger: Fabric REST API Job | Target Workspace: PBT_DATA_AGENT", 12, C.textSecondary);
    makeRect(b2, 1150, 745, 170, 45, C.emerald, 22);
    makeText(b2, 1180, 760, "▶ Trigger Pipeline", 12, C.bgBase, true);

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 3: GOVERNANCE & CODE VIEWERS (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b3 = penpot.createBoard();
    b3.name = "03 — Governance Modals & PySpark Code Viewer";
    b3.x = 0; b3.y = 960;
    b3.resize(1440, 900);
    b3.fills = [{ fillColor: C.bgBase }];

    // Modal 1: Blast-Radius & Safe Deletion Gate
    makeRect(b3, 60, 60, 600, 380, C.bgSurface, 18, C.rose, 2);
    makeRect(b3, 60, 60, 600, 50, "#450a0a", 18);
    makeText(b3, 85, 78, "⚠️ High-Risk Action Confirmation Gate", 14, C.rose, true);
    makeText(b3, 85, 130, "You are about to execute a destructive operation:", 12, C.textSecondary);
    makeText(b3, 85, 155, "OVERWRITE TABLE: lh_customer_silver.silver_orders", 13, C.white, true);
    
    makeRect(b3, 85, 190, 550, 80, C.bgBase, 10, C.borderCard, 1);
    makeText(b3, 100, 205, "🔒 Automated Safety Snapshot Created in _deleted_archive/", 11, C.emerald);
    makeText(b3, 100, 230, "Backup file: batch_delete_20260830_lh_customer_silver.json (Base64)", 10, C.textMuted);

    makeText(b3, 85, 290, "Type OVERWRITE ORDERS to confirm:", 12, C.textSecondary);
    makeRect(b3, 85, 315, 380, 42, C.bgSurfaceRaised, 8, C.rose, 1);
    makeText(b3, 100, 328, "OVERWRITE ORDERS", 12, C.white);
    
    makeRect(b3, 480, 315, 155, 42, C.rose, 8);
    makeText(b3, 510, 328, "Confirm & Deploy", 12, C.bgBase, true);

    // Modal 2: Monaco PySpark / Delta Code Viewer
    makeRect(b3, 720, 60, 660, 780, "#090d16", 18, C.borderCard, 1.5);
    makeRect(b3, 720, 60, 660, 45, C.bgSurfaceRaised, 18);
    makeText(b3, 745, 75, "📄 Generated PySpark Notebook: nb_silver_orders_merge.py", 13, C.cyan, true);
    makeRect(b3, 1260, 70, 100, 26, C.bgBase, 6, C.borderCard, 1);
    makeText(b3, 1275, 77, "Synapse 3.4", 10, C.textMuted);

    const sparkLines = [
        "# Fabric AI Studio — Auto-Generated PySpark Delta Upsert",
        "from delta.tables import DeltaTable",
        "from pyspark.sql.functions import col, current_timestamp",
        "",
        "# Step 1: Read raw Bronze stream",
        "df_raw = spark.read.table('lh_customer_bronze.raw_orders')",
        "",
        "# Step 2: Clean & Deduplicate",
        "df_clean = df_raw.dropDuplicates(['OrderID']) \\\\",
        "    .filter(col('OrderID').isNotNull()) \\\\",
        "    .withColumn('silver_ingest_ts', current_timestamp())",
        "",
        "# Step 3: Delta MERGE UPSERT into Silver",
        "delta_target = DeltaTable.forName(spark, 'lh_customer_silver.silver_orders')",
        "",
        "delta_target.alias('tgt').merge(",
        "    df_clean.alias('src'),",
        "    'tgt.OrderID = src.OrderID'",
        ").whenMatchedUpdateAll(",
        "    condition = 'src.updated_at > tgt.updated_at'",
        ").whenNotMatchedInsertAll() \\\\",
        " .execute()",
        "",
        "print('✅ Successfully upserted Delta partition.')"
    ];

    sparkLines.forEach((line, i) => {
        makeText(b3, 745, 125 + i * 26, line, 11, line.startsWith("#") ? C.textMuted : (line.includes("delta") || line.includes("merge") ? C.emerald : C.textSecondary));
    });

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 4: MASTER DESIGN SYSTEM & UI ATOMS (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b4 = penpot.createBoard();
    b4.name = "04 — Master Design System & UI Component Library";
    b4.x = 1520; b4.y = 960;
    b4.resize(1440, 900);
    b4.fills = [{ fillColor: C.bgBase }];

    makeText(b4, 40, 35, "🎨 Fabric AI Studio Design Tokens & Atoms", 20, C.white, true);

    // Color Swatches
    makeText(b4, 40, 85, "COLOR PALETTE (HSL TAILORED & GOOGLE AI STUDIO DARK)", 12, C.textMuted, true);
    const swatches = [
        { name: "Emerald Accent", hex: C.emerald },
        { name: "Cyan Sparkle", hex: C.cyan },
        { name: "Indigo Worker", hex: C.indigo },
        { name: "Amber Bronze", hex: C.amber },
        { name: "Rose High-Risk", hex: C.rose },
        { name: "Base Background", hex: C.bgBase },
        { name: "Surface Card", hex: C.bgSurface },
        { name: "Raised Card", hex: C.bgSurfaceRaised }
    ];
    swatches.forEach((s, i) => {
        makeRect(b4, 40 + i * 165, 115, 145, 80, s.hex, 12, C.borderCard, 1);
        makeText(b4, 48, 160, s.name, 11, s.hex === C.bgBase || s.hex === C.bgSurface ? C.textSecondary : C.bgBase, true);
        makeText(b4, 48, 178, s.hex, 10, s.hex === C.bgBase || s.hex === C.bgSurface ? C.textMuted : C.bgBase);
    });

    // UI Buttons & Pills
    makeText(b4, 40, 230, "BUTTONS & INTERACTIVE PILLS", 12, C.textMuted, true);
    makeRect(b4, 40, 260, 160, 44, C.emerald, 22);
    makeText(b4, 75, 275, "+ Create Plan", 13, C.bgBase, true);

    makeRect(b4, 220, 260, 160, 44, C.bgSurfaceRaised, 22, C.borderCard, 1);
    makeText(b4, 255, 275, "⚙️ Configure", 13, C.textPrimary);

    makeRect(b4, 400, 260, 160, 44, "transparent", 22, C.emerald, 1.5);
    makeText(b4, 435, 275, "View Lineage", 13, C.emerald);

    makeRect(b4, 580, 260, 160, 44, C.rose, 22);
    makeText(b4, 615, 275, "Delete Item", 13, C.bgBase, true);

    // Medallion Badges
    makeText(b4, 40, 340, "MEDALLION ARCHITECTURE TIERS & BADGES", 12, C.textMuted, true);
    makeRect(b4, 40, 370, 180, 40, "#78350f", 20);
    makeText(b4, 60, 383, "🥉 BRONZE INGESTION", 11, C.amber, true);

    makeRect(b4, 240, 370, 180, 40, "#312e81", 20);
    makeText(b4, 260, 383, "🥈 SILVER DELTA MERGE", 11, C.cyan, true);

    makeRect(b4, 440, 370, 180, 40, "#064e3b", 20);
    makeText(b4, 460, 383, "🥇 GOLD STAR SCHEMA", 11, C.emerald, true);

    return {
        success: true,
        boardsCreated: 4,
        boardNames: ["Workbench", "DAG Ingestion", "Governance & PySpark", "Design System"]
    };
})();
"""

def generate_design():
    print("[PENPOT SUITE] Transmitting JS builder payload to Penpot Plugin Bridge on :4403...")
    try:
        resp = requests.post(REPL_URL, json={"code": PENPOT_JS_CODE}, timeout=30)
        print(f"[STATUS] {resp.status_code}")
        print(f"[RESPONSE] {resp.text}")
        return resp.json()
    except Exception as e:
        print(f"[ERROR] {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    generate_design()
