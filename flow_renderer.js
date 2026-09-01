/**
 * flow_renderer.js
 * ----------------
 * Pure-JS SVG Interactive DAG Visualizer for Microsoft Fabric Architecture.
 * Renders node graphs with rich glassmorphic cards, gradient layer accents,
 * smooth animated Bezier flow edges, and buttery smooth hover/touch interactions.
 */

const FlowRenderer = (() => {
  // ── Design Tokens ──────────────────────────────────────────────────────────
  const NODE_W = 250;
  const NODE_H = 76;
  const RADIUS = 12;
  const CANVAS_PAD = 40;

  const TYPE_CONFIG = {
    source:      { color: "#38bdf8", bgGradient: ["#0b1d3a", "#061325"], stroke: "#0284c7", icon: "M4 6h16M4 12h16M4 18h16",          label: "INGESTION SOURCE", tag: "SOURCE", sub: "JDBC / CDC Stream" },
    folder:      { color: "#c084fc", bgGradient: ["#24123d", "#150924"], stroke: "#7c3aed", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z", label: "WORKSPACE FOLDER", tag: "FOLDER", sub: "Workspace Container" },
    lakehouse:   { color: "#0ea5e9", bgGradient: ["#092642", "#051627"], stroke: "#0284c7", icon: "M12 2a10 10 0 110 20A10 10 0 0112 2zm0 0v10m0 0l-4-4m4 4l4-4", label: "DELTA LAKEHOUSE", tag: "LAKEHOUSE", sub: "Delta Lake Tables" },
    environment: { color: "#34d399", bgGradient: ["#082e21", "#041a13"], stroke: "#059669", icon: "M12 2v8l4 2-4 2v8M4 12h16",         label: "SPARK RUNTIME",    tag: "ENV", sub: "PySpark 3.4 Runtime" },
    notebook:    { color: "#fbbf24", bgGradient: ["#33220b", "#1c1205"], stroke: "#d97706", icon: "M4 4h16v12H4zm4 16h8M12 16v4",       label: "PYSPARK NOTEBOOK", tag: "NOTEBOOK", sub: "Delta Merge & Upsert" },
    pipeline:    { color: "#f43f5e", bgGradient: ["#3b0f1d", "#1f060d"], stroke: "#e11d48", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",    label: "DATA FACTORY PIPELINE", tag: "PIPELINE", sub: "Scheduled Trigger DAG" },
  };

  const STATUS_CONFIG = {
    pending:   { stroke: "rgba(255,255,255,0.14)", dash: "6,4",  dot: "#9ca3af", statusText: "Ready" },
    deploying: { stroke: "#38bdf8",              dash: "5,3",  dot: "#38bdf8", statusText: "Deploying" },
    live:      { stroke: "#10b981",              dash: "none", dot: "#10b981", statusText: "Live" },
    error:     { stroke: "#ef4444",              dash: "none", dot: "#ef4444", statusText: "Error" },
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
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      fill: "none",
    });
  }

  // ── Node Card Renderer (Jitter-Free, Rich Details) ──────────────────────────
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
      style: "cursor: pointer; pointer-events: all;",
    });

    // Outer Card Frame
    g.appendChild(svgEl("rect", {
      x: 0, y: 0,
      width: NODE_W, height: NODE_H,
      rx: RADIUS,
      fill: "url(#nodeGrad_" + node.type + ")",
      stroke: sCfg.stroke,
      "stroke-width": "1.3",
      "stroke-dasharray": sCfg.dash === "none" ? "" : sCfg.dash,
      class: "flow-node-bg",
    }));

    // Top Accent Stripe (Layer color)
    g.appendChild(svgEl("path", {
      d: `M 0,${RADIUS} Q 0,0 ${RADIUS},0 L ${NODE_W - RADIUS},0 Q ${NODE_W},0 ${NODE_W},${RADIUS} L ${NODE_W},3.5 L 0,3.5 Z`,
      fill: cfg.color,
      opacity: "0.95",
    }));

    // Left Icon Container (34x34 with frosted glass background)
    g.appendChild(svgEl("rect", {
      x: 12, y: 18, width: 34, height: 34, rx: 8,
      fill: "rgba(255, 255, 255, 0.08)",
      stroke: "rgba(255, 255, 255, 0.12)",
      "stroke-width": "1",
    }));

    const iconG = svgEl("g", { transform: `translate(19, 25)` });
    const iconSvg = svgEl("svg", {
      viewBox: "0 0 24 24",
      width: "20", height: "20",
      fill: "none",
    });
    iconSvg.appendChild(pathIcon(cfg.icon, cfg.color));
    iconG.appendChild(iconSvg);
    g.appendChild(iconG);

    // Primary Title Text (Item Name)
    const labelEl = svgEl("text", {
      x: 54, y: 32,
      "font-size": "13",
      "font-weight": "600",
      "font-family": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fill: "#f8fafc",
      "letter-spacing": "-0.01em",
    });
    labelEl.textContent = truncate(node.label || node.id, 25);
    g.appendChild(labelEl);

    // Secondary Category Pill
    const tagEl = svgEl("text", {
      x: 54, y: 48,
      "font-size": "9.5",
      "font-weight": "700",
      "font-family": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "letter-spacing": "0.06em",
      fill: cfg.color,
    });
    tagEl.textContent = node.tag || cfg.label;
    g.appendChild(tagEl);

    // Tertiary Sub-Detail Text
    const subEl = svgEl("text", {
      x: 54, y: 63,
      "font-size": "10",
      "font-weight": "400",
      "font-family": "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fill: "#94a3b8",
    });
    subEl.textContent = truncate(node.sub || cfg.sub, 30);
    g.appendChild(subEl);

    // Status Indicator Dot with subtle border
    g.appendChild(svgEl("circle", {
      cx: NODE_W - 16, cy: 22, r: 4.5,
      fill: sCfg.dot,
      stroke: "rgba(0,0,0,0.5)",
      "stroke-width": "1",
    }));

    return g;
  }

  // ── Edge Renderer (Animated Glowing Flow Path) ─────────────────────────────
  function renderEdge(fromNode, toNode) {
    const x1 = fromNode.x + NODE_W;
    const y1 = fromNode.y + NODE_H / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + NODE_H / 2;
    const dx = Math.max((x2 - x1) * 0.5, 40);
    const cx1 = x1 + dx;
    const cx2 = x2 - dx;

    // Outer glow / track path
    const trackPath = svgEl("path", {
      d: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`,
      fill: "none",
      stroke: "rgba(14, 165, 233, 0.2)",
      "stroke-width": "4",
      class: "flow-edge-track",
    });

    // Animated directional stream path
    const flowPath = svgEl("path", {
      d: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`,
      fill: "none",
      stroke: "url(#edgeGradient)",
      "stroke-width": "2",
      class: "flow-edge-line",
    });

    // Arrowhead pointer
    const arrow = svgEl("polygon", {
      points: `${x2},${y2} ${x2 - 8},${y2 - 4.5} ${x2 - 8},${y2 + 4.5}`,
      fill: "#38bdf8",
    });

    const g = svgEl("g", { class: "flow-edge-group" });
    g.appendChild(trackPath);
    g.appendChild(flowPath);
    g.appendChild(arrow);
    return g;
  }

  // ── Canvas Sizing ──────────────────────────────────────────────────────────
  function computeCanvasSize(nodes) {
    let maxX = 900, maxY = 380;
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + NODE_W + CANVAS_PAD * 2);
      maxY = Math.max(maxY, n.y + NODE_H + CANVAS_PAD * 2);
    }
    return { width: maxX, height: maxY };
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
      height: "100%",
      style: `min-height: ${Math.max(height, 340)}px; overflow: visible;`,
      class: "flow-svg",
    });

    // Definitions: Gradients & Keyframes
    const defs = svgEl("defs");

    // Edge Gradient
    const edgeGrad = svgEl("linearGradient", { id: "edgeGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
    edgeGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#0ea5e9", "stop-opacity": "0.7" }));
    edgeGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#38bdf8", "stop-opacity": "1" }));
    defs.appendChild(edgeGrad);

    // Node Card Gradients
    for (const [key, cfg] of Object.entries(TYPE_CONFIG)) {
      const grad = svgEl("linearGradient", { id: `nodeGrad_${key}`, x1: "0%", y1: "0%", x2: "100%", y2: "100%" });
      grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": cfg.bgGradient[0], "stop-opacity": "0.96" }));
      grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": cfg.bgGradient[1], "stop-opacity": "0.98" }));
      defs.appendChild(grad);
    }

    svg.appendChild(defs);

    // Pure CSS Styles (Zero Jitter, Smooth Stroke Glow on Hover)
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
      @keyframes flowDashAnim {
        from { stroke-dashoffset: 40; }
        to { stroke-dashoffset: 0; }
      }
      .flow-edge-line {
        stroke-dasharray: 7, 5;
        animation: flowDashAnim 1.4s linear infinite;
      }
      .flow-node {
        cursor: pointer;
      }
      .flow-node .flow-node-bg {
        transition: stroke 0.15s ease, filter 0.15s ease;
      }
      .flow-node:hover .flow-node-bg {
        stroke: #38bdf8 !important;
        stroke-width: 1.8px !important;
        filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.45));
      }
      .flow-edge-group:hover .flow-edge-line {
        stroke: #38bdf8 !important;
        stroke-width: 2.8px !important;
      }
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

    el.className.baseVal = el.className.baseVal.replace(/flow-node-\w+/, `flow-node-${status}`);
    const sCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

    const dot = el.querySelector("circle");
    if (dot) dot.setAttribute("fill", sCfg.dot);

    const bgRect = el.querySelector(".flow-node-bg");
    if (bgRect) {
      bgRect.setAttribute("stroke", sCfg.stroke);
      bgRect.setAttribute("stroke-dasharray", sCfg.dash === "none" ? "" : sCfg.dash);
    }
  }

  // ── Util ──────────────────────────────────────────────────────────────────
  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max - 1) + "…" : str;
  }

  return { render, updateNodeStatus };
})();
