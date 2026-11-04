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
import { wrapLabel } from './graphTheme';

export interface D3SimNode extends SimulationNodeDatum, GraphMeshNode {
  id: string;
  radius: number;
  collisionRadius: number;
  isHub: boolean;
}

export interface D3SimLink extends SimulationLinkDatum<D3SimNode> {
  id: string;
  source: D3SimNode;
  target: D3SimNode;
  relationship: 'FEEDS' | 'CONTAINS' | 'TRANSFORMS_TO' | 'JOINS_WITH' | 'AGGREGATES' | 'DEPENDS_ON';
  description?: string | null;
}

/**
 * Custom D3 Force: Spherical Harmonic Galaxy Envelope (Obsidian-Style)
 * 1. Planetary Gravitational Well: Gently draws all nodes towards (0, 0) with Hookean tension (F = -k * d)
 *    to prevent the graph from elongating or stretching into irregular shapes.
 * 2. Spherical Boundary Surface Tension: Creates a smooth spherical boundary at `radius`. As nodes
 *    approach or exceed `0.86 * radius`, an escalating inward restitution force keeps the silhouette
 *    circular and round.
 * 3. Perimeter Corona Orbit: Gently encourages low-degree singletons and peripheral nodes to distribute
 *    evenly along the spherical rim (0.88 - 0.96 * radius), giving the exact celestial constellation
 *    silhouette seen in Obsidian graphs.
 */
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

      // 1. Inward Radial Gravitational Pull (Hooke's Law / Central Mass)
      n.vx = (n.vx || 0) - n.x * kCentering;
      n.vy = (n.vy || 0) - n.y * kCentering;

      // 2. Spherical Surface Boundary (Soft quadratic restitution)
      if (d > innerRim) {
        const excess = d - innerRim;
        const push = (excess / rimSpan) * kBoundary;
        n.vx = (n.vx || 0) - nx * push;
        n.vy = (n.vy || 0) - ny * push;
      }

      // Hard celestial horizon: strictly confines all nodes to the spherical disc
      if (d > radius) {
        n.x = nx * radius;
        n.y = ny * radius;
        n.vx = (n.vx || 0) * 0.4;
        n.vy = (n.vy || 0) * 0.4;
      }

      // 3. Outer Corona Guiding Force for Singletons & Peripheral Leaf Nodes
      if (n.degree <= 1 && n.type !== 'column') {
        const targetD = radius * 0.90;
        const diff = d - targetD;
        const coronaPull = diff * 0.06 * alpha;
        n.vx = (n.vx || 0) - nx * coronaPull;
        n.vy = (n.vy || 0) - ny * coronaPull;
      }
    }
  }

  force.initialize = (initNodes: D3SimNode[]) => {
    nodes = initNodes;
  };

  return force;
}

export function forceCircularBoundary(radius: number) {
  return forceSphericalGalaxy(radius);
}

export function forceRadialGravity() {
  return () => {};
}

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
  const isHubNode = (n: GraphMeshNode) => n.type !== 'column' || n.degree >= 3;

  const hubList = nodes.filter(isHubNode);
  const spokeMap = new Map<string, GraphMeshNode[]>();
  for (const e of edges) {
    if (e.relationship === 'CONTAINS') {
      const spokes = spokeMap.get(e.source) || [];
      const colNode = nodes.find((n) => n.id === e.target);
      if (colNode) spokes.push(colNode);
      spokeMap.set(e.source, spokes);
    }
  }

  // Helper to extract base entity name from table ID/label for 360-degree domain clustering
  const extractEntityBase = (n: GraphMeshNode) => {
    const raw = (n.label || n.id).toLowerCase();
    return raw
      .replace(/^(source:\s*|source_|lh_|wh_|sm_|nb_|pl_|tbl_|raw_|silver_|gold_|curated_|curate_)/g, '')
      .replace(/(_bronze|_silver|_gold|_landing|_curated|_stage|_lake|_model)$/g, '')
      .trim();
  };

  // 1. Separate hubs into Central Core (Gold/Warehouses/Sinks) vs Domain Entities (Bronze/Silver/Sources)
  const isCentralCore = (n: GraphMeshNode) => {
    const l = n.layer.toLowerCase();
    const id = n.id.toLowerCase();
    return (
      l === 'gold' ||
      l === 'warehouse' ||
      id.includes('fact_') ||
      id.includes('star_schema') ||
      id.includes('orchestrator')
    );
  };

  const centralHubs: GraphMeshNode[] = [];
  const domainHubs: GraphMeshNode[] = [];

  for (const n of hubList) {
    if (isCentralCore(n)) {
      centralHubs.push(n);
    } else {
      domainHubs.push(n);
    }
  }

  // 2. Group domain hubs into coherent business entity clusters across layers
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

  // 3. Space domains evenly in a full 360-degree circle around the center
  domainKeys.forEach((key, dIdx) => {
    const group = domainMap.get(key) || [];
    const domainAngle = (dIdx / numDomains) * Math.PI * 2 - Math.PI / 2;

    group.forEach((hub, idx) => {
      const l = hub.layer.toLowerCase();
      let distRatio = 0.58;
      let angleOffset = 0;

      if (l === 'source') {
        distRatio = 0.88;
        angleOffset = 0;
      } else if (l === 'bronze') {
        distRatio = 0.70;
        angleOffset = -0.09 * (idx + 1);
      } else if (l === 'silver') {
        distRatio = 0.48;
        angleOffset = 0.09 * (idx + 1);
      } else if (l === 'bi') {
        distRatio = 0.84;
        angleOffset = 0.14;
      }

      const angle = domainAngle + angleOffset;
      const hx = Math.cos(angle) * boundaryRadius * distRatio;
      const hy = Math.sin(angle) * boundaryRadius * distRatio;
      posMap.set(hub.id, { x: hx, y: hy });

      // Circular flower spoke arrangement for columns
      const spokes = spokeMap.get(hub.id) || [];
      spokes.forEach((spoke, sIdx) => {
        const spokeAngle = (sIdx / Math.max(1, spokes.length)) * Math.PI * 2;
        const rSpoke = 32 + (sIdx % 2) * 8;
        posMap.set(spoke.id, {
          x: hx + Math.cos(spokeAngle) * rSpoke,
          y: hy + Math.sin(spokeAngle) * rSpoke,
        });
      });
    });
  });

  // 4. Central Hubs placed right in the inner circular core
  const numCentral = Math.max(1, centralHubs.length);
  centralHubs.forEach((hub, cIdx) => {
    const angle = (cIdx / numCentral) * Math.PI * 2;
    const dist = numCentral === 1 ? 0 : boundaryRadius * 0.22;
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    posMap.set(hub.id, { x: cx, y: cy });

    const spokes = spokeMap.get(hub.id) || [];
    spokes.forEach((spoke, sIdx) => {
      const spokeAngle = (sIdx / Math.max(1, spokes.length)) * Math.PI * 2;
      const rSpoke = 32 + (sIdx % 2) * 8;
      posMap.set(spoke.id, {
        x: cx + Math.cos(spokeAngle) * rSpoke,
        y: cy + Math.sin(spokeAngle) * rSpoke,
      });
    });
  });

  // 5. Peripheral Singletons & Leaf Nodes: form the circular outer starfield rim at 0.88 - 0.94 * R
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
    const r = isHub ? (n.degree > 6 ? 7.5 : 5.5) : 3.0;

    // Use 2-line wrapped text dimensions to compute anti-overlap collision bounds
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
      x: initPos.x,
      y: initPos.y,
    };
  });

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks: D3SimLink[] = [];
  for (const e of edges) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    if (src && tgt) {
      simLinks.push({
        id: e.id,
        source: src,
        target: tgt,
        relationship: e.relationship,
        description: e.description,
      });
    }
  }

  // Configure D3 Force Layout with Obsidian-Style Spherical Galaxy Physics
  const simulation = forceSimulation<D3SimNode>(simNodes)
    // 0. Anchor Center of Gravity at Origin
    .force('center', forceCenter(0, 0))
    // 1. Multi-Body Coulomb Repulsion
    .force(
      'charge',
      forceManyBody<D3SimNode>()
        .strength((d) => (d.isHub ? -380 : -22))
        .distanceMax(Math.max(480, boundaryRadius * 1.3))
    )
    // 2. Elastic Spring Links: Compact 38px column bouquet, 135px cluster separation
    .force(
      'link',
      forceLink<D3SimNode, D3SimLink>(simLinks)
        .distance((l) => (l.relationship === 'CONTAINS' ? 38 : 135))
        .strength((l) => (l.relationship === 'CONTAINS' ? 0.95 : 0.18))
    )
    // 3. Collision Barrier: Active on ALL nodes to prevent label overlap
    .force(
      'collide',
      forceCollide<D3SimNode>()
        .radius((d) => d.collisionRadius)
        .strength(0.92)
        .iterations(3)
    )
    // 4. Custom Spherical Harmonic Galaxy Envelope (Obsidian-Style)
    .force('spherical', forceSphericalGalaxy(boundaryRadius))
    .alpha(0.35)
    .alphaDecay(0.035)
    .velocityDecay(0.40);

  // Synchronous warmup (60 ticks) so initial coordinates are settled into the spherical shape
  for (let i = 0; i < 60; i++) {
    simulation.tick();
  }

  return { simulation, simNodes, simLinks };
}
