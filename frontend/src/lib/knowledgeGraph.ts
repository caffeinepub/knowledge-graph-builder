import { GraphNode, GraphEdge, KnowledgeGraph, RelationType } from '../types';
import { EntityCandidate, RelationCandidate, TFIDFResult } from './nlpEngine';
import { applyForceLayout } from './forceLayout';

/**
 * Classify a relation type based on statistical properties of the edge.
 */
function classifyRelationType(
  termA: string,
  termB: string,
  tfidfA: number,
  tfidfB: number,
  weight: number,
  maxWeight: number
): RelationType {
  const tfidfDiff = Math.abs(tfidfA - tfidfB);
  const normalizedWeight = weight / (maxWeight || 1);

  // Part-whole: one term is a substring of the other
  if (termA.includes(termB) || termB.includes(termA)) {
    return 'hierarchical';
  }

  // Hierarchical: large TF-IDF differential
  if (tfidfDiff > 0.003) {
    return 'hierarchical';
  }

  // Functional: high weight, moderate TF-IDF similarity
  if (normalizedWeight > 0.6 && tfidfDiff < 0.002) {
    return 'functional';
  }

  // Association: moderate weight
  if (normalizedWeight > 0.3) {
    return 'association';
  }

  // Default: co-occurrence
  return 'co-occurrence';
}

/**
 * Build a knowledge graph from entity and relation candidates.
 */
export function buildKnowledgeGraph(
  entityCandidates: EntityCandidate[],
  relationCandidates: RelationCandidate[],
  tfidfMap: Map<string, TFIDFResult>,
  groupLabel: string,
  maxEdges: number = 120
): KnowledgeGraph {
  const maxWeight = Math.max(...relationCandidates.map(r => r.weight), 1);
  const maxFreq = Math.max(...entityCandidates.map(e => e.totalFrequency), 1);

  const nodes: GraphNode[] = entityCandidates.map(e => ({
    id: e.term,
    label: e.term,
    weight: e.totalFrequency / maxFreq,
    tfidf: e.tfidf,
    group: groupLabel,
    x: 0,
    y: 0,
    z: 0,
  }));

  const entitySet = new Set(entityCandidates.map(e => e.term));
  const topRelations = relationCandidates.slice(0, maxEdges);

  const edges: GraphEdge[] = topRelations
    .filter(r => entitySet.has(r.termA) && entitySet.has(r.termB))
    .map((r, i) => {
      const tfidfA = tfidfMap.get(r.termA)?.tfidf ?? 0;
      const tfidfB = tfidfMap.get(r.termB)?.tfidf ?? 0;
      const relationType = classifyRelationType(
        r.termA, r.termB, tfidfA, tfidfB, r.weight, maxWeight
      );
      return {
        id: `edge-${i}`,
        source: r.termA,
        target: r.termB,
        relationType,
        weight: r.weight / maxWeight,
      };
    });

  const positionedNodes = applyForceLayout(nodes, edges, 100);

  return { nodes: positionedNodes, edges, label: groupLabel };
}

/**
 * Build a meta-graph where nodes are intents and edges represent cross-intent similarity.
 */
export function buildMetaGraph(
  intentGraphs: KnowledgeGraph[],
  intentLabels: string[]
): KnowledgeGraph {
  const nodes: GraphNode[] = intentGraphs.map((g, i) => {
    const avgTfidf = g.nodes.reduce((s, n) => s + n.tfidf, 0) / (g.nodes.length || 1);
    const totalWeight = g.nodes.reduce((s, n) => s + n.weight, 0);
    return {
      id: `intent-${i}`,
      label: intentLabels[i] ?? `Intent ${i + 1}`,
      weight: Math.min(totalWeight / 10, 1),
      tfidf: avgTfidf,
      group: 'meta',
      x: 0,
      y: 0,
      z: 0,
    };
  });

  const edges: GraphEdge[] = [];
  let edgeIdx = 0;

  for (let i = 0; i < intentGraphs.length; i++) {
    for (let j = i + 1; j < intentGraphs.length; j++) {
      const termsA = new Set(intentGraphs[i].nodes.map(n => n.id));
      const termsB = new Set(intentGraphs[j].nodes.map(n => n.id));
      const intersection = [...termsA].filter(t => termsB.has(t)).length;
      const union = new Set([...termsA, ...termsB]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity > 0.05) {
        edges.push({
          id: `meta-edge-${edgeIdx++}`,
          source: `intent-${i}`,
          target: `intent-${j}`,
          relationType: 'association',
          weight: similarity,
        });
      }
    }
  }

  const positionedNodes = applyForceLayout(nodes, edges, 80);
  return { nodes: positionedNodes, edges, label: 'Meta-Graph' };
}
