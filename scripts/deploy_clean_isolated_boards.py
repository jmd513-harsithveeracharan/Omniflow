# -*- coding: utf-8 -*-
"""
deploy_clean_isolated_boards.py — Clean, Isolated, Pixel-Perfect Penpot Suite
-----------------------------------------------------------------------------
Generates 4 cleanly separated, clutter-free artboards with 100% exact styling:
- Board 1: Playground Landing (Clean, pristine replica of screenshot 2 - NO auth clutter)
- Board 2: Claude-Style Auth & Sign-In Page (Dedicated auth page with Google/MS buttons)
- Board 3: Active Multi-Agent Execution State (4-Stage Pipeline Breakdown & OneLake Items)
- Board 4: Apps & Connectors Catalog (6 Data Source Cards with Status Badges)
"""

import json
import requests

REPL_URL = "http://localhost:4403/execute"

PENPOT_JS_CODE = """
(() => {
    const page = penpot.currentPage;
    if (!page) return { error: "No active page in Penpot" };

    // Clear all existing shapes
    page.findShapes().forEach(s => s.remove());

    const C = {
        bgBase: "#131314",
        bgSidebar: "#131314",
        bgSurface: "#1e1f20",
        bgSurfaceRaised: "#282a2c",
        bgPill: "#252628",
        borderSubtle: "#2d2e31",
        borderCard: "#333538",
        borderDock: "#3c4043",
        textPrimary: "#ffffff",
        textSecondary: "#c4c7c5",
        textMuted: "#8e918f",
        textTertiary: "#9ca3af",
        emerald: "#10b981",
        cyan: "#06b6d4",
        indigo: "#6366f1",
        amber: "#f59e0b",
        avatarGold: "#d97706",
        googleBlue: "#4285f4",
        googleRed: "#ea4335",
        googleYellow: "#fbbc05",
        googleGreen: "#34a853",
        msBlue: "#00a4ef"
    };

    function makeBoard(name, bx, by) {
        const b = penpot.createBoard();
        b.name = name;
        b.x = bx;
        b.y = by;
        b.resize(1440, 900);
        b.fills = [{ fillColor: C.bgBase }];
        return b;
    }

    function makeRect(b, lx, ly, w, h, fill, radius = 0, stroke = null, strokeW = 1) {
        const r = penpot.createRectangle();
        b.appendChild(r);
        r.x = b.x + lx;
        r.y = b.y + ly;
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
        return r;
    }

    function makeText(b, lx, ly, str, size = 13, fill = C.textPrimary) {
        const t = penpot.createText(str);
        if (!t) return null;
        b.appendChild(t);
        t.x = b.x + lx;
        t.y = b.y + ly;
        t.fontSize = String(size);
        t.growType = "auto-width";
        t.fills = [{ fillColor: fill }];
        t.bringToFront();
        return t;
    }

    function makeCircle(b, lx, ly, diameter, fill) {
        const c = penpot.createEllipse();
        b.appendChild(c);
        c.x = b.x + lx;
        c.y = b.y + ly;
        c.resize(diameter, diameter);
        c.fills = [{ fillColor: fill }];
        c.bringToFront();
        return c;
    }

    function renderSidebar(b, activeNav = "New Chat") {
        // Sidebar container
        const bg = makeRect(b, 0, 0, 260, 900, C.bgSidebar);
        bg.sendToBack();
        makeRect(b, 259, 0, 1, 900, C.borderSubtle);

        // Header: 3-Node Connected Brand Logo + Title + Icons
        makeCircle(b, 20, 22, 10, C.emerald);
        makeCircle(b, 30, 18, 8, C.cyan);
        makeCircle(b, 29, 28, 7, C.emerald);
        makeText(b, 46, 18, "Fabric.AI", 15, C.textPrimary);
        makeText(b, 114, 19, "⌄", 12, C.textMuted);

        makeText(b, 202, 19, "◫", 13, C.textMuted);
        makeText(b, 228, 19, "🔍", 12, C.textMuted);

        // + New Chat button card
        makeRect(b, 16, 56, 228, 38, C.bgSurface, 8, C.borderCard, 1);
        makeText(b, 30, 66, "+  New Chat", 13, C.textPrimary);

        // Nav items
        const nav = [
            { icon: "📁", label: "Projects" },
            { icon: "📖", label: "Skills" },
            { icon: "🖥️", label: "Workspaces" },
            { icon: "🎛️", label: "Apps" },
            { icon: "⚙️", label: "Customize" }
        ];

        nav.forEach((it, i) => {
            const y = 108 + i * 34;
            if (activeNav === it.label) {
                makeRect(b, 16, y - 2, 228, 30, C.bgSurfaceRaised, 6);
            }
            makeText(b, 24, y + 4, it.icon, 13, C.textMuted);
            makeText(b, 48, y + 4, it.label, 13, it.label === activeNav ? C.textPrimary : C.textSecondary);
        });

        // Chats and tasks section
        makeText(b, 20, 296, "Chats and tasks", 11, C.textMuted);
        makeText(b, 116, 297, "⌄", 10, C.textMuted);

        const chats = [
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
        chats.forEach((ch, i) => {
            const y = 322 + i * 28;
            makeText(b, 22, y + 2, "○", 8, C.textMuted);
            makeText(b, 36, y, ch, 12, i === 0 ? C.textPrimary : C.textMuted);
        });

        // Footer User Profile Card
        makeRect(b, 16, 842, 228, 44, C.bgSurface, 8);
        makeCircle(b, 24, 851, 26, C.avatarGold);
        makeText(b, 32, 855, "B", 12, C.textPrimary);
        makeText(b, 58, 856, "Bheesetti Harsith", 12, C.textPrimary);
        makeRect(b, 194, 854, 38, 20, C.bgSurfaceRaised, 10);
        makeText(b, 202, 857, "PRO", 9, C.textTertiary);
    }

    function renderTopbar(b, title = "Playground") {
        makeText(b, 285, 20, title, 14, C.textPrimary);
        makeText(b, 1360, 20, "+", 16, C.textMuted);
        makeText(b, 1390, 20, "⋮", 16, C.textMuted);
        makeText(b, 1415, 20, "⤢", 14, C.textMuted);
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 1: CLEAN PLAYGROUND LANDING (Exact Match of Screenshot 2)
    // ═════════════════════════════════════════════════════════════════════
    const b1 = makeBoard("01 — Playground Landing (Authentic Web View)", 0, 0);
    renderSidebar(b1, "New Chat");
    renderTopbar(b1, "Playground");

    // Center Hero Stage (Zero Auth Clutter)
    makeCircle(b1, 560, 355, 16, C.emerald);
    makeCircle(b1, 578, 349, 12, C.cyan);
    makeCircle(b1, 576, 365, 11, C.emerald);
    makeText(b1, 602, 350, "Time for some creative brainstorming.", 26, C.textPrimary);

    // Floating Prompt Dock (740px x 136px)
    const dockX = 480, dockY = 415, dockW = 740, dockH = 136;
    makeRect(b1, dockX, dockY, dockW, dockH, C.bgSurface, 18, C.borderDock, 1);
    makeText(b1, dockX + 24, dockY + 24, "Start typing a prompt to see what our models can do...", 13, C.textMuted);

    // Prompt Dock Toolbar
    makeRect(b1, dockX + 20, dockY + 84, 34, 32, C.bgPill, 8);
    makeText(b1, dockX + 31, dockY + 91, "🎛️", 12, C.textSecondary);

    makeRect(b1, dockX + 62, dockY + 84, 72, 32, C.bgPill, 8);
    makeText(b1, dockX + 74, dockY + 91, "⊞ Tools", 12, C.textSecondary);

    const modelPillX = dockX + dockW - 250;
    makeRect(b1, modelPillX, dockY + 84, 140, 32, C.bgPill, 16, C.borderCard, 1);
    makeText(b1, modelPillX + 14, dockY + 91, "Claude Mix", 12, C.textPrimary);
    makeText(b1, modelPillX + 85, dockY + 92, "High", 11, C.textTertiary);
    makeText(b1, modelPillX + 118, dockY + 92, "⌄", 10, C.textMuted);
    makeText(b1, modelPillX + 160, dockY + 90, "🎙️", 13, C.textMuted);
    makeText(b1, modelPillX + 195, dockY + 90, "🔊", 13, C.textMuted);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 2: CLAUDE-STYLE AUTH & LOGIN LANDING PAGE
    // ═════════════════════════════════════════════════════════════════════
    const b2 = makeBoard("02 — Auth & Sign-in Landing Page", 1540, 0);
    
    // Center Auth Container
    const authW = 420, authH = 460;
    const authX = (1440 - authW) / 2, authY = (900 - authH) / 2;

    makeText(b2, authX + 70, authY, "Question what's next", 28, C.textPrimary);
    makeText(b2, authX + 85, authY + 38, "Your thinking partner for big ambitions", 13, C.textMuted);

    // Auth Card Box
    makeRect(b2, authX, authY + 80, authW, 360, C.bgSurface, 16, C.borderCard, 1);

    // Continue with Google Button
    makeRect(b2, authX + 24, authY + 110, authW - 48, 44, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeCircle(b2, authX + 44, authY + 125, 14, C.googleBlue);
    makeText(b2, authX + 110, authY + 123, "Continue with Google", 13, C.textPrimary);

    // Continue with Microsoft Button
    makeRect(b2, authX + 24, authY + 166, authW - 48, 44, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeRect(b2, authX + 44, authY + 181, 14, 14, C.msBlue, 2);
    makeText(b2, authX + 105, authY + 179, "Continue with Microsoft", 13, C.textPrimary);

    // Divider OR
    makeRect(b2, authX + 24, authY + 235, 160, 1, C.borderSubtle);
    makeText(b2, authX + 195, authY + 227, "OR", 11, C.textMuted);
    makeRect(b2, authX + 230, authY + 235, 160, 1, C.borderSubtle);

    // Email Input
    makeRect(b2, authX + 24, authY + 260, authW - 48, 44, C.bgBase, 10, C.borderCard, 1);
    makeText(b2, authX + 40, authY + 273, "Enter your work email address...", 12, C.textMuted);

    // Submit Button
    makeRect(b2, authX + 24, authY + 316, authW - 48, 44, C.emerald, 10);
    makeText(b2, authX + 140, authY + 329, "Continue with email", 13, C.bgBase);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 3: ACTIVE MULTI-AGENT EXECUTION STATE
    // ═════════════════════════════════════════════════════════════════════
    const b3 = makeBoard("03 — Active Multi-Agent Execution State", 0, 960);
    renderSidebar(b3, "Projects");
    renderTopbar(b3, "Enterprise Retail Medallion");

    const chatX = 380, chatW = 900;
    makeRect(b3, chatX, 60, chatW, 64, C.bgSurfaceRaised, 12, C.borderCard, 1);
    makeText(b3, chatX + 20, 74, "👤 You", 11, C.textMuted);
    makeText(b3, chatX + 20, 94, "Architect a 3-tier Medallion lakehouse for CustomerDB with nightly incremental Delta MERGE", 13, C.textPrimary);

    makeRect(b3, chatX, 140, chatW, 600, C.bgSurface, 16, C.borderCard, 1);
    makeCircle(b3, chatX + 20, 162, 10, C.emerald);
    makeText(b3, chatX + 38, 158, "Fabric AI Studio", 13, C.emerald);
    makeRect(b3, chatX + chatW - 140, 154, 120, 26, C.bgSurfaceRaised, 13, C.borderCard, 1);
    makeText(b3, chatX + chatW - 128, 160, "⚡ Execution 11.2s", 11, C.textSecondary);

    makeRect(b3, chatX + 20, 195, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b3, chatX + 38, 207, "Stage 1: Meta-Planner & Strategy Classifier", 13, C.textPrimary);
    makeText(b3, chatX + 38, 231, "Discovered 5 tables in CustomerDB. Classified Orders -> Incremental (MERGE_UPSERT), Customers -> Full (OVERWRITE).", 12, C.textSecondary);

    makeRect(b3, chatX + 20, 275, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b3, chatX + 38, 287, "Stage 2: Parallel SQLGlot AST & PySpark Synthesis", 13, C.textPrimary);
    makeText(b3, chatX + 38, 311, "Transpiled 14 T-SQL stored procedures to native PySpark Delta MERGE scripts. AST validation passed.", 12, C.textSecondary);

    makeRect(b3, chatX + 20, 355, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b3, chatX + 38, 367, "Stage 3: Medallion Lakehouse Builder", 13, C.textPrimary);
    makeText(b3, chatX + 38, 391, "Provisioned: lh_customer_bronze, lh_customer_silver, lh_customer_gold inside folder AI_Test_Folder.", 12, C.textSecondary);

    makeRect(b3, chatX + 20, 435, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b3, chatX + 38, 447, "Stage 4: Auditor & Closed-Loop Verification", 13, C.emerald);
    makeText(b3, chatX + 38, 471, "Verified schema integrity, Delta table constraints, and foreign key surrogate mappings. 0 errors.", 12, C.textSecondary);

    makeRect(b3, chatX + 20, 515, chatW - 40, 80, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeText(b3, chatX + 38, 528, "Deployed OneLake Items (Workspace: PBT_DATA_AGENT)", 12, C.textPrimary);
    const items = ["lh_customer_bronze", "lh_customer_silver", "lh_customer_gold", "pl_customer_daily", "nb_silver_merge"];
    items.forEach((it, i) => {
        makeRect(b3, chatX + 38 + i * 165, 552, 155, 28, C.bgBase, 6, C.borderSubtle, 1);
        makeText(b3, chatX + 48 + i * 165, 558, `📦 ${it}`, 11, C.emerald);
    });

    makeRect(b3, chatX, 760, chatW, 64, C.bgSurface, 16, C.borderDock, 1);
    makeText(b3, chatX + 22, 782, "Reply to Fabric AI Studio...", 13, C.textMuted);
    makeRect(b3, chatX + chatW - 130, 772, 110, 40, C.bgSurfaceRaised, 20, C.borderCard, 1);
    makeText(b3, chatX + chatW - 110, 784, "Claude Mix", 12, C.textPrimary);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 4: APPS & CONNECTORS CATALOG
    // ═════════════════════════════════════════════════════════════════════
    const b4 = makeBoard("04 — Apps & Connector Catalog", 1540, 960);
    renderSidebar(b4, "Apps");
    renderTopbar(b4, "Apps & Connectors");

    makeText(b4, 280, 60, "Data Source Connectors", 22, C.textPrimary);
    makeText(b4, 280, 90, "Select a native connector to automatically inspect schemas and generate Medallion pipelines.", 13, C.textSecondary);

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
        const cardX = 280 + col * 370;
        const cardY = 130 + row * 230;

        makeRect(b4, cardX, cardY, 350, 205, C.bgSurface, 14, C.borderCard, 1);
        makeRect(b4, cardX + 18, cardY + 18, 44, 44, C.bgSurfaceRaised, 10, C.borderSubtle, 1);
        makeText(b4, cardX + 30, cardY + 30, "🔌", 16, C.textPrimary);

        makeRect(b4, cardX + 255, cardY + 22, 75, 24, conn.badgeBg, 12);
        makeText(b4, cardX + 268, cardY + 27, conn.status, 10, conn.badgeColor);

        makeText(b4, cardX + 18, cardY + 80, conn.name, 15, C.textPrimary);
        makeText(b4, cardX + 18, cardY + 108, conn.desc, 12, C.textSecondary);

        makeRect(b4, cardX + 18, cardY + 155, 314, 34, C.bgSurfaceRaised, 8, C.borderSubtle, 1);
        makeText(b4, cardX + 138, cardY + 164, "Configure", 12, C.textPrimary);
    });

    return {
        success: true,
        boards: [b1.name, b2.name, b3.name, b4.name]
    };
})();
"""

def main():
    print("[DEPLOY] Deploying 4 Clean Isolated Artboards to Penpot...")
    resp = requests.post(REPL_URL, json={"code": PENPOT_JS_CODE}, timeout=25)
    print(f"[STATUS] {resp.status_code}")
    print(f"[RESPONSE] {resp.text}")

if __name__ == "__main__":
    main()
