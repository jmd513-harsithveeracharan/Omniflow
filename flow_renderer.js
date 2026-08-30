/**
 * flow_renderer.js
 * ----------------
 * Pure-JS SVG DAG renderer for Fabric ingestion flow visualization.
 * No external dependencies — renders nodes and edges as inline SVG.
 *
 * Node types: source | folder | lakehouse | environment | notebook | pipeline
 * Node status: pending | deploying | live | error
 */

const FlowRenderer = (() => {
  // ── Design Tokens ──────────────────────────────────────────────────────────

  const NODE_W = 195;
  const NODE_H = 48;
  const RADIUS = 10;
  const CANVAS_PAD = 28;

  const TYPE_CONFIG = {
    source:      { color: "#38bdf8", fill: "rgba(14, 23, 47, 0.95)", stroke: "#0284c7", icon: "M4 6h16M4 12h16M4 18h16",          label: "SOURCE"      },
    folder:      { color: "#c084fc", fill: "rgba(28, 18, 54, 0.95)", stroke: "#7c3aed", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z", label: "FOLDER" },
    lakehouse:   { color: "#38bdf8", fill: "rgba(12, 34, 64, 0.95)", stroke: "#0284c7", icon: "M12 2a10 10 0 110 20A10 10 0 0112 2zm0 0v10m0 0l-4-4m4 4l4-4", label: "LAKEHOUSE" },
    environment: { color: "#34d399", fill: "rgba(10, 42, 32, 0.95)", stroke: "#059669", icon: "M12 2v8l4 2-4 2v8M4 12h16",         label: "ENVIRONMENT" },
    notebook:    { color: "#fbbf24", fill: "rgba(44, 30, 12, 0.95)", stroke: "#d97706", icon: "M4 4h16v12H4zm4 16h8M12 16v4",       label: "NOTEBOOK"    },
    pipeline:    { color: "#f87171", fill: "rgba(48, 16, 24, 0.95)", stroke: "#dc2626", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",    label: "PIPELINE"    },
  };

  const STATUS_CONFIG = {
    pending:   { stroke: "rgba(255,255,255,0.2)", dash: "6,4",  glow: false },
    deploying: { stroke: "#38bdf8",              dash: "4,3",  glow: true  },
    live:      { stroke: "#10b981",              dash: "none", glow: false },
    error:     { stroke: "#ef4444",              dash: "none", glow: false },
  };

  // ── SVG Helpers ────────────────────────────────────────────────────────────

  function svgEl(tag, attrs = {}, ...children) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    for (const child of children) {
      if (child) el.appendChild(child);
    }
    return el;
  }

  function pathIcon(d, color) {
    return svgEl("path", {
      d,
      stroke: color,
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      fill: "none",
    });
  }

  // ── Node Renderer ──────────────────────────────────────────────────────────

  function renderNode(node) {
    const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.notebook;
    const sCfg = STATUS_CONFIG[node.status || "pending"];
    const x = node.x;
    const y = node.y;
    const g = svgEl("g", {
      id: `flow-node-${node.id}`,
      class: `flow-node flow-node-${node.status || "pending"}`,
      transform: `translate(${x},${y})`,
      "data-node-id": node.id,
      style: "cursor: pointer;",
    });

    // Shadow/glow for deploying state
    if (sCfg.glow) {
      g.appendChild(svgEl("rect", {
        x: -3, y: -3,
        width: NODE_W + 6, height: NODE_H + 6,
        rx: RADIUS + 2,
        fill: "none",
        stroke: "#38bdf8",
        "stroke-width": "2",
        opacity: "0.6",
        class: "node-glow-ring",
      }));
    }

    // Background card
    g.appendChild(svgEl("rect", {
      x: 0, y: 0,
      width: NODE_W, height: NODE_H,
      rx: RADIUS,
      fill: cfg.fill,
      stroke: sCfg.stroke,
      "stroke-width": "1.2",
      "stroke-dasharray": sCfg.dash === "none" ? "" : sCfg.dash,
    }));

    // Left Icon Box (22x22)
    g.appendChild(svgEl("rect", {
      x: 8, y: 13, width: 22, height: 22, rx: 5,
      fill: "rgba(255, 255, 255, 0.06)",
    }));
    const iconG = svgEl("g", { transform: `translate(11, 16)` });
    const iconSvg = svgEl("svg", {
      viewBox: "0 0 24 24",
      width: "15", height: "15",
      fill: "none",
    });
    iconSvg.appendChild(pathIcon(cfg.icon, cfg.color));
    iconG.appendChild(iconSvg);
    g.appendChild(iconG);

    // Main label (Activity Name)
    const labelEl = svgEl("text", {
      x: 36, y: 22,
      "font-size": "11",
      "font-weight": "600",
      "font-family": "Inter, -apple-system, sans-serif",
      fill: "#ffffff",
    });
    labelEl.textContent = truncate(node.label || node.id, 20);
    g.appendChild(labelEl);

    // Type Badge (Bottom line)
    const typeLabelEl = svgEl("text", {
      x: 36, y: 35,
      "font-size": "8.5",
      "font-weight": "700",
      "font-family": "Inter, -apple-system, sans-serif",
      "letter-spacing": "0.6",
      fill: cfg.color,
    });
    typeLabelEl.textContent = cfg.label;
    g.appendChild(typeLabelEl);

    // Status dot (Right side)
    const dotColors = { pending: "rgba(255,255,255,0.25)", deploying: "#38bdf8", live: "#10b981", error: "#ef4444" };
    g.appendChild(svgEl("circle", {
      cx: NODE_W - 12, cy: NODE_H / 2, r: 4,
      fill: dotColors[node.status || "pending"],
    }));

    return g;
  }

  // ── Edge Renderer ──────────────────────────────────────────────────────────

  function renderEdge(fromNode, toNode) {
    const x1 = fromNode.x + NODE_W;
    const y1 = fromNode.y + NODE_H / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_H / 2;
    const dx = Math.max((x2 - x1) * 0.45, 30);
    const cx1 = x1 + dx;
    const cx2 = x2 - dx;

    const path = svgEl("path", {
      d: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`,
      fill: "none",
      stroke: "rgba(56, 189, 248, 0.4)",
      "stroke-width": "1.6",
      class: "flow-edge",
    });

    // Arrowhead
    const arrow = svgEl("polygon", {
      points: `${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`,
      fill: "#38bdf8",
    });

    const g = svgEl("g", { class: "flow-edge-group" });
    g.appendChild(path);
    g.appendChild(arrow);
    return g;
  }

  // ── Canvas Builder ────────────────────────────────────────────────────────

  function computeCanvasSize(nodes) {
    let maxX = 0, maxY = 0;
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + NODE_W + CANVAS_PAD);
      maxY = Math.max(maxY, n.y + NODE_H + CANVAS_PAD);
    }
    return { width: maxX + CANVAS_PAD, height: maxY + CANVAS_PAD };
  }

  // ── Public: render ─────────────────────────────────────────────────────────

  function render(container, plan, onNodeClick = null) {
    container.innerHTML = "";

    const nodes = plan.flow_nodes || [];
    const edges = plan.flow_edges || [];
    const { width, height } = computeCanvasSize(nodes);

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width: "100%",
      style: `min-height: ${Math.max(height, 260)}px; overflow: visible;`,
      class: "flow-svg",
    });

    // Add CSS animation for deploying glow
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      .node-glow-ring { animation: glowPulse 1.2s ease-in-out infinite; }
      @keyframes glowPulse { 0%,100% { opacity:0.3; } 50% { opacity:0.7; } }
      .flow-node { cursor: pointer; transition: transform 0.15s, filter 0.15s; }
      .flow-node:hover { filter: drop-shadow(0 4px 12px rgba(56, 189, 248, 0.25)); transform: translateY(-1px); }
    `;
    svg.appendChild(style);

    // Build node lookup
    const nodeMap = {};
    for (const n of nodes) nodeMap[n.id] = n;

    // Edges first (drawn behind nodes)
    for (const e of edges) {
      const fromNode = nodeMap[e.from];
      const toNode   = nodeMap[e.to];
      if (fromNode && toNode) {
        svg.appendChild(renderEdge(fromNode, toNode));
      }
    }

    // Nodes on top
    for (const n of nodes) {
      const el = renderNode(n);
      if (typeof onNodeClick === "function") {
        el.addEventListener("click", () => onNodeClick(n, plan));
      }
      svg.appendChild(el);
    }

    container.appendChild(svg);
  }

  // ── Public: updateNodeStatus ───────────────────────────────────────────────

  function updateNodeStatus(container, nodeId, status) {
    const el = container.querySelector(`#flow-node-${nodeId}`);
    if (!el) return;

    // Update class
    el.className.baseVal = el.className.baseVal
      .replace(/flow-node-\w+/, `flow-node-${status}`);

    // Update status dot color
    const dotColors = { pending: "#d1d5db", deploying: "#38bdf8", live: "#10b981", error: "#ef4444" };
    const dot = el.querySelector("circle");
    if (dot) dot.setAttribute("fill", dotColors[status] || "#d1d5db");

    // Update border
    const sCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const rect = el.querySelector("rect");
    if (rect) {
      rect.setAttribute("stroke", sCfg.stroke);
      rect.setAttribute("stroke-dasharray", sCfg.dash === "none" ? "" : sCfg.dash);
    }
  }

  // ── Util ──────────────────────────────────────────────────────────────────

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  }

  return { render, updateNodeStatus };
})();
