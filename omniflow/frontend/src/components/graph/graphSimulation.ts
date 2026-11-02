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
 * Pulls any node that drifts outside the circular radius back into the sphere,
 * creating Obsidian's signature encompassed circular silhouette.
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
 * Gently pulls all clusters toward (0, 0) to balance Coulomb repulsion.
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
 * Seeds and configures a snowflake radial tree simulation encompassed in a circular sphere.
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

  // Identify Table Hubs and their Child Spoke Columns
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

  // Pre-seed positions in a growing radial pattern with snowflake rosettes
  const posMap = new Map<string, { x: number; y: number }>();
  hubList.forEach((hub, idx) => {
    const sector = LAYER_RADIAL_SECTORS[hub.layer] || {
      angle: (idx / Math.max(1, hubList.length)) * Math.PI * 2,
      dist: 110,
    };
    const jitter = ((idx % 3) - 1) * 22;
    const hx = Math.cos(sector.angle) * (sector.dist + jitter);
    const hy = Math.sin(sector.angle) * (sector.dist + jitter);
    posMap.set(hub.id, { x: hx, y: hy });

    // Snowflake Rosette: Arrange spoke columns 360° evenly around the hub
    const spokes = spokeMap.get(hub.id) || [];
    spokes.forEach((spoke, sIdx) => {
      const spokeAngle = (sIdx / Math.max(1, spokes.length)) * Math.PI * 2;
      const rSpoke = 28 + (sIdx % 2) * 6;
      posMap.set(spoke.id, {
        x: hx + Math.cos(spokeAngle) * rSpoke,
        y: hy + Math.sin(spokeAngle) * rSpoke,
      });
    });
  });

  // Position any remaining leaf or singleton nodes along the outer circle
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
    const labelLen = (n.label || '').length;
    const textHalfWidth = Math.min(65, Math.max(12, labelLen * 2.8));
    const collisionRadius = Math.max(r + 8, textHalfWidth + 4);
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

  // Configure D3 Force Layout with Snowflake Physics
  const simulation = forceSimulation<D3SimNode>(simNodes)
    // 1. Multi-Body Repulsion: Strong push for hubs, mild push for spoke petals
    .force(
      'charge',
      forceManyBody<D3SimNode>()
        .strength((d) => (d.isHub ? -360 : -22))
        .distanceMax(450)
    )
    // 2. Elastic Spring Links: Tight for spoke columns, spacious for cross-layer flow
    .force(
      'link',
      forceLink<D3SimNode, D3SimLink>(simLinks)
        .distance((l) => (l.relationship === 'CONTAINS' ? 28 : 125))
        .strength((l) => (l.relationship === 'CONTAINS' ? 0.92 : 0.25))
    )
    // 3. Collision Barrier: Keeps node + text unified without overlapping
    .force(
      'collide',
      forceCollide<D3SimNode>()
        .radius((d) => (d.isHub ? d.collisionRadius : d.radius + 4))
        .strength(0.85)
        .iterations(2)
    )
    // 4. Inward Radial Gravity: Keeps whole graph tightly bound
    .force('gravity', forceRadialGravity(0.04))
    // 5. Circular Boundary Enclosure: Encompasses all nodes strictly within a circle
    .force('circular_boundary', forceCircularBoundary(boundaryRadius, 0.32))
    .velocityDecay(0.38);

  return { simulation, simNodes, simLinks };
}
