# -*- coding: utf-8 -*-
"""
deploy_14inch_16_9_design_suite.py — True 16:9 14-Inch Laptop Aspect Ratio Design Suite
--------------------------------------------------------------------------------------
Adjusts viewport dimensions to exact 16:9 (1440 x 810) laptop proportions:
- Natural vertical centering for 14" laptop screens (no zoomed-out feeling)
- Exact computed bounds from Chrome 16:9 layout
- 4 Clean, Isolated, Pixel-Perfect Artboards
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
        avatarGold: "#d97706"
    };

    // 16:9 Laptop Dimensions (1440 x 810)
    const BOARD_W = 1440;
    const BOARD_H = 810;

    function makeBoard(name, bx, by) {
        const b = penpot.createBoard();
        b.name = name;
        b.x = bx;
        b.y = by;
        b.resize(BOARD_W, BOARD_H);
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
        // 16:9 Sidebar Height: 810px
        const bg = makeRect(b, 0, 0, 260, BOARD_H, C.bgSidebar);
        bg.sendToBack();
        makeRect(b, 259, 0, 1, BOARD_H, C.borderSubtle);

        // Header: Logo + Title + Icons
        makeCircle(b, 20, 20, 10, C.emerald);
        makeCircle(b, 30, 16, 8, C.cyan);
        makeCircle(b, 29, 26, 7, C.emerald);
        makeText(b, 46, 16, "Fabric.AI", 15, C.textPrimary);
        makeText(b, 114, 17, "⌄", 12, C.textMuted);

        makeText(b, 202, 17, "◫", 13, C.textMuted);
        makeText(b, 228, 17, "🔍", 12, C.textMuted);

        // + New Chat button card
        makeRect(b, 14, 52, 232, 38, C.bgSurface, 8, C.borderCard, 1);
        makeText(b, 28, 62, "+  New Chat", 13, C.textPrimary);

        // Nav items
        const nav = [
            { icon: "📁", label: "Projects" },
            { icon: "📖", label: "Skills" },
            { icon: "🖥️", label: "Workspaces" },
            { icon: "🎛️", label: "Apps" },
            { icon: "⚙️", label: "Customize" }
        ];

        nav.forEach((it, i) => {
            const y = 100 + i * 32;
            if (activeNav === it.label) {
                makeRect(b, 14, y - 2, 232, 28, C.bgSurfaceRaised, 6);
            }
            makeText(b, 22, y + 3, it.icon, 13, C.textMuted);
            makeText(b, 46, y + 3, it.label, 13, it.label === activeNav ? C.textPrimary : C.textSecondary);
        });

        // Chats and tasks section
        makeText(b, 18, 276, "Chats and tasks", 11, C.textMuted);
        makeText(b, 114, 277, "⌄", 10, C.textMuted);

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
            const y = 300 + i * 26;
            makeText(b, 20, y + 2, "○", 8, C.textMuted);
            makeText(b, 34, y, ch, 12, i === 0 ? C.textPrimary : C.textMuted);
        });

        // Footer User Profile Card (y = 758 on 16:9 screen)
        makeRect(b, 12, 756, 236, 42, C.bgSurface, 8);
        makeCircle(b, 20, 764, 26, C.avatarGold);
        makeText(b, 28, 768, "B", 12, C.textPrimary);
        makeText(b, 54, 769, "Bheesetti Harsith", 12, C.textPrimary);
        makeRect(b, 200, 767, 38, 20, C.bgSurfaceRaised, 10);
        makeText(b, 208, 770, "PRO", 9, C.textTertiary);
    }

    function renderTopbar(b, title = "Playground") {
        makeText(b, 285, 18, title, 14, C.textPrimary);
        makeText(b, 1360, 18, "+", 16, C.textMuted);
        makeText(b, 1390, 18, "⋮", 16, C.textMuted);
        makeText(b, 1415, 18, "⤢", 14, C.textMuted);
    }

    // ═════════════════════════════════════════════════════════════════════
    // BOARD 1: 14" LAPTOP 16:9 PLAYGROUND LANDING (1440 x 810)
    // ═════════════════════════════════════════════════════════════════════
    const b1 = makeBoard("01 — 14-Inch Laptop (16:9) Playground Landing", 0, 0);
    renderSidebar(b1, "New Chat");
    renderTopbar(b1, "Playground");

    // Exact 16:9 Centered Hero Tagline (y = 300px)
    makeCircle(b1, 560, 305, 16, C.emerald);
    makeCircle(b1, 578, 299, 12, C.cyan);
    makeCircle(b1, 576, 315, 11, C.emerald);
    makeText(b1, 602, 300, "Time for some creative brainstorming.", 26, C.textPrimary);

    // Exact 16:9 Centered Prompt Dock (y = 372px)
    const dockX = 480, dockY = 372, dockW = 740, dockH = 136;
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
    // BOARD 2: 14" LAPTOP 16:9 ACTIVE MULTI-AGENT STATE (1440 x 810)
    // ═════════════════════════════════════════════════════════════════════
    const b2 = makeBoard("02 — 14-Inch Laptop (16:9) Active Multi-Agent State", 1540, 0);
    renderSidebar(b2, "Projects");
    renderTopbar(b2, "Enterprise Retail Medallion");

    const chatX = 380, chatW = 900;
    makeRect(b2, chatX, 55, chatW, 58, C.bgSurfaceRaised, 12, C.borderCard, 1);
    makeText(b2, chatX + 20, 68, "👤 You", 11, C.textMuted);
    makeText(b2, chatX + 20, 86, "Architect a 3-tier Medallion lakehouse for CustomerDB with nightly incremental Delta MERGE", 13, C.textPrimary);

    makeRect(b2, chatX, 125, chatW, 540, C.bgSurface, 16, C.borderCard, 1);
    makeCircle(b2, chatX + 20, 145, 10, C.emerald);
    makeText(b2, chatX + 38, 141, "Fabric AI Studio", 13, C.emerald);
    makeRect(b2, chatX + chatW - 140, 137, 120, 26, C.bgSurfaceRaised, 13, C.borderCard, 1);
    makeText(b2, chatX + chatW - 128, 143, "⚡ Execution 11.2s", 11, C.textSecondary);

    makeRect(b2, chatX + 20, 175, chatW - 40, 62, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 185, "Stage 1: Meta-Planner & Strategy Classifier", 13, C.textPrimary);
    makeText(b2, chatX + 38, 206, "Discovered 5 tables in CustomerDB. Classified Orders -> Incremental, Customers -> Full.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 247, chatW - 40, 62, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 257, "Stage 2: Parallel SQLGlot AST & PySpark Synthesis", 13, C.textPrimary);
    makeText(b2, chatX + 38, 278, "Transpiled 14 T-SQL stored procedures to native PySpark Delta MERGE scripts. AST passed.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 319, chatW - 40, 62, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 329, "Stage 3: Medallion Lakehouse Builder", 13, C.textPrimary);
    makeText(b2, chatX + 38, 350, "Provisioned: lh_customer_bronze, lh_customer_silver, lh_customer_gold in AI_Test_Folder.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 391, chatW - 40, 62, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b2, chatX + 38, 401, "Stage 4: Auditor & Closed-Loop Verification", 13, C.emerald);
    makeText(b2, chatX + 38, 422, "Verified schema integrity, Delta table constraints, and surrogate keys. 0 errors.", 12, C.textSecondary);

    makeRect(b2, chatX + 20, 465, chatW - 40, 72, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeText(b2, chatX + 38, 477, "Deployed OneLake Items (Workspace: PBT_DATA_AGENT)", 12, C.textPrimary);
    const items = ["lh_customer_bronze", "lh_customer_silver", "lh_customer_gold", "pl_customer_daily", "nb_silver_merge"];
    items.forEach((it, i) => {
        makeRect(b2, chatX + 38 + i * 165, 498, 155, 26, C.bgBase, 6, C.borderSubtle, 1);
        makeText(b2, chatX + 48 + i * 165, 503, `📦 ${it}`, 11, C.emerald);
    });

    makeRect(b2, chatX, 680, chatW, 58, C.bgSurface, 16, C.borderDock, 1);
    makeText(b2, chatX + 22, 700, "Reply to Fabric AI Studio...", 13, C.textMuted);
    makeRect(b2, chatX + chatW - 130, 690, 110, 38, C.bgSurfaceRaised, 20, C.borderCard, 1);
    makeText(b2, chatX + chatW - 110, 701, "Claude Mix", 12, C.textPrimary);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 3: 14" LAPTOP 16:9 APPS & CONNECTORS CATALOG (1440 x 810)
    // ═════════════════════════════════════════════════════════════════════
    const b3 = makeBoard("03 — 14-Inch Laptop (16:9) Apps & Connector Catalog", 0, 870);
    renderSidebar(b3, "Apps");
    renderTopbar(b3, "Apps & Connectors");

    makeText(b3, 280, 50, "Data Source Connectors", 20, C.textPrimary);
    makeText(b3, 280, 76, "Select a native connector to automatically inspect schemas and generate Medallion pipelines.", 12, C.textSecondary);

    const connectors = [
        { name: "Azure SQL / SQL Server", status: "LIVE", badgeBg: "#064e3b", badgeColor: C.emerald, desc: "Direct sys.tables & metadata extraction with column lineage." },
        { name: "SAP (HANA / ODP)", status: "LIVE", badgeBg: "#064e3b", badgeColor: C.emerald, desc: "RFC / OData connector with automated ABAP table transpilation." },
        { name: "Snowflake Cloud", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "Information Schema extraction with multi-cluster pushdown." },
        { name: "Salesforce Data Cloud", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "REST Object & Entity API ingestion with CDC watermarking." },
        { name: "Amazon Redshift", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "PG catalog discovery with Spectrum external table support." },
        { name: "Google BigQuery", status: "CATALOG", badgeBg: "#1e293b", badgeColor: C.cyan, desc: "BigQuery Storage API connector with partition pruning." }
    ];

    connectors.forEach((conn, idx) => {
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const cardX = 280 + col * 370;
        const cardY = 110 + row * 215;

        makeRect(b3, cardX, cardY, 350, 195, C.bgSurface, 14, C.borderCard, 1);
        makeRect(b3, cardX + 18, cardY + 18, 40, 40, C.bgSurfaceRaised, 10, C.borderSubtle, 1);
        makeText(b3, cardX + 28, cardY + 28, "🔌", 15, C.textPrimary);

        makeRect(b3, cardX + 255, cardY + 20, 75, 24, conn.badgeBg, 12);
        makeText(b3, cardX + 268, cardY + 25, conn.status, 10, conn.badgeColor);

        makeText(b3, cardX + 18, cardY + 74, conn.name, 14, C.textPrimary);
        makeText(b3, cardX + 18, cardY + 100, conn.desc, 12, C.textSecondary);

        makeRect(b3, cardX + 18, cardY + 145, 314, 34, C.bgSurfaceRaised, 8, C.borderSubtle, 1);
        makeText(b3, cardX + 138, cardY + 154, "Configure", 12, C.textPrimary);
    });


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 4: 14" LAPTOP 16:9 MASTER DESIGN SYSTEM & ATOMS (1440 x 810)
    // ═════════════════════════════════════════════════════════════════════
    const b4 = makeBoard("04 — 14-Inch Laptop (16:9) Design System & Component Library", 1540, 870);

    makeText(b4, 40, 30, "Fabric AI Studio — Design System Tokens (16:9 Laptop Proportions)", 20, C.textPrimary);

    makeText(b4, 40, 75, "SURFACE & ACCENT PALETTE", 11, C.textMuted);
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
        makeRect(b4, 40 + i * 165, 100, 145, 75, s.hex, 10, C.borderCard, 1);
        makeText(b4, 48, 138, s.name, 11, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textSecondary : C.bgBase);
        makeText(b4, 48, 154, s.hex, 10, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textMuted : C.bgBase);
    });

    makeText(b4, 40, 205, "BUTTONS & INTERACTIVE PILLS", 11, C.textMuted);
    makeRect(b4, 40, 230, 150, 36, C.bgSurface, 8, C.borderCard, 1);
    makeText(b4, 60, 240, "+  New Chat", 12, C.textPrimary);

    makeRect(b4, 210, 230, 150, 36, C.bgPill, 18, C.borderCard, 1);
    makeText(b4, 228, 240, "Claude Mix", 12, C.textPrimary);
    makeText(b4, 300, 241, "High ⌄", 11, C.textTertiary);

    makeRect(b4, 380, 230, 95, 36, C.bgPill, 8);
    makeText(b4, 398, 240, "⊞ Tools", 12, C.textSecondary);

    makeRect(b4, 495, 230, 130, 36, C.emerald, 8);
    makeText(b4, 518, 240, "Deploy Plan", 12, C.bgBase);

    makeText(b4, 40, 295, "PROFILE & STATUS PILLS", 11, C.textMuted);
    makeRect(b4, 40, 320, 228, 42, C.bgSurface, 8);
    makeCircle(b4, 48, 328, 24, C.avatarGold);
    makeText(b4, 56, 332, "B", 12, C.textPrimary);
    makeText(b4, 78, 332, "Bheesetti Harsith", 12, C.textPrimary);
    makeRect(b4, 208, 330, 38, 20, C.bgSurfaceRaised, 10);
    makeText(b4, 216, 333, "PRO", 9, C.textTertiary);

    return {
        success: true,
        boards: [b1.name, b2.name, b3.name, b4.name]
    };
})();
"""

def main():
    print("[DEPLOY] Deploying 16:9 (1440x810) 14-Inch Laptop Proportioned Suite to Penpot...")
    resp = requests.post(REPL_URL, json={"code": PENPOT_JS_CODE}, timeout=25)
    print(f"[STATUS] {resp.status_code}")
    print(f"[RESPONSE] {resp.text}")

if __name__ == "__main__":
    main()
