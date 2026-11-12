import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceCenter,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';
import { computeDynamicLayerDepths, isSchemaContainerNode, wrapLabel } from './graphTheme';

export interface D3SimNode extends SimulationNodeDatum, GraphMeshNode {
  id: string;
  radius: number;
  collisionRadius: number;
  isHub: boolean;
  _wrappedLines?: string[];
}

export interface D3SimLink extends SimulationLinkDatum<D3SimNode> {
  id: string;
  source: D3SimNode;
  target: D3SimNode;
  relationship: 'FEEDS' | 'CONTAINS' | 'TRANSFORMS_TO' | 'JOINS_WITH' | 'AGGREGATES' | 'DEPENDS_ON';
  description?: string | null;
}

/** Custom D3 Force: Spherical Harmonic Galaxy Envelope (Obsidian-Style Constellation) */
export function forceSphericalGalaxy(radius: number) {
  let nodes: D3SimNode[] = [];

  function force(alpha: number) {
    const kCentering = 0.052 * alpha;
    const kBoundary = 22 * alpha;
    const innerRim = radius * 0.86;
    const rimSpan = radius * 0.14;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const d = Math.hypot(n.x, n.y);
      if (d === 0) continue;
      const nx = n.x / d;
      const ny = n.y / d;

      // Inward Radial Gravitational Pull
      n.vx = (n.vx || 0) - n.x * kCentering;
      n.vy = (n.vy || 0) - n.y * kCentering;

      // Spherical Surface Boundary restitution
      if (d > innerRim) {
        const excess = d - innerRim;
        const push = (excess / rimSpan) * kBoundary;
        n.vx = (n.vx || 0) - nx * push;
        n.vy = (n.vy || 0) - ny * push;
      }
      if (d > radius) {
        n.x = nx * radius;
        n.y = ny * radius;
        n.vx = (n.vx || 0) * 0.4;
        n.vy = (n.vy || 0) * 0.4;
      }

      // Outer Corona Guiding Force for Singletons & Leaf Nodes
      if (n.degree <= 1 && n.type !== 'column') {
        const targetD = radius * 0.90;
        const coronaPull = (d - targetD) * 0.06 * alpha;
        n.vx = (n.vx || 0) - nx * coronaPull;
        n.vy = (n.vy || 0) - ny * coronaPull;
      }
    }
  }

  force.initialize = (initNodes: D3SimNode[]) => { nodes = initNodes; };
  return force;
}

export function forceCircularBoundary(radius: number) { return forceSphericalGalaxy(radius); }
export function forceRadialGravity() { return () => {}; }

/**
 * Seeds and configures a snowflake radial tree simulation with two-tier petal clearance.
 */
export function createSnowflakeSimulation(
  nodes: GraphMeshNode[],
  edges: GraphMeshEdge[],
  boundaryRadius = 320
): {
  simulation: Simulation<D3SimNode, D3SimLink>;
  simNodes: D3SimNode[];
  simLinks: D3SimLink[];
} {
  const total = nodes.length;
  const isContainerType = isSchemaContainerNode;
  const isHubNode = (n: GraphMeshNode) => n.type !== 'column' || n.degree >= 3;

  const rawNodeMap = new Map(nodes.map((n) => [n.id, n]));
  const spokeMap = new Map<string, GraphMeshNode[]>();
  const parentSchemaOf = new Map<string, string>();
  for (const e of edges) {
    if (e.relationship === 'CONTAINS') {
      const srcNode = rawNodeMap.get(e.source);
      const tgtNode = rawNodeMap.get(e.target);
      if (srcNode && tgtNode) {
        const spokes = spokeMap.get(e.source) || [];
        spokes.push(tgtNode);
        spokeMap.set(e.source, spokes);
        if (isContainerType(srcNode.type) && tgtNode.type !== 'column') {
          parentSchemaOf.set(tgtNode.id, srcNode.id);
        }
      }
    }
  }

  const { layerDepths, maxLayerDepth } = computeDynamicLayerDepths(nodes, edges, rawNodeMap);

  const hubList = nodes.filter(isHubNode);
  const topLevelHubs = hubList.filter((n) => !parentSchemaOf.has(n.id));

  // Helper to extract base entity name for 360-degree domain clustering
  const extractEntityBase = (n: GraphMeshNode) => {
    const raw = (n.label || n.id).toLowerCase();
    return raw
      .replace(/^(source:\s*|source_|src_|lh_|wh_|sm_|nb_|pl_|tbl_|raw_|silver_|gold_|curated_|curate_)/g, '')
      .replace(/(_bronze|_silver|_gold|_landing|_curated|_stage|_lake|_model)$/g, '')
      .trim();
  };

  // Group top-level hubs into Central High-Connectivity Core vs Domain Sectors
  const isCentralCore = (n: GraphMeshNode) => {
    const depth = layerDepths.get(n.layer.toLowerCase()) ?? 0;
    const isLateCoreTier = maxLayerDepth >= 2 && depth >= Math.floor(maxLayerDepth * 0.6) && !isContainerType(n.type);
    const id = n.id.toLowerCase();
    return isLateCoreTier || id.includes('fact_') || id.includes('star_schema') || id.includes('orchestrator');
  };

  const centralHubs: GraphMeshNode[] = [];
  const domainHubs: GraphMeshNode[] = [];
  for (const n of topLevelHubs) {
    (isCentralCore(n) ? centralHubs : domainHubs).push(n);
  }

  const domainMap = new Map<string, GraphMeshNode[]>();
  for (const hub of domainHubs) {
    const base = extractEntityBase(hub) || hub.id;
    const group = domainMap.get(base) || [];
    group.push(hub);
    domainMap.set(base, group);
  }

  const domainKeys = Array.from(domainMap.keys());
  const numDomains = Math.max(1, domainKeys.length);
  const posMap = new Map<string, { x: number; y: number }>();

  const seedChildren = (parentNode: GraphMeshNode, px: number, py: number) => {
    const children = spokeMap.get(parentNode.id) || [];
    const childTables = children.filter((c) => c.type !== 'column');
    const childCols = children.filter((c) => c.type === 'column');

    childTables.forEach((tbl, tIdx) => {
      const tAngle = (tIdx / Math.max(1, childTables.length)) * Math.PI * 2;
      const tDist = 54 + (tIdx % 3) * 14;
      const tx = px + Math.cos(tAngle) * tDist;
      const ty = py + Math.sin(tAngle) * tDist;
      posMap.set(tbl.id, { x: tx, y: ty });

      const tCols = (spokeMap.get(tbl.id) || []).filter((c) => c.type === 'column');
      tCols.forEach((col, cIdx) => {
        const cAngle = (cIdx / Math.max(1, tCols.length)) * Math.PI * 2;
        const rSpoke = 30 + (cIdx % 2) * 7;
        posMap.set(col.id, { x: tx + Math.cos(cAngle) * rSpoke, y: ty + Math.sin(cAngle) * rSpoke });
      });
    });

    childCols.forEach((spoke, sIdx) => {
      const spokeAngle = (sIdx / Math.max(1, childCols.length)) * Math.PI * 2;
      const rSpoke = 32 + (sIdx % 2) * 8;
      posMap.set(spoke.id, { x: px + Math.cos(spokeAngle) * rSpoke, y: py + Math.sin(spokeAngle) * rSpoke });
    });
  };

  // Space domains evenly around the circle using dynamic topological depth
  domainKeys.forEach((key, dIdx) => {
    const group = domainMap.get(key) || [];
    const domainAngle = (dIdx / numDomains) * Math.PI * 2 - Math.PI / 2;

    group.forEach((hub, idx) => {
      const depth = layerDepths.get(hub.layer.toLowerCase()) ?? 0;
      const tDepth = Math.min(1, depth / maxLayerDepth);
      const distRatio = 0.86 - tDepth * 0.42;
      const angleOffset = (idx - (group.length - 1) / 2) * 0.08;

      const angle = domainAngle + angleOffset;
      const hx = Math.cos(angle) * boundaryRadius * distRatio;
      const hy = Math.sin(angle) * boundaryRadius * distRatio;
      posMap.set(hub.id, { x: hx, y: hy });
      seedChildren(hub, hx, hy);
    });
  });

  // Central Hubs placed in the inner circular core
  const numCentral = Math.max(1, centralHubs.length);
  centralHubs.forEach((hub, cIdx) => {
    const angle = (cIdx / numCentral) * Math.PI * 2;
    const dist = numCentral === 1 ? 0 : boundaryRadius * 0.24;
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    posMap.set(hub.id, { x: cx, y: cy });
    seedChildren(hub, cx, cy);
  });

  // Peripheral Singletons & Leaf Nodes
  let singletonIdx = 0;
  nodes.forEach((n) => {
    if (!posMap.has(n.id)) {
      const angle = (singletonIdx++ / Math.max(1, total)) * Math.PI * 2;
      const r = boundaryRadius * (0.88 + 0.06 * Math.sin(singletonIdx * 2.5));
      posMap.set(n.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
  });

  const simNodes: D3SimNode[] = nodes.map((n) => {
    const isHub = isHubNode(n);
    let r = 3.0;
    if (isContainerType(n.type)) {
      r = Math.min(15.0, Math.max(11.5, 11.0 + Math.sqrt(n.degree) * 0.45));
    } else if (n.type === 'table') {
      r = 6.5;
    } else if (n.type !== 'column') {
      r = 7.2;
    }

    const lines = wrapLabel(n.label, isHub ? 16 : 12);
    const maxLineChars = Math.max(...lines.map((l: string) => l.length));
    const textHalfWidth = Math.min(48, Math.max(10, maxLineChars * (isHub ? 2.5 : 1.9)));
    const collisionRadius = Math.max(r + 6, textHalfWidth + 3);
    const initPos = posMap.get(n.id) || { x: 0, y: 0 };

    return {
      ...n,
      radius: r,
      collisionRadius,
      isHub,
      _wrappedLines: lines,
      x: initPos.x,
      y: initPos.y,
    };
  });

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks: D3SimLink[] = [];
  for (const e of edges) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (src && tgt) simLinks.push({ id: e.id, source: src, target: tgt, relationship: e.relationship, description: e.description });
  }

  // D3 Force Layout: Schema->Table=68px, Table->Column=35px, Lineage=135px
  const simulation = forceSimulation<D3SimNode>(simNodes)
    .force('center', forceCenter(0, 0))
    .force('charge', forceManyBody<D3SimNode>().strength((d) => (isContainerType(d.type) ? -460 : d.isHub ? -340 : -22)).distanceMax(Math.max(520, boundaryRadius * 1.35)))
    .force(
      'link',
      forceLink<D3SimNode, D3SimLink>(simLinks)
        .distance((l) => (l.relationship !== 'CONTAINS' ? 135 : isContainerType((l.source as D3SimNode).type) ? 68 : 35))
        .strength((l) => (l.relationship !== 'CONTAINS' ? 0.18 : isContainerType((l.source as D3SimNode).type) ? 0.72 : 0.95))
    )
    .force('collide', forceCollide<D3SimNode>().radius((d) => d.collisionRadius).strength(0.70).iterations(1))
    .force('spherical', forceSphericalGalaxy(boundaryRadius))
    .alpha(0.35)
    .alphaDecay(0.04)
    .velocityDecay(0.48);

  const warmupTicks = simNodes.length > 200 ? 20 : 30;
  for (let i = 0; i < warmupTicks; i++) simulation.tick();
  return { simulation, simNodes, simLinks };
}
