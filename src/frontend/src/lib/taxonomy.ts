import type { KnowledgeGraph, TaxonomyNode } from "../types";

/**
 * Build a hierarchical taxonomy tree from a knowledge graph.
 * Top-level nodes: highest TF-IDF + degree centrality.
 * Children: nodes that predominantly co-occur with a single parent.
 */
export function buildTaxonomy(graph: KnowledgeGraph): TaxonomyNode {
  if (graph.nodes.length === 0) {
    return { id: "root", label: "Root", weight: 0, tfidf: 0, children: [] };
  }

  // Compute degree centrality
  const degree = new Map<string, number>();
  for (const node of graph.nodes) degree.set(node.id, 0);
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const maxDegree = Math.max(...degree.values(), 1);
  const maxTfidf = Math.max(...graph.nodes.map((n) => n.tfidf), 0.0001);

  // Score = normalized TF-IDF * 0.6 + normalized degree * 0.4
  const scored = graph.nodes.map((n) => ({
    ...n,
    score:
      (n.tfidf / maxTfidf) * 0.6 + ((degree.get(n.id) ?? 0) / maxDegree) * 0.4,
  }));

  scored.sort((a, b) => b.score - a.score);

  // Top 20% are root-level candidates
  const topCount = Math.max(1, Math.ceil(scored.length * 0.2));
  const topNodes = scored.slice(0, topCount);
  const childNodes = scored.slice(topCount);

  // Build adjacency for child assignment
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const topSet = new Set(topNodes.map((n) => n.id));

  // Assign each child to the top-node it most connects to
  const childParent = new Map<string, string>();
  for (const child of childNodes) {
    const neighbors = adjacency.get(child.id) ?? new Set();
    let bestParent: string | null = null;
    let bestCount = 0;
    for (const neighbor of neighbors) {
      if (topSet.has(neighbor)) {
        const count = 1;
        if (count > bestCount) {
          bestCount = count;
          bestParent = neighbor;
        }
      }
    }
    if (bestParent) {
      childParent.set(child.id, bestParent);
    }
  }

  // Build tree structure
  const _nodeMap = new Map(scored.map((n) => [n.id, n]));
  const taxonomyNodes = new Map<string, TaxonomyNode>();

  for (const n of scored) {
    taxonomyNodes.set(n.id, {
      id: n.id,
      label: n.label,
      weight: n.weight,
      tfidf: n.tfidf,
      children: [],
    });
  }

  // Attach children to parents
  for (const [childId, parentId] of childParent.entries()) {
    const parentTax = taxonomyNodes.get(parentId);
    const childTax = taxonomyNodes.get(childId);
    if (parentTax && childTax) {
      parentTax.children.push(childTax);
    }
  }

  // Create virtual root
  const root: TaxonomyNode = {
    id: "root",
    label: graph.label ?? "Knowledge Graph",
    weight: 1,
    tfidf: 1,
    children: topNodes.map((n) => taxonomyNodes.get(n.id)!).filter(Boolean),
  };

  return root;
}

/**
 * Flatten taxonomy tree to array for CSV/Excel export.
 */
export function flattenTaxonomy(
  node: TaxonomyNode,
  depth = 0,
  parentLabel = "",
): Array<{
  id: string;
  label: string;
  depth: number;
  parent: string;
  weight: number;
  tfidf: number;
}> {
  const result = [
    {
      id: node.id,
      label: node.label,
      depth,
      parent: parentLabel,
      weight: node.weight,
      tfidf: node.tfidf,
    },
  ];
  for (const child of node.children) {
    result.push(...flattenTaxonomy(child, depth + 1, node.label));
  }
  return result;
}
