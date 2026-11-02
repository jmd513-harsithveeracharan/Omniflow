import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { GraphMeshNode, GraphMeshEdge } from '../../types';
import { wrapLabel } from './graphRenderer';

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
 * Custom D3 Force: Soft Circular Boundary Enclosure
 * Pulls any node that drifts outside the circular radius back into the sphere.
 */
export function forceCircularBoundary(radius: number, pullStrength = 0.28) {
  let nodes: D3SimNode[] = [];

  function force(alpha: number) {
    const k = pullStrength * alpha;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      const d = Math.hypot(n.x, n.y);
      if (d > radius && d > 0) {
        const excess = d - radius;
        n.vx = (n.vx || 0) - (n.x / d) * excess * k;
        n.vy = (n.vy || 0) - (n.y / d) * excess * k;
      }
    }
  }

  force.initialize = (initNodes: D3SimNode[]) => {
    nodes = initNodes;
  };

  return force;
}

/**
 * Custom D3 Force: Radial Gravitational Well
 * Pulls clusters gently toward (0, 0) to balance Coulomb repulsion.
 */
export function forceRadialGravity(gravity = 0.045) {
  let nodes: D3SimNode[] = [];

  function force(alpha: number) {
    const k = gravity * alpha;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.x === undefined || n.y === undefined) continue;
      n.vx = (n.vx || 0) - n.x * k;
      n.vy = (n.vy || 0) - n.y * k;
    }
  }

  force.initialize = (initNodes: D3SimNode[]) => {
    nodes = initNodes;
  };

  return force;
}

const LAYER_RADIAL_SECTORS: Record<string, { angle: number; dist: number }> = {
  source: { angle: -Math.PI * 0.75, dist: 160 },
  bronze: { angle: -Math.PI * 0.45, dist: 120 },
  silver: { angle: 0, dist: 70 },
  gold: { angle: Math.PI * 0.45, dist: 120 },
  bi: { angle: Math.PI * 0.75, dist: 160 },
  warehouse: { angle: Math.PI * 0.5, dist: 130 },
  shared: { angle: -Math.PI * 0.1, dist: 100 },
};

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

  // Pre-seed positions with staggered two-tier rosettes (38px / 52px)
  const posMap = new Map<string, { x: number; y: number }>();
  const distFactor = Math.max(1, boundaryRadius / 330);

  hubList.forEach((hub, idx) => {
    const sector = LAYER_RADIAL_SECTORS[hub.layer] || {
      angle: (idx / Math.max(1, hubList.length)) * Math.PI * 2,
      dist: 110,
    };
    const scaledDist = (sector.dist || 110) * distFactor;
    const jitter = ((idx % 3) - 1) * (18 * distFactor);
    const hx = Math.cos(sector.angle) * (scaledDist + jitter);
    const hy = Math.sin(sector.angle) * (scaledDist + jitter);
    posMap.set(hub.id, { x: hx, y: hy });

    const spokes = spokeMap.get(hub.id) || [];
    spokes.forEach((spoke, sIdx) => {
      const spokeAngle = (sIdx / Math.max(1, spokes.length)) * Math.PI * 2;
      // Stagger adjacent petals to prevent text overlap
      const rSpoke = 38 + (sIdx % 2) * 14;
      posMap.set(spoke.id, {
        x: hx + Math.cos(spokeAngle) * rSpoke,
        y: hy + Math.sin(spokeAngle) * rSpoke,
      });
    });
  });

  // Peripheral singletons
  let singletonIdx = 0;
  nodes.forEach((n) => {
    if (!posMap.has(n.id)) {
      const angle = (singletonIdx++ / Math.max(1, total)) * Math.PI * 2;
      const r = boundaryRadius * (0.85 + 0.1 * Math.sin(singletonIdx));
      posMap.set(n.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
  });

  const simNodes: D3SimNode[] = nodes.map((n) => {
    const isHub = isHubNode(n);
    const r = isHub ? (n.degree > 6 ? 7.5 : 5.5) : 3.0;

    // Use 2-line wrapped text dimensions to compute anti-overlap collision bounds
    const lines = wrapLabel(n.label, isHub ? 16 : 12);
    const maxLineChars = Math.max(...lines.map((l) => l.length));
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

  // Configure D3 Force Layout with Anti-Clutter Physics
  const simulation = forceSimulation<D3SimNode>(simNodes)
    // 1. Multi-Body Repulsion
    .force(
      'charge',
      forceManyBody<D3SimNode>()
        .strength((d) => (d.isHub ? -340 : -26))
        .distanceMax(Math.max(450, boundaryRadius * 1.2))
    )
    // 2. Elastic Spring Links: 44px maintains tight flower bouquet without cramping names
    .force(
      'link',
      forceLink<D3SimNode, D3SimLink>(simLinks)
        .distance((l) => (l.relationship === 'CONTAINS' ? 44 : 125))
        .strength((l) => (l.relationship === 'CONTAINS' ? 0.94 : 0.25))
    )
    // 3. Collision Barrier: Active on ALL nodes (including columns) to prevent overlapping text
    .force(
      'collide',
      forceCollide<D3SimNode>()
        .radius((d) => d.collisionRadius)
        .strength(0.88)
        .iterations(3)
    )
    // 4. Inward Radial Gravity
    .force('gravity', forceRadialGravity(0.045))
    // 5. Circular Boundary Enclosure
    .force('circular_boundary', forceCircularBoundary(boundaryRadius, 0.32))
    .velocityDecay(0.38);

  return { simulation, simNodes, simLinks };
}
