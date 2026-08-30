# -*- coding: utf-8 -*-
"""
deploy_master_16_9_full_suite.py — Master 6-Board 16:9 Design Suite for Penpot
-------------------------------------------------------------------------------
Contains the complete spectrum of Fabric AI Studio components, modals, and menus:
- Board 1: Playground Landing (16:9)
- Board 2: Modals, Popups & Flyout Dropdown Menus (16:9)
- Board 3: Settings & Customize Modal (16:9)
- Board 4: Safe Delete & Governance Blast-Radius Modal (16:9)
- Board 5: Activity & PySpark Code Inspector Drawer (16:9)
- Board 6: Master Design System & UI Component Library (16:9)
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
        rose: "#f28b82",
        redBg: "#450a0a",
        redBorder: "#7f1d1d"
    };

    const W = 1440, H = 810;

    function makeBoard(name, bx, by) {
        const b = penpot.createBoard();
        b.name = name;
        b.x = bx;
        b.y = by;
        b.resize(W, H);
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
        const bg = makeRect(b, 0, 0, 260, H, C.bgSidebar);
        bg.sendToBack();
        makeRect(b, 259, 0, 1, H, C.borderSubtle);

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

        // Footer User Profile Card (y = 756 on 16:9)
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
    // BOARD 1: PLAYGROUND LANDING (16:9)
    // ═════════════════════════════════════════════════════════════════════
    const b1 = makeBoard("01 — Playground Landing View", 0, 0);
    renderSidebar(b1, "New Chat");
    renderTopbar(b1, "Playground");

    makeCircle(b1, 560, 305, 16, C.emerald);
    makeCircle(b1, 578, 299, 12, C.cyan);
    makeCircle(b1, 576, 315, 11, C.emerald);
    makeText(b1, 602, 300, "Time for some creative brainstorming.", 26, C.textPrimary);

    const dockX = 480, dockY = 372, dockW = 740, dockH = 136;
    makeRect(b1, dockX, dockY, dockW, dockH, C.bgSurface, 18, C.borderDock, 1);
    makeText(b1, dockX + 24, dockY + 24, "Start typing a prompt to see what our models can do...", 13, C.textMuted);

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
    // BOARD 2: ALL POPUPS, DROPDOWNS & FLYOUT MENUS (16:9)
    // ═════════════════════════════════════════════════════════════════════
    const b2 = makeBoard("02 — Floating Dropdowns & Flyout Menus", 1540, 0);
    makeText(b2, 40, 30, "Fabric AI Studio — Floating Dropdown & Flyout Menu States", 20, C.textPrimary);

    // 1. Brand Platform Switcher Dropdown (Line 33 of index.html)
    makeText(b2, 40, 75, "1. PLATFORM SWITCHER MENU", 11, C.textMuted);
    const m1X = 40, m1Y = 100, m1W = 200, m1H = 175;
    makeRect(b2, m1X, m1Y, m1W, m1H, C.bgSurface, 12, C.borderCard, 1);
    
    const platforms = [
        { name: "Fabric.AI", active: true, color: C.emerald },
        { name: "Databricks.AI", active: false, color: "#ff3621" },
        { name: "Snowflake.AI", active: false, color: "#29b5e8" },
        { name: "dbt.AI", active: false, color: "#ff694b" }
    ];
    platforms.forEach((p, i) => {
        const y = m1Y + 10 + i * 38;
        if (p.active) makeRect(b2, m1X + 8, y, m1W - 16, 34, C.bgSurfaceRaised, 8);
        makeCircle(b2, m1X + 22, y + 10, 12, p.color);
        makeText(b2, m1X + 44, y + 8, p.name, 13, p.active ? C.textPrimary : C.textSecondary);
        if (p.active) makeText(b2, m1X + m1W - 28, y + 8, "✓", 12, C.emerald);
    });

    // 2. Model Selector Dropdown & Effort Flyout (Line 250 of index.html)
    makeText(b2, 280, 75, "2. MODEL SELECTOR & EFFORT FLYOUT", 11, C.textMuted);
    const m2X = 280, m2Y = 100, m2W = 240, m2H = 260;
    makeRect(b2, m2X, m2Y, m2W, m2H, C.bgSurface, 14, C.borderCard, 1);
    
    // Primary Option
    makeRect(b2, m2X + 10, m2Y + 10, m2W - 20, 52, C.bgSurfaceRaised, 8);
    makeText(b2, m2X + 22, m2Y + 16, "Gemini 3.6 Flash", 13, C.textPrimary);
    makeText(b2, m2X + 22, m2Y + 36, "Most efficient for daily tasks", 10, C.textMuted);
    makeText(b2, m2X + m2W - 32, m2Y + 24, "✓", 12, C.cyan);

    makeRect(b2, m2X + 12, m2Y + 70, m2W - 24, 1, C.borderSubtle);

    // Effort Row with Flyout Trigger
    makeRect(b2, m2X + 10, m2Y + 78, m2W - 20, 36, C.bgSurfaceRaised, 8);
    makeText(b2, m2X + 22, m2Y + 88, "Effort", 13, C.textPrimary);
    makeText(b2, m2X + m2W - 75, m2Y + 88, "High ▸", 12, C.textTertiary);

    // Additional models
    const extraModels = ["Claude 3.7 Sonnet", "Gemini 2.5 Pro", "Llama 3.3 70B (Groq)"];
    extraModels.forEach((m, i) => {
        const y = m2Y + 122 + i * 36;
        makeText(b2, m2X + 22, y + 8, m, 12, C.textSecondary);
    });

    // Flyout Effort Submenu (attached to right of Effort row)
    const flyX = m2X + m2W + 8, flyY = m2Y + 78, flyW = 120, flyH = 120;
    makeRect(b2, flyX, flyY, flyW, flyH, C.bgSurface, 10, C.borderCard, 1);
    
    const efforts = [{ label: "High", active: true }, { label: "Medium", active: false }, { label: "Low", active: false }];
    efforts.forEach((ef, i) => {
        const y = flyY + 8 + i * 34;
        if (ef.active) makeRect(b2, flyX + 6, y, flyW - 12, 30, C.bgSurfaceRaised, 6);
        makeText(b2, flyX + 16, y + 6, ef.label, 12, ef.active ? C.textPrimary : C.textSecondary);
        if (ef.active) makeText(b2, flyX + flyW - 24, y + 6, "✓", 11, C.emerald);
    });

    // 3. User Profile Dropdown Menu (Line 150 of index.html)
    makeText(b2, 690, 75, "3. USER PROFILE POPUP", 11, C.textMuted);
    const m3X = 690, m3Y = 100, m3W = 240, m3H = 175;
    makeRect(b2, m3X, m3Y, m3W, m3H, C.bgSurface, 12, C.borderCard, 1);

    // Profile header
    makeCircle(b2, m3X + 20, m3Y + 18, 30, C.avatarGold);
    makeText(b2, m3X + 30, m3Y + 23, "B", 14, C.textPrimary);
    makeText(b2, m3X + 60, m3Y + 16, "Bheesetti Harsith", 13, C.textPrimary);
    makeText(b2, m3X + 60, m3Y + 34, "bheesetti.harsith@fabric.ai", 10, C.textMuted);

    makeRect(b2, m3X + 14, m3Y + 62, m3W - 28, 1, C.borderSubtle);

    // Settings item
    makeText(b2, m3X + 20, m3Y + 80, "⚙️", 13, C.textMuted);
    makeText(b2, m3X + 46, m3Y + 80, "Settings & Customize", 12, C.textSecondary);

    // Sign out item
    makeText(b2, m3X + 20, m3Y + 118, "🚪", 13, C.textMuted);
    makeText(b2, m3X + 46, m3Y + 118, "Sign out", 12, C.rose);

    // 4. Tools Menu Popup (Line 235 of index.html)
    makeText(b2, 970, 75, "4. ACTIVE MODEL TOOLS MENU", 11, C.textMuted);
    const m4X = 970, m4Y = 100, m4W = 280, m4H = 210;
    makeRect(b2, m4X, m4Y, m4W, m4H, C.bgSurface, 12, C.borderCard, 1);
    
    makeText(b2, m4X + 16, m4Y + 14, "Active Agent Capabilities", 12, C.textPrimary);
    
    const tools = [
        { name: "SQLGlot AST Transpiler", desc: "T-SQL / Oracle / SAP to Spark SQL", on: true },
        { name: "Delta Lake MERGE Upserter", desc: "Automated incremental watermarking", on: true },
        { name: "OneLake Blast-Radius Guard", desc: "Safe delete & base64 backups", on: true },
        { name: "Great Expectations Validator", desc: "Schema constraint verification", on: false }
    ];
    tools.forEach((tl, i) => {
        const y = m4Y + 40 + i * 40;
        makeRect(b2, m4X + 12, y, m4W - 24, 34, C.bgBase, 6, C.borderSubtle, 1);
        makeText(b2, m4X + 22, y + 5, tl.name, 11, C.textPrimary);
        makeText(b2, m4X + 22, y + 19, tl.desc, 9, C.textMuted);
        makeRect(b2, m4X + m4W - 54, y + 8, 30, 16, tl.on ? C.emerald : C.bgPill, 8);
    });


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 3: SETTINGS & CUSTOMIZE MODAL (Line 1500 of index.html)
    // ═════════════════════════════════════════════════════════════════════
    const b3 = makeBoard("03 — Settings & Customize Modal", 0, 870);
    renderSidebar(b3, "Customize");
    renderTopbar(b3, "Settings & Customize");

    // Modal Backdrop Dimmer
    const scrim = makeRect(b3, 260, 56, W - 260, H - 56, "#000000");
    scrim.fills = [{ fillColor: "#000000", fillOpacity: 0.65 }];

    // Modal Card
    const setW = 680, setH = 580;
    const setX = 260 + (W - 260 - setW) / 2, setY = 56 + (H - 56 - setH) / 2;
    makeRect(b3, setX, setY, setW, setH, C.bgSurface, 16, C.borderCard, 1);

    // Modal Header
    makeText(b3, setX + 24, setY + 20, "Settings & Customization", 16, C.textPrimary);
    makeText(b3, setX + 24, setY + 42, "Configure agent behavior, workspace security, and model preferences.", 12, C.textMuted);
    makeText(b3, setX + setW - 40, setY + 20, "✕", 14, C.textMuted);

    makeRect(b3, setX + 24, setY + 68, setW - 48, 1, C.borderSubtle);

    // Settings Fields
    // Field 1: Allowed Workspace ID Lock
    makeText(b3, setX + 24, setY + 84, "Microsoft Fabric Workspace Lock (Zero-Hardcoding)", 12, C.textPrimary);
    makeRect(b3, setX + 24, setY + 104, setW - 48, 38, C.bgBase, 8, C.borderCard, 1);
    makeText(b3, setX + 36, setY + 114, "db7344c1-ecd9-44d6-849f-f2de49484f9f (PBT_DATA_AGENT)", 12, C.emerald);

    // Field 2: Token Budget Cap & Turn Window
    makeText(b3, setX + 24, setY + 154, "Agent Rolling Token Budget Cap", 12, C.textPrimary);
    makeRect(b3, setX + 24, setY + 174, setW - 48, 38, C.bgBase, 8, C.borderCard, 1);
    makeText(b3, setX + 36, setY + 184, "2,200 tokens / 10-turn conversation rolling window", 12, C.textSecondary);

    // Field 3: Default Pipeline Schedule
    makeText(b3, setX + 24, setY + 224, "Default Medallion Ingestion Schedule", 12, C.textPrimary);
    makeRect(b3, setX + 24, setY + 244, setW - 48, 38, C.bgBase, 8, C.borderCard, 1);
    makeText(b3, setX + 36, setY + 254, "Nightly at 02:00 UTC (cron: 0 2 * * *)", 12, C.textSecondary);

    // Field 4: System Prompt Custom Instructions
    makeText(b3, setX + 24, setY + 294, "Custom Agent Persona & Guardrails", 12, C.textPrimary);
    makeRect(b3, setX + 24, setY + 314, setW - 48, 90, C.bgBase, 8, C.borderCard, 1);
    makeText(b3, setX + 36, setY + 326, "Always enforce Medallion 3-tier architecture. Transpile all legacy SQL procedures to", 11, C.textMuted);
    makeText(b3, setX + 36, setY + 344, "Delta Lake PySpark notebooks inside AI_Test_Folder.", 11, C.textMuted);

    // Field 5: LLM Model Provider
    makeText(b3, setX + 24, setY + 418, "Primary LLM Provider", 12, C.textPrimary);
    makeRect(b3, setX + 24, setY + 438, 200, 36, C.bgBase, 8, C.borderCard, 1);
    makeText(b3, setX + 36, setY + 448, "Claude Mix (Native)", 12, C.cyan);

    // Modal Footer
    makeRect(b3, setX + 24, setY + 500, setW - 48, 1, C.borderSubtle);
    makeRect(b3, setX + setW - 200, setY + 520, 80, 36, C.bgSurfaceRaised, 8);
    makeText(b3, setX + setW - 180, setY + 530, "Cancel", 12, C.textSecondary);

    makeRect(b3, setX + setW - 110, setY + 520, 90, 36, C.emerald, 8);
    makeText(b3, setX + setW - 96, setY + 530, "Save Config", 12, C.bgBase);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 4: SAFE DELETE & GOVERNANCE BLAST-RADIUS MODAL (Line 1350)
    // ═════════════════════════════════════════════════════════════════════
    const b4 = makeBoard("04 — Safe Delete & Governance Modal", 1540, 870);
    renderSidebar(b4, "Workspaces");
    renderTopbar(b4, "Workspace Items");

    const scrim4 = makeRect(b4, 260, 56, W - 260, H - 56, "#000000");
    scrim4.fills = [{ fillColor: "#000000", fillOpacity: 0.70 }];

    const delW = 560, delH = 440;
    const delX = 260 + (W - 260 - delW) / 2, delY = 56 + (H - 56 - delH) / 2;
    makeRect(b4, delX, delY, delW, delH, C.bgSurface, 16, C.redBorder, 1.5);

    // Warning Shield Icon & Title
    makeCircle(b4, delX + 24, delY + 22, 34, C.redBg);
    makeText(b4, delX + 33, delY + 28, "⚠️", 15, C.rose);
    makeText(b4, delX + 70, delY + 24, "High-Risk Destructive Action Detected", 15, C.rose);
    makeText(b4, delX + 70, delY + 44, "Blast-Radius Impact Analyzer has flagged this operation.", 11, C.textMuted);

    makeRect(b4, delX + 24, delY + 70, delW - 48, 1, C.borderSubtle);

    // Impact Analysis Box
    makeRect(b4, delX + 24, delY + 84, delW - 48, 110, C.bgBase, 10, C.borderSubtle, 1);
    makeText(b4, delX + 36, delY + 96, "Affected Item: lh_customer_silver (Delta Table: dbo.Orders)", 12, C.textPrimary);
    makeText(b4, delX + 36, delY + 118, "• Dependent Pipelines: 2 (pl_customer_daily, pl_sales_reconciliation)", 11, C.textSecondary);
    makeText(b4, delX + 36, delY + 138, "• Power BI Semantic Models: 1 (sm_customer_analytics DirectLake)", 11, C.textSecondary);
    makeText(b4, delX + 36, delY + 158, "• Automated Snapshot: Saved to _deleted_archive/2026-08-30_Orders.b64", 10, C.emerald);

    // Safety Typing Gate
    makeText(b4, delX + 24, delY + 210, "To confirm destruction, type OVERWRITE ORDERS below:", 12, C.textPrimary);
    makeRect(b4, delX + 24, delY + 232, delW - 48, 40, C.bgBase, 8, C.borderCard, 1);
    makeText(b4, delX + 36, delY + 244, "OVERWRITE ORDERS", 12, C.textPrimary);

    // Modal Footer
    makeRect(b4, delX + 24, delY + 290, delW - 48, 1, C.borderSubtle);
    makeRect(b4, delX + delW - 200, delY + 310, 80, 36, C.bgSurfaceRaised, 8);
    makeText(b4, delX + delW - 180, delY + 320, "Cancel", 12, C.textSecondary);

    makeRect(b4, delX + delW - 110, delY + 310, 90, 36, C.rose, 8);
    makeText(b4, delX + delW - 96, delY + 320, "Confirm Delete", 12, C.bgBase);


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 5: ACTIVITY & MONACO PYSPARK CODE DRAWER (Line 1200)
    // ═════════════════════════════════════════════════════════════════════
    const b5 = makeBoard("05 — Activity & PySpark Code Inspector Drawer", 0, 1740);
    renderSidebar(b5, "Projects");
    renderTopbar(b5, "PySpark Code Viewer");

    // Left Main Chat view
    const mainX = 280, mainW = 560;
    makeRect(b5, mainX, 70, mainW, 60, C.bgSurfaceRaised, 10, C.borderCard, 1);
    makeText(b5, mainX + 16, 82, "👤 Directive", 11, C.textMuted);
    makeText(b5, mainX + 16, 100, "Transpile Customer_MDM T-SQL procedure to native Delta MERGE", 12, C.textPrimary);

    // Right Slide-Out Inspector Drawer (w = 580)
    const drwX = 860, drwW = 580, drwH = H;
    makeRect(b5, drwX, 0, drwW, drwH, C.bgSurface, 0);
    makeRect(b5, drwX, 0, 1, drwH, C.borderCard);

    // Drawer Header
    makeText(b5, drwX + 20, 20, "Synapse PySpark Code Inspector", 14, C.textPrimary);
    makeText(b5, drwX + drwW - 110, 18, "v3.4 Delta", 11, C.cyan);
    makeText(b5, drwX + drwW - 35, 18, "✕", 14, C.textMuted);

    makeRect(b5, drwX + 20, 50, drwW - 40, 1, C.borderSubtle);

    // Monaco Code Editor Body
    makeRect(b5, drwX + 16, 62, drwW - 32, H - 80, C.bgBase, 8, C.borderSubtle, 1);
    
    const codeLines = [
        "# Fabric AI Studio — PySpark Delta Table Synthesizer",
        "from delta.tables import DeltaTable",
        "from pyspark.sql.functions import col, current_timestamp",
        "",
        "# 1. Load Staged Parquet Updates from Bronze Lakehouse",
        "df_bronze_updates = spark.read.table('lh_customer_bronze.stg_orders')",
        "",
        "# 2. Target Silver Delta Table",
        "target_delta = DeltaTable.forPath(spark, 'abfss://.../lh_customer_silver/Tables/Orders')",
        "",
        "# 3. Execute High-Performance Delta MERGE Upsert",
        "target_delta.alias('t').merge(",
        "    df_bronze_updates.alias('s'),",
        "    't.OrderID = s.OrderID AND t.CustomerKey = s.CustomerKey'",
        ").whenMatchedUpdate(set={",
        "    'TotalAmount': col('s.TotalAmount'),",
        "    'OrderStatus': col('s.OrderStatus'),",
        "    'sys_updated_at': current_timestamp()",
        "}).whenNotMatchedInsert(values={",
        "    'OrderID': col('s.OrderID'),",
        "    'CustomerKey': col('s.CustomerKey'),",
        "    'TotalAmount': col('s.TotalAmount'),",
        "    'sys_created_at': current_timestamp()",
        "}).execute()",
        "",
        "print(' Delta MERGE executed successfully with 0 schema drift.')"
    ];

    codeLines.forEach((line, i) => {
        const y = 80 + i * 24;
        makeText(b5, drwX + 26, y, String(i + 1), 10, C.textMuted);
        const col = line.startsWith("#") ? C.emerald : (line.includes("DeltaTable") || line.includes("spark")) ? C.cyan : C.textPrimary;
        makeText(b5, drwX + 54, y, line, 11, col);
    });


    // ═════════════════════════════════════════════════════════════════════
    // BOARD 6: MASTER DESIGN SYSTEM & UI ATOMS (16:9)
    // ═════════════════════════════════════════════════════════════════════
    const b6 = makeBoard("06 — Master Design System & UI Component Library", 1540, 1740);

    makeText(b6, 40, 30, "Fabric AI Studio — Master Design Tokens & Atoms", 20, C.textPrimary);

    makeText(b6, 40, 75, "SURFACE & ACCENT PALETTE", 11, C.textMuted);
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
        makeRect(b6, 40 + i * 165, 100, 145, 75, s.hex, 10, C.borderCard, 1);
        makeText(b6, 48, 138, s.name, 11, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textSecondary : C.bgBase);
        makeText(b6, 48, 154, s.hex, 10, s.hex.startsWith("#1") || s.hex.startsWith("#2") ? C.textMuted : C.bgBase);
    });

    makeText(b6, 40, 205, "BUTTONS & INTERACTIVE PILLS", 11, C.textMuted);
    makeRect(b6, 40, 230, 150, 36, C.bgSurface, 8, C.borderCard, 1);
    makeText(b6, 60, 240, "+  New Chat", 12, C.textPrimary);

    makeRect(b6, 210, 230, 150, 36, C.bgPill, 18, C.borderCard, 1);
    makeText(b6, 228, 240, "Claude Mix", 12, C.textPrimary);
    makeText(b6, 300, 241, "High ⌄", 11, C.textTertiary);

    makeRect(b6, 380, 230, 95, 36, C.bgPill, 8);
    makeText(b6, 398, 240, "⊞ Tools", 12, C.textSecondary);

    makeRect(b6, 495, 230, 130, 36, C.emerald, 8);
    makeText(b6, 518, 240, "Deploy Plan", 12, C.bgBase);

    makeText(b6, 40, 295, "PROFILE & STATUS PILLS", 11, C.textMuted);
    makeRect(b6, 40, 320, 228, 42, C.bgSurface, 8);
    makeCircle(b6, 48, 328, 24, C.avatarGold);
    makeText(b6, 56, 332, "B", 12, C.textPrimary);
    makeText(b6, 78, 332, "Bheesetti Harsith", 12, C.textPrimary);
    makeRect(b6, 208, 330, 38, 20, C.bgSurfaceRaised, 10);
    makeText(b6, 216, 333, "PRO", 9, C.textTertiary);

    return {
        success: true,
        boardsCreated: 6
    };
})();
"""

def main():
    print("[DEPLOY] Deploying Master 6-Board 16:9 Design Suite to Penpot...")
    resp = requests.post(REPL_URL, json={"code": PENPOT_JS_CODE}, timeout=35)
    print(f"[STATUS] {resp.status_code}")
    print(f"[RESPONSE] {resp.text}")

if __name__ == "__main__":
    main()
