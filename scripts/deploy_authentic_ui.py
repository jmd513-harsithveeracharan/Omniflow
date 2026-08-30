"""
deploy_authentic_ui.py — Pixel-Perfect Fabric AI Studio Design Suite
--------------------------------------------------------------------
Draws the authentic Google AI Studio / Claude-style dark theme matching the actual website screenshot:
- Board 1: Playground Landing (Exact replica of Screenshot 2)
- Board 2: Active Chat & 4-Stage Multi-Agent Execution State
- Board 3: Apps & Connectors Catalog
- Board 4: OneLake Workspace & Item Browser
- Board 5: Master UI Component Library & Tokens
"""

import json
import time
import requests

TOKEN = "eyJhbGciOiJBMjU2S1ciLCJlbmMiOiJBMjU2R0NNIn0.IvHYIVM7qTXb2XI7eMx3bijBoY4ivY4TNZHGAmKKUWuARNGtD915jw.MaQf5_2E21wzj0SB.6inLguRhu7qhBEwE4JRF3WB_DGbBIQsMYlDGbHfqgikQxd-jnZaIoirnYz03ZIQ7smiSBpwpC6yU4wNzThvw6THOVJsCyQnA7sgVgqI7e_x3APFQSg0kQe1BwdCEWFlnah_7OfPisiDmmS5bba5JRKgpWpr6IPpH4xeZyDRgt7peitwq9Jt7ZI_R6A3I6-WkWsxYxRZlbNmq.iM8VMFxEze3cYASCF-c52Q"
REPL_URL = "http://localhost:4403/execute"
MCP_STREAM_URL = f"http://localhost:9001/mcp/stream?userToken={TOKEN}"

PENPOT_JS_CODE = """
(() => {
    const page = penpot.currentPage;
    if (!page) return { error: "No active page found in Penpot" };

    // Clear old shapes
    const existing = page.findShapes();
    existing.forEach(s => s.remove());

    // Authentic Color Tokens from style.css & screenshot
    const C = {
        bgBase: "#131314",
        bgSidebar: "#131314",
        bgSurface: "#1e1f20",
        bgSurfaceRaised: "#282a2c",
        bgPill: "#252628",
        borderSubtle: "#2d2e31",
        borderCard: "#333538",
        borderDock: "#3c4043",
        textPrimary: "#e3e3e3",
        textSecondary: "#c4c7c5",
        textMuted: "#8e918f",
        textTertiary: "#9ca3af",
        emerald: "#10b981",
        cyan: "#06b6d4",
        indigo: "#6366f1",
        amber: "#f59e0b",
        avatarGold: "#e08020",
        rose: "#f28b82",
        white: "#ffffff"
    };

    function makeRect(parent, x, y, w, h, fill, radius = 0, stroke = null, strokeW = 1) {
        const r = penpot.createRectangle();
        r.x = x; r.y = y;
        r.resize(w, h);
        if (fill && fill !== "transparent" && fill !== "none") {
            r.fills = [{ fillColor: fill }];
        } else {
            r.fills = [];
        }
        if (radius) r.borderRadius = radius;
        if (stroke) {
            r.strokes = [{ strokeColor: stroke, strokeWidth: strokeW, strokeStyle: "solid", strokeAlignment: "center" }];
        }
        parent.appendChild(r);
        return r;
    }

    function makeText(parent, x, y, str, size = 13, fill = C.textPrimary, bold = false) {
        const t = penpot.createText(str);
        if (!t) return null;
        t.x = x; t.y = y;
        t.fontSize = String(size);
        t.fills = [{ fillColor: fill }];
        parent.appendChild(t);
        return t;
    }

    function makeCircle(parent, x, y, diameter, fill) {
        const c = penpot.createEllipse();
        c.x = x; c.y = y;
        c.resize(diameter, diameter);
        c.fills = [{ fillColor: fill }];
        parent.appendChild(c);
        return c;
    }

    // Helper: draw the authentic Claude-style Sidebar
    function renderSidebar(board, activeNav = "New Chat") {
        makeRect(board, 0, 0, 260, 900, C.bgSidebar, 0, C.borderSubtle, 1);

        // Brand logo & title row
        makeCircle(board, 22, 22, 10, C.emerald);
        makeCircle(board, 34, 18, 8, C.cyan);
        makeCircle(board, 32, 28, 7, C.emerald);
        makeText(board, 48, 18, "Fabric.AI", 14, C.textPrimary, true);
        makeText(board, 114, 19, "⌄", 11, C.textMuted);

        // Sidebar icons right
        makeText(board, 205, 18, "◫", 13, C.textMuted);
        makeText(board, 228, 18, "🔍", 12, C.textMuted);

        // + New Chat button card
        makeRect(board, 16, 52, 228, 38, C.bgSurface, 8, C.borderCard, 1);
        makeText(board, 30, 62, "+  New Chat", 13, C.textPrimary, true);

        // Navigation links
        const navItems = [
            { icon: "📁", label: "Projects" },
            { icon: "📖", label: "Skills" },
            { icon: "🖥️", label: "Workspaces" },
            { icon: "🎛️", label: "Apps" },
            { icon: "⚙️", label: "Customize" }
        ];

        navItems.forEach((item, idx) => {
            const y = 104 + idx * 34;
            const isActive = activeNav === item.label;
            if (isActive) {
                makeRect(board, 16, y - 2, 228, 30, C.bgSurfaceRaised, 6);
            }
            makeText(board, 26, y + 4, item.icon, 12, isActive ? C.textPrimary : C.textMuted);
            makeText(board, 48, y + 4, item.label, 13, isActive ? C.textPrimary : C.textSecondary);
        });

        // Chats and tasks section
        makeText(board, 20, 290, "Chats and tasks", 12, C.textMuted);
        makeText(board, 115, 291, "⌄", 10, C.textMuted);

        // Chat list from actual screenshot
        const recentChats = [
            "We need to ingest Custom...",
            "We need to ingest Custom...",
            "We are setting up an inges...",
            "hi what model are you ?",
            "create a folder named mer...",
            "What can you do in Fabric?",
            "What can you do in Fabric?",
            "create a folder named mer...",
            "Create a project folder na...",
            "create a folder named mer...",
            "deploy active plan"
        ];

        recentChats.forEach((chat, idx) => {
            const y = 318 + idx * 28;
            makeText(board, 22, y, "○", 8, C.textMuted);
            makeText(board, 36, y - 2, chat, 12, idx === 0 ? C.textPrimary : C.textMuted);
        });

        // Footer User Profile Pill
        makeRect(board, 16, 840, 228, 44, C.bgSurface, 8, null, 0);
        makeCircle(board, 26, 850, 24, C.avatarGold);
        makeText(board, 34, 854, "B", 12, C.white, true);
        makeText(board, 58, 854, "Bheesetti Harsith", 12, C.textPrimary);
        
        // PRO badge
        makeRect(board, 195, 852, 38, 20, C.bgSurfaceRaised, 10);
        makeText(board, 203, 855, "PRO", 9, C.textTertiary, true);
    }

    function renderTopbar(board, title = "Playground") {
        makeText(board, 285, 20, title, 14, C.textPrimary, true);
        makeText(board, 1360, 20, "+", 15, C.textMuted);
        makeText(board, 1390, 20, "⋮", 15, C.textMuted);
        makeText(board, 1415, 20, "⤢", 13, C.textMuted);
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 1: PLAYGROUND LANDING (Exact Match of Screenshot 2)
    // ═════════════════════════════════════════════════════════════════════
    const b1 = penpot.createBoard();
    b1.name = "01 — Playground Landing (Authentic Web View)";
    b1.x = 0; b1.y = 0;
    b1.resize(1440, 900);
    b1.fills = [{ fillColor: C.bgBase }];

    renderSidebar(b1, "New Chat");
    renderTopbar(b1, "Playground");

    // Center Hero Title Row
    makeCircle(b1, 550, 360, 16, C.emerald);
    makeCircle(b1, 568, 354, 12, C.cyan);
    makeCircle(b1, 566, 370, 11, C.emerald);
    makeText(b1, 592, 355, "Time for some creative brainstorming.", 26, C.textPrimary, true);

    // Floating Prompt Dock (740px x 135px)
    const dockX = 480, dockY = 415, dockW = 740, dockH = 135;
    makeRect(b1, dockX, dockY, dockW, dockH, C.bgSurface, 18, C.borderDock, 1);
    makeText(b1, dockX + 22, dockY + 22, "Start typing a prompt to see what our models can do...", 13, C.textMuted);

    // Bottom Toolbar inside Prompt Dock
    makeRect(b1, dockX + 20, dockY + 82, 34, 32, C.bgPill, 8);
    makeText(b1, dockX + 31, dockY + 89, "🎛️", 12, C.textSecondary);

    makeRect(b1, dockX + 62, dockY + 82, 70, 32, C.bgPill, 8);
    makeText(b1, dockX + 74, dockY + 89, "⊞ Tools", 12, C.textSecondary);

    const modelPillX = dockX + dockW - 250;
    makeRect(b1, modelPillX, dockY + 82, 140, 32, C.bgPill, 16, C.borderCard, 1);
    makeText(b1, modelPillX + 14, dockY + 89, "Claude Mix", 12, C.textPrimary);
    makeText(b1, modelPillX + 85, dockY + 90, "High", 11, C.textTertiary);
    makeText(b1, modelPillX + 118, dockY + 90, "⌄", 10, C.textMuted);

    makeText(b1, modelPillX + 160, dockY + 88, "🎙️", 13, C.textMuted);
    makeText(b1, modelPillX + 195, dockY + 88, "🔊", 13, C.textMuted);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 2: ACTIVE AGENT EXECUTION (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b2 = penpot.createBoard();
    b2.name = "02 — Active Chat & Multi-Agent Execution State";
    b2.x = 1520; b2.y = 0;
    b2.resize(1440, 900);
    b2.fills = [{ fillColor: C.bgBase }];

    renderSidebar(b2, "Projects");
    renderTopbar(b2, "Enterprise Retail Medallion");

    const chatX = 420, chatW = 860;
    makeRect(b2, chatX, 70, chatW, 64, C.bgSurfaceRaised, 12, C.borderCard, 1);
    makeText(b2, chatX + 20, 84, "👤 You", 11, C.textMuted, true);
    makeText(b2, chatX + 20, 104, "Architect a 3-tier Medallion lakehouse for CustomerDB with nightly incremental Delta MERGE", 13, C.textPrimary);

    makeRect(b2, chatX, 150, chatW, 580, C.bgSurface, 16, C.borderCard, 1);
    makeCircle(b2, chatX + 20, 172, 10, C.emerald);
    makeText(b2, chatX + 38, 168, "Fabric AI Studio", 13, C.emerald, true);
    makeRect(b2, chatX + chatW - 140, 164, 120, 26, C.bgSurfaceRaised, 13, C.borderCard, 1);
    makeText(b2, chatX + chatW - 128, 170, "⚡ Execution 11.2s", 11, C.textSecondary);

    makeRect(b2, chatX + 20, 210, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 222, "Stage 1: Meta-Planner & Strategy Classifier", 13, C.textPrimary, true);
    makeText(b2, chatX + 38, 246, "Discovered 5 tables in CustomerDB. Classified Orders -> Incremental (MERGE_UPSERT), Customers -> Full (OVERWRITE).", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 290, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 302, "Stage 2: Parallel SQLGlot AST & PySpark Synthesis", 13, C.textPrimary, true);
    makeText(b2, chatX + 38, 326, "Transpiled 14 T-SQL stored procedures to native PySpark Delta MERGE scripts. AST validation passed.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 370, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 382, "Stage 3: Medallion Lakehouse Builder", 13, C.textPrimary, true);
    makeText(b2, chatX + 38, 406, "Provisioned: lh_customer_bronze, lh_customer_silver, lh_customer_gold inside folder AI_Test_Folder.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 450, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 462, "Stage 4: Auditor & Closed-Loop Verification", 13, C.emerald, true);
    makeText(b2, chatX + 38, 486, "Verified schema integrity, Delta table constraints, and foreign key surrogate mappings. 0 errors.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 530, chatW - 40, 80, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeText(b2, chatX + 38, 545, "Deployed OneLake Items (Workspace: PBT_DATA_AGENT)", 12, C.textPrimary, true);
    
    const items = ["lh_customer_bronze", "lh_customer_silver", "lh_customer_gold", "pl_customer_daily", "nb_silver_merge"];
    items.forEach((it, i) => {
        makeRect(b2, chatX + 38 + i * 155, 570, 145, 26, C.bgBase, 6, C.borderSubtle, 1);
        makeText(b2, chatX + 48 + i * 155, 575, `📦 ${it}`, 10, C.emerald);
    });

    makeRect(b2, chatX, 750, chatW, 64, C.bgSurface, 16, C.borderDock, 1);
    makeText(b2, chatX + 22, 772, "Reply to Fabric AI Studio...", 13, C.textMuted);
    makeRect(b2, chatX + chatW - 130, 762, 110, 40, C.bgSurfaceRaised, 20, C.borderCard, 1);
    makeText(b2, chatX + chatW - 110, 774, "Claude Mix", 12, C.textPrimary);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 3: APPS & CONNECTOR CATALOG (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b3 = penpot.createBoard();
    b3.name = "03 — Apps & Connector Catalog";
    b3.x = 0; b3.y = 960;
    b3.resize(1440, 900);
    b3.fills = [{ fillColor: C.bgBase }];

    renderSidebar(b3, "Apps");
    renderTopbar(b3, "Apps & Connectors");

    makeText(b3, 300, 70, "Data Source Connectors", 20, C.textPrimary, true);
    makeText(b3, 300, 98, "Select a native connector to automatically inspect schemas and generate Medallion pipelines.", 13, C.textSecondary);

    const connectors = [
        { name: "Azure SQL / SQL Server", status: "LIVE", badgeBg: "#064e3b", badgeColor: C.emerald, desc: "Direct sys.tables & INFORMATION_SCHEMA extraction with column lineage." },
        { name: "SAP (HANA / ODP)", status: "LIVE", badgeBg: "#064e3b", badgeColor: C.emerald, desc: "RFC / OData metadata connector with automated ABAP table transpilation." },
        { name: "Snowflake Cloud", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "Information Schema extraction with multi-cluster warehouse pushdown." },
        { name: "Salesforce Data Cloud", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "REST Object & Entity API ingestion with CDC watermarking." },
        { name: "Amazon Redshift", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "PG catalog discovery with Spectrum external table support." },
        { name: "Google BigQuery", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "BigQuery Storage API connector with partition pruning." }
    ];

    connectors.forEach((conn, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cardX = 300 + col * 360;
        const cardY = 140 + row * 220;

        makeRect(b3, cardX, cardY, 340, 195, C.bgSurface, 14, C.borderCard, 1);
        makeRect(b3, cardX + 18, cardY + 18, 42, 42, C.bgSurfaceRaised, 10, C.borderSubtle, 1);
        makeText(b3, cardX + 28, cardY + 28, "🔌", 16, C.textPrimary);

        makeRect(b3, cardX + 250, cardY + 22, 70, 24, conn.badgeBg, 12);
        makeText(b3, cardX + 262, cardY + 27, conn.status, 10, conn.badgeColor, true);

        makeText(b3, cardX + 18, cardY + 75, conn.name, 14, C.textPrimary, true);
        makeText(b3, cardX + 18, cardY + 102, conn.desc, 12, C.textSecondary);

        makeRect(b3, cardX + 18, cardY + 148, 304, 32, C.bgSurfaceRaised, 8, C.borderSubtle, 1);
        makeText(b3, cardX + 130, cardY + 156, "Configure", 11, C.textPrimary);
    });


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 4: MASTER DESIGN SYSTEM & UI ATOMS (1440 x 900)
    // ═════════════════════════════════════════════════════════════════════
    const b4 = penpot.createBoard();
    b4.name = "04 — Master Design System & UI Component Library";
    b4.x = 1520; b4.y = 960;
    b4.resize(1440, 900);
    b4.fills = [{ fillColor: C.bgBase }];

    makeText(b4, 40, 35, "Fabric AI Studio — Design System Tokens & Component Atoms", 20, C.white, true);

    makeText(b4, 40, 85, "SURFACE & ACCENT PALETTE (GOOGLE AI STUDIO DARK)", 12, C.textMuted, true);
    const swatches = [
        { name: "Base Canvas", hex: C.bgBase },
        { name: "Card Surface", hex: C.bgSurface },
        { name: "Raised Card", hex: C.bgSurfaceRaised },
        { name: "Dock Pill", hex: C.bgPill },
        { name: "Fabric Emerald", hex: C.emerald },
        { name: "Cyan Accent", hex: C.cyan },
        { name: "Indigo Worker", hex: C.indigo },
        { name: "Amber Gold", hex: C.amber }
    ];

    swatches.forEach((s, i) => {
        makeRect(b4, 40 + i * 165, 115, 145, 80, s.hex, 10, C.borderCard, 1);
        makeText(b4, 48, 160, s.name, 11, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textSecondary : C.bgBase, true);
        makeText(b4, 48, 178, s.hex, 10, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textMuted : C.bgBase);
    });

    makeText(b4, 40, 230, "BUTTONS & INTERACTIVE PILLS", 12, C.textMuted, true);
    
    makeRect(b4, 40, 260, 160, 38, C.bgSurface, 8, C.borderCard, 1);
    makeText(b4, 65, 271, "+  New Chat", 13, C.textPrimary, true);

    makeRect(b4, 220, 260, 160, 38, C.bgPill, 19, C.borderCard, 1);
    makeText(b4, 240, 271, "Claude Mix", 12, C.textPrimary);
    makeText(b4, 315, 272, "High ⌄", 11, C.textTertiary);

    makeRect(b4, 400, 260, 100, 38, C.bgPill, 8);
    makeText(b4, 420, 271, "⊞ Tools", 12, C.textSecondary);

    makeRect(b4, 520, 260, 140, 38, C.emerald, 8);
    makeText(b4, 545, 271, "Deploy Plan", 12, C.bgBase, true);

    makeText(b4, 40, 330, "PROFILE & STATUS PILLS", 12, C.textMuted, true);
    makeRect(b4, 40, 360, 228, 44, C.bgSurface, 8);
    makeCircle(b4, 50, 370, 24, C.avatarGold);
    makeText(b4, 58, 374, "B", 12, C.white, true);
    makeText(b4, 82, 374, "Bheesetti Harsith", 12, C.textPrimary);
    makeRect(b4, 215, 372, 38, 20, C.bgSurfaceRaised, 10);
    makeText(b4, 223, 375, "PRO", 9, C.textTertiary, true);

    return {
        success: true,
        boardsCreated: 4,
        status: "Authentic Design System rendered successfully!"
    };
})();
"""

def execute_design_payload():
    print("[DEPLOY] Connecting to Penpot Plugin Bridge on :4403...")
    try:
        resp = requests.post(REPL_URL, json={"code": PENPOT_JS_CODE}, timeout=10)
        print(f"[STATUS] {resp.status_code}")
        print(f"[RESPONSE] {resp.text}")
        if resp.status_code == 200 and "error" not in resp.json():
            print("🎉 SUCCESS! Authentic boards rendered on Penpot canvas!")
            return True
    except Exception as e:
        print(f"[ERROR] REPL failed: {e}")
    return False

if __name__ == "__main__":
    execute_design_payload()
