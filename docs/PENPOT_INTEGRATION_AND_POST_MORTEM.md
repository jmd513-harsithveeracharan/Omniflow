# Penpot MCP Integration, Reverse Code-to-Design & Architecture Post-Mortem

This document serves as the permanent Architecture Decision Record (ADR), setup manual, and comprehensive engineering post-mortem for integrating **Microsoft Fabric AI Studio** with **Penpot** via native Model Context Protocol (MCP) and WebSocket REPL bridge.

---

## 1. System Architecture & Port Mapping

The bi-directional Code-to-Design bridge operates across 5 local services:

```text
+-------------------+       +-----------------------+       +-------------------+
|  Headless Chrome  | ----> | Python Transpiler     | ----> |  REPL Bridge      |
| (Playwright:8085) |       | (Computed DOM & SVGs) |       | (REST :4403)      |
+-------------------+       +-----------------------+       +---------+---------+
                                                                      |
                                                                      v
+-------------------+       +-----------------------+       +-------------------+
| Penpot Web (:9001)| <==== | Browser Plugin Bridge | <==== | MCP Server (:4401)|
| (Docker Engine)   |  UI   | (WebSocket :4402)     |  RPC  | (SSE :9001/mcp)   |
+-------------------+       +-----------------------+       +-------------------+
```

### Port & Service Directory:
- `http://localhost:8085`: Live running Microsoft Fabric AI Studio Web Workbench.
- `http://localhost:9001`: Penpot Web UI & Workspace running inside Docker.
- `http://localhost:4400/manifest.json`: HTTP static server hosting the Penpot plugin manifest.
- `http://localhost:4401/mcp`: Penpot MCP JSON-RPC router.
- `ws://localhost:4402`: Bi-directional WebSocket bridge connecting the browser plugin to MCP.
- `http://localhost:4403/execute`: Fast REST REPL endpoint (`POST {"code": "..."}`).

---

## 2. Step-by-Step Setup & Configuration Manual

### Step 1: Penpot MCP Server Build
1. Clone or navigate to the Penpot MCP repository:
   ```bash
   cd C:\Harsith_Work\penpot-mcp\mcp-server
   npm install
   npm run build
   ```
2. Launch the MCP daemon on port 4401:
   ```bash
   node dist/index.js
   ```

### Step 2: Serve the Penpot Plugin Manifest
1. In `C:\Harsith_Work\penpot-mcp\mcp-server`, run the plugin HTTP server on port 4400:
   ```bash
   python serve_plugin.py
   ```
2. The plugin manifest is now reachable at `http://localhost:4400/manifest.json`.

### Step 3: Connect Plugin inside Penpot Web App
1. Open Penpot in the browser: `http://localhost:9001`.
2. Open or create a design file (e.g. `New File 1`).
3. Click the **Plugins** icon on the toolbar -> **Install Plugin from URL**.
4. Enter `http://localhost:4400/manifest.json` and grant permissions.
5. Click **Connect to MCP Server** -> Status indicator turns green (*Connected to MCP server*).

### Step 4: Configure Antigravity Native MCP Tooling
In `C:\Harsith_Work\Fabric_AI\.env` and `C:\Users\BheesettiHarsithVeer\.gemini\antigravity-ide\mcp\penpot/`:
- `PENPOT_MCP_URL=http://localhost:9001/mcp/stream`
- `PENPOT_USER_TOKEN=<JWT_TOKEN_FROM_BROWSER>`

---

## 3. Comprehensive Post-Mortem & Mistakes Analysis

During implementation, 5 critical engineering bottlenecks were diagnosed and resolved:

### Mistake 1: Hand-Coded Approximations vs. Real Computed CSS & Vectors
- **Initial Symptom**: The first generated mockups looked generic, templated, and missed visual polish (only ~80% accurate). Emojis (`📁`, `🔍`) were used instead of real SVG icons.
- **Root Cause**: Hardcoding pixel approximations cannot reproduce subpixel font rendering, exact line heights, and SVG bezier curves.
- **Resolution**: Built an automated Playwright crawler (`scripts/export_pixel_perfect_dom_to_penpot.py`) that launches headless Chrome, extracts all 46 inline `<svg>` strings directly from the live DOM, and invokes `penpot.createShapeFromSvg(svg)` to achieve 100% vector accuracy.

### Mistake 2: The Penpot "Black Screen" Coordinate Bug (Canvas Global vs Board-Relative)
- **Initial Symptom**: Boards 2, 3, and 4 appeared as completely empty black boxes on the canvas, while Board 1 had misaligned elements.
- **Root Cause**: In the Penpot Plugin API, `shape.x` and `shape.y` represent **global canvas coordinates**, NOT local coordinates inside the parent board. When placing a card at `lx = 20` inside Board 2 (which is positioned at `bx = 1540`), setting `shape.x = 20` placed it at global `x = 20` (outside Board 2's bounding box `[1540..2980]`). Because boards have `clipContent = true`, Penpot clipped every single child, rendering them invisible.
- **Resolution**: Enforced absolute board offsets for all child shapes:
  ```javascript
  shape.x = board.x + localX;
  shape.y = board.y + localY;
  ```

### Mistake 3: Z-Index Layer Stacking & Background Cover-Up
- **Initial Symptom**: Text and vector shapes were created, but the sidebar and canvas appeared solid black.
- **Root Cause**: Penpot renders shapes in order of creation. When background rectangles (`width: 260, height: 810, fill: #131314`) were appended to the board, they sat at the top of the z-index stack, covering all text and icon layers beneath them.
- **Resolution**: Enforced explicit z-index pipeline:
  ```javascript
  bgRectangle.sendToBack();
  textElement.bringToFront();
  svgShape.bringToFront();
  ```

### Mistake 4: Full DOM Scraper Blending Hidden Modals with Playground
- **Initial Symptom**: Text like *"Question what's next"* and *"Continue with Google"* appeared smashed on top of the Playground prompt dock.
- **Root Cause**: The raw DOM tree walker inspected all elements in `index.html`. Since the Claude-style Auth Modal was in the same HTML file, its text nodes were extracted and rendered on top of the active Playground view.
- **Resolution**: Segregated components into dedicated, clean artboards (Playground Landing vs Auth Page vs Settings Modal).

### Mistake 5: Viewport Proportions & 16:9 14-Inch Laptop Scaling
- **Initial Symptom**: UI felt zoomed out and had excessive empty vertical space at the bottom.
- **Root Cause**: Boards were initially built for `1440 × 900` (16:10 tall desktop). Modern 14-inch laptops use a **16:9 widescreen ratio** (`1080p/1440p` at `125%/150%` scaling), which produces an effective viewport height of **`810px`**.
- **Resolution**: Re-calibrated all artboards to **`1440 × 810` (16:9)**:
  - Sidebar height: `810px` with profile pinned at `y = 756px`.
  - Hero Tagline: centered at `y = 300px`.
  - Floating Prompt Dock: centered at `y = 372px` with a natural `300px` bottom breathing margin.

---

## 4. Deployed Master 16:9 Artboards Summary

The final Penpot workspace contains **6 dedicated 16:9 artboards** (`1440 × 810`):

| Board ID | Name | Layer Count | Key Features |
| :--- | :--- | :--- | :--- |
| **01** | `Playground Landing View` | 71 layers | Expanded sidebar, brand logo, tagline, prompt dock with pills |
| **02** | `Floating Dropdowns & Flyouts` | 62 layers | Platform switcher, Model selector, Effort flyout, User profile |
| **03** | `Settings & Customize Modal` | 83 layers | Dimmed scrim overlay, Fabric workspace lock, Token budget cap |
| **04** | `Safe Delete & Governance Modal` | 76 layers | Red warning shield, Blast-radius dependency table, Typing gate |
| **05** | `Activity & PySpark Drawer` | 114 layers | Split workbench, Synapse 3.4 PySpark Monaco code viewer |
| **06** | `Master Design System & Atoms` | 43 layers | 8 HSL color swatches, button pills, user profile atom |

---

## 5. Automation Scripts Directory

All scripts are located in `scripts/`:
- `scripts/deploy_master_16_9_full_suite.py`: Deploys all 6 master 16:9 laptop boards with modals and dropdowns.
- `scripts/deploy_14inch_16_9_design_suite.py`: 16:9 laptop proportion engine.
- `scripts/export_pixel_perfect_dom_to_penpot.py`: Live Playwright DOM and SVG extraction pipeline.
- `scripts/code_to_design_transpiler.py`: Reverse Code-to-Design DOM style crawler.
