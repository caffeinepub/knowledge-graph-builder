import { GraphNode, GraphEdge } from '../types';

const REPULSION = 80;
const ATTRACTION = 0.04;
const GRAVITY = 0.02;
const DAMPING = 0.85;
const MIN_DIST = 2.5;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Apply a spring-based force-directed layout to position graph nodes in 3D space.
 * Modifies node positions in-place.
 */
export function applyForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  iterations: number = 120
): GraphNode[] {
  if (nodes.length === 0) return nodes;

  // Initialize positions randomly in a sphere
  const positioned = nodes.map(n => ({
    ...n,
    x: n.x !== 0 ? n.x : (Math.random() - 0.5) * 20,
    y: n.y !== 0 ? n.y : (Math.random() - 0.5) * 20,
    z: n.z !== 0 ? n.z : (Math.random() - 0.5) * 20,
  }));

  const velocities: Vec3[] = positioned.map(() => ({ x: 0, y: 0, z: 0 }));
  const nodeIndex = new Map(positioned.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const forces: Vec3[] = positioned.map(() => ({ x: 0, y: 0, z: 0 }));

    // Repulsion between all node pairs
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[i].x - positioned[j].x;
        const dy = positioned[i].y - positioned[j].y;
        const dz = positioned[i].z - positioned[j].z;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), MIN_DIST);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        forces[i].x += fx;
        forces[i].y += fy;
        forces[i].z += fz;
        forces[j].x -= fx;
        forces[j].y -= fy;
        forces[j].z -= fz;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const si = nodeIndex.get(edge.source);
      const ti = nodeIndex.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const dx = positioned[ti].x - positioned[si].x;
      const dy = positioned[ti].y - positioned[si].y;
      const dz = positioned[ti].z - positioned[si].z;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), MIN_DIST);
      const force = ATTRACTION * dist * (1 + edge.weight * 0.01);
      forces[si].x += (dx / dist) * force;
      forces[si].y += (dy / dist) * force;
      forces[si].z += (dz / dist) * force;
      forces[ti].x -= (dx / dist) * force;
      forces[ti].y -= (dy / dist) * force;
      forces[ti].z -= (dz / dist) * force;
    }

    // Gravity toward center
    for (let i = 0; i < positioned.length; i++) {
      forces[i].x -= positioned[i].x * GRAVITY;
      forces[i].y -= positioned[i].y * GRAVITY;
      forces[i].z -= positioned[i].z * GRAVITY;
    }

    // Update velocities and positions
    for (let i = 0; i < positioned.length; i++) {
      velocities[i].x = (velocities[i].x + forces[i].x) * DAMPING;
      velocities[i].y = (velocities[i].y + forces[i].y) * DAMPING;
      velocities[i].z = (velocities[i].z + forces[i].z) * DAMPING;
      positioned[i].x += velocities[i].x;
      positioned[i].y += velocities[i].y;
      positioned[i].z += velocities[i].z;
    }
  }

  return positioned;
}
