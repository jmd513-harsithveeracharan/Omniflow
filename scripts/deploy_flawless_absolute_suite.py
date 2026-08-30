# -*- coding: utf-8 -*-
"""
test_send_to_back.py — Test bringing all text and icons to front
"""
import json
import requests

REPL_URL = "http://localhost:4403/execute"

code = """
(() => {
    const page = penpot.currentPage;
    if (!page) return { error: "no page" };
    
    // Clear everything
    page.findShapes().forEach(s => s.remove());
    
    const C = {
        bgBase: "#131314",
        bgSidebar: "#171819",
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
        avatarGold: "#d97706"
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
        const bg = makeRect(b, 0, 0, 240, 900, C.bgSidebar);
        bg.sendToBack();
        
        const div = makeRect(b, 239, 0, 1, 900, C.borderSubtle);
        
        // Header
        makeCircle(b, 18, 20, 10, C.emerald);
        makeCircle(b, 28, 16, 8, C.cyan);
        makeCircle(b, 27, 26, 7, C.emerald);
        makeText(b, 42, 16, "Fabric.AI", 15, C.textPrimary);
        makeText(b, 108, 17, "⌄", 12, C.textMuted);
        makeText(b, 186, 17, "◫", 13, C.textMuted);
        makeText(b, 210, 17, "🔍", 12, C.textMuted);

        // New Chat
        makeRect(b, 12, 54, 216, 38, C.bgSurface, 8, C.borderCard, 1);
        makeText(b, 26, 64, "+  New Chat", 13, C.textPrimary);

        // Nav
        const nav = [
            { icon: "📁", label: "Projects" },
            { icon: "📖", label: "Skills" },
            { icon: "🖥️", label: "Workspaces" },
            { icon: "🎛️", label: "Apps" },
            { icon: "⚙️", label: "Customize" }
        ];
        nav.forEach((it, i) => {
            const y = 104 + i * 34;
            if (activeNav === it.label) {
                makeRect(b, 12, y - 2, 216, 30, C.bgSurfaceRaised, 6);
            }
            makeText(b, 20, y + 4, it.icon, 13, C.textMuted);
            makeText(b, 42, y + 4, it.label, 13, it.label === activeNav ? C.textPrimary : C.textSecondary);
        });

        // Chats
        makeText(b, 16, 290, "Chats and tasks", 11, C.textMuted);
        makeText(b, 108, 291, "⌄", 10, C.textMuted);

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
            const y = 316 + i * 28;
            makeText(b, 18, y + 2, "○", 8, C.textMuted);
            makeText(b, 32, y, ch, 12, i === 0 ? C.textPrimary : C.textMuted);
        });

        // Profile
        makeRect(b, 12, 842, 216, 44, C.bgSurface, 8);
        makeCircle(b, 20, 851, 26, C.avatarGold);
        makeText(b, 28, 855, "B", 12, C.textPrimary);
        makeText(b, 52, 856, "Bheesetti Harsith", 12, C.textPrimary);
        makeRect(b, 182, 854, 38, 20, C.bgSurfaceRaised, 10);
        makeText(b, 190, 857, "PRO", 9, C.textTertiary);
    }

    function renderTopbar(b, title = "Playground") {
        makeText(b, 265, 20, title, 14, C.textPrimary);
        makeText(b, 1360, 20, "+", 16, C.textMuted);
        makeText(b, 1390, 20, "⋮", 16, C.textMuted);
        makeText(b, 1415, 20, "⤢", 14, C.textMuted);
    }

    // BOARD 1: PLAYGROUND
    const b1 = makeBoard("01 — Playground Landing (Authentic Web View)", 0, 0);
    renderSidebar(b1, "New Chat");
    renderTopbar(b1, "Playground");

    makeCircle(b1, 550, 360, 16, C.emerald);
    makeCircle(b1, 568, 354, 12, C.cyan);
    makeCircle(b1, 566, 370, 11, C.emerald);
    makeText(b1, 592, 355, "Time for some creative brainstorming.", 26, C.textPrimary);

    const dockX = 480, dockY = 415, dockW = 740, dockH = 135;
    makeRect(b1, dockX, dockY, dockW, dockH, C.bgSurface, 18, C.borderDock, 1);
    makeText(b1, dockX + 22, dockY + 22, "Start typing a prompt to see what our models can do...", 13, C.textMuted);

    makeRect(b1, dockX + 20, dockY + 82, 34, 32, C.bgPill, 8);
    makeText(b1, dockX + 31, dockY + 89, "🎛️", 12, C.textSecondary);

    makeRect(b1, dockX + 62, dockY + 82, 72, 32, C.bgPill, 8);
    makeText(b1, dockX + 74, dockY + 89, "⊞ Tools", 12, C.textSecondary);

    const modelPillX = dockX + dockW - 250;
    makeRect(b1, modelPillX, dockY + 82, 140, 32, C.bgPill, 16, C.borderCard, 1);
    makeText(b1, modelPillX + 14, dockY + 89, "Claude Mix", 12, C.textPrimary);
    makeText(b1, modelPillX + 85, dockY + 90, "High", 11, C.textTertiary);
    makeText(b1, modelPillX + 118, dockY + 90, "⌄", 10, C.textMuted);
    makeText(b1, modelPillX + 160, dockY + 88, "🎙️", 13, C.textMuted);
    makeText(b1, modelPillX + 195, dockY + 88, "🔊", 13, C.textMuted);


    // BOARD 2: ACTIVE MULTI-AGENT STATE
    const b2 = makeBoard("02 — Active Multi-Agent Execution State", 1540, 0);
    renderSidebar(b2, "Projects");
    renderTopbar(b2, "Enterprise Retail Medallion");

    const chatX = 380, chatW = 900;
    makeRect(b2, chatX, 60, chatW, 64, C.bgSurfaceRaised, 12, C.borderCard, 1);
    makeText(b2, chatX + 20, 74, "👤 You", 11, C.textMuted);
    makeText(b2, chatX + 20, 94, "Architect a 3-tier Medallion lakehouse for CustomerDB with nightly incremental Delta MERGE", 13, C.textPrimary);

    makeRect(b2, chatX, 140, chatW, 600, C.bgSurface, 16, C.borderCard, 1);
    makeCircle(b2, chatX + 20, 162, 10, C.emerald);
    makeText(b2, chatX + 38, 158, "Fabric AI Studio", 13, C.emerald);
    makeRect(b2, chatX + chatW - 140, 154, 120, 26, C.bgSurfaceRaised, 13, C.borderCard, 1);
    makeText(b2, chatX + chatW - 128, 160, "⚡ Execution 11.2s", 11, C.textSecondary);

    makeRect(b2, chatX + 20, 195, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 207, "Stage 1: Meta-Planner & Strategy Classifier", 13, C.textPrimary);
    makeText(b2, chatX + 38, 231, "Discovered 5 tables in CustomerDB. Classified Orders -> Incremental (MERGE_UPSERT), Customers -> Full (OVERWRITE).", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 275, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 287, "Stage 2: Parallel SQLGlot AST & PySpark Synthesis", 13, C.textPrimary);
    makeText(b2, chatX + 38, 311, "Transpiled 14 T-SQL stored procedures to native PySpark Delta MERGE scripts. AST validation passed.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 355, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 367, "Stage 3: Medallion Lakehouse Builder", 13, C.textPrimary);
    makeText(b2, chatX + 38, 391, "Provisioned: lh_customer_bronze, lh_customer_silver, lh_customer_gold inside folder AI_Test_Folder.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 435, chatW - 40, 68, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 447, "Stage 4: Auditor & Closed-Loop Verification", 13, C.emerald);
    makeText(b2, chatX + 38, 471, "Verified schema integrity, Delta table constraints, and foreign key surrogate mappings. 0 errors.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 515, chatW - 40, 80, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeText(b2, chatX + 38, 528, "Deployed OneLake Items (Workspace: PBT_DATA_AGENT)", 12, C.textPrimary);
    const items = ["lh_customer_bronze", "lh_customer_silver", "lh_customer_gold", "pl_customer_daily", "nb_silver_merge"];
    items.forEach((it, i) => {
        makeRect(b2, chatX + 38 + i * 165, 552, 155, 28, C.bgBase, 6, C.borderSubtle, 1);
        makeText(b2, chatX + 48 + i * 165, 558, `📦 ${it}`, 11, C.emerald);
    });

    makeRect(b2, chatX, 760, chatW, 64, C.bgSurface, 16, C.borderDock, 1);
    makeText(b2, chatX + 22, 782, "Reply to Fabric AI Studio...", 13, C.textMuted);
    makeRect(b2, chatX + chatW - 130, 772, 110, 40, C.bgSurfaceRaised, 20, C.borderCard, 1);
    makeText(b2, chatX + chatW - 110, 784, "Claude Mix", 12, C.textPrimary);


    // BOARD 3: APPS & CONNECTORS
    const b3 = makeBoard("03 — Apps & Connector Catalog", 0, 960);
    renderSidebar(b3, "Apps");
    renderTopbar(b3, "Apps & Connectors");

    makeText(b3, 280, 60, "Data Source Connectors", 22, C.textPrimary);
    makeText(b3, 280, 90, "Select a native connector to automatically inspect schemas and generate Medallion pipelines.", 13, C.textSecondary);

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

        makeRect(b3, cardX, cardY, 350, 205, C.bgSurface, 14, C.borderCard, 1);
        makeRect(b3, cardX + 18, cardY + 18, 44, 44, C.bgSurfaceRaised, 10, C.borderSubtle, 1);
        makeText(b3, cardX + 30, cardY + 30, "🔌", 16, C.textPrimary);

        makeRect(b3, cardX + 255, cardY + 22, 75, 24, conn.badgeBg, 12);
        makeText(b3, cardX + 268, cardY + 27, conn.status, 10, conn.badgeColor);

        makeText(b3, cardX + 18, cardY + 80, conn.name, 15, C.textPrimary);
        makeText(b3, cardX + 18, cardY + 108, conn.desc, 12, C.textSecondary);

        makeRect(b3, cardX + 18, cardY + 155, 314, 34, C.bgSurfaceRaised, 8, C.borderSubtle, 1);
        makeText(b3, cardX + 138, cardY + 164, "Configure", 12, C.textPrimary);
    });


    // BOARD 4: MASTER DESIGN SYSTEM
    const b4 = makeBoard("04 — Master Design System & UI Component Library", 1540, 960);

    makeText(b4, 40, 35, "Fabric AI Studio — Design System Tokens & Component Atoms", 22, C.textPrimary);

    makeText(b4, 40, 85, "SURFACE & ACCENT PALETTE (GOOGLE AI STUDIO DARK)", 12, C.textMuted);
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
        makeText(b4, 48, 155, s.name, 11, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textSecondary : C.bgBase);
        makeText(b4, 48, 172, s.hex, 10, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textMuted : C.bgBase);
    });

    makeText(b4, 40, 230, "BUTTONS & INTERACTIVE PILLS", 12, C.textMuted);
    makeRect(b4, 40, 260, 160, 38, C.bgSurface, 8, C.borderCard, 1);
    makeText(b4, 65, 271, "+  New Chat", 13, C.textPrimary);

    makeRect(b4, 220, 260, 160, 38, C.bgPill, 19, C.borderCard, 1);
    makeText(b4, 240, 271, "Claude Mix", 12, C.textPrimary);
    makeText(b4, 315, 272, "High ⌄", 11, C.textTertiary);

    makeRect(b4, 400, 260, 100, 38, C.bgPill, 8);
    makeText(b4, 420, 271, "⊞ Tools", 12, C.textSecondary);

    makeRect(b4, 520, 260, 140, 38, C.emerald, 8);
    makeText(b4, 545, 271, "Deploy Plan", 12, C.bgBase);

    makeText(b4, 40, 330, "PROFILE & STATUS PILLS", 12, C.textMuted);
    makeRect(b4, 40, 360, 228, 44, C.bgSurface, 8);
    makeCircle(b4, 50, 370, 24, C.avatarGold);
    makeText(b4, 58, 374, "B", 12, C.textPrimary);
    makeText(b4, 82, 374, "Bheesetti Harsith", 12, C.textPrimary);
    makeRect(b4, 215, 372, 38, 20, C.bgSurfaceRaised, 10);
    makeText(b4, 223, 375, "PRO", 9, C.textTertiary);

    return {
        success: true,
        boards: [b1.name, b2.name, b3.name, b4.name]
    };
})();
"""

def main():
    print("[DEPLOY] Sending 100% Correct Absolute Positioned Boards to Penpot...")
    resp = requests.post(REPL_URL, json={"code": code}, timeout=25)
    print(f"[STATUS] {resp.status_code}")
    print(f"[RESPONSE] {resp.text}")

if __name__ == "__main__":
    main()
