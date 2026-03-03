import type {
  KnowledgeGraph,
  OntologyEntry,
  RelationType,
  Triplet,
} from "../types";

/**
 * Build ontology by classifying entity pairs into semantic relation categories.
 * Uses deterministic statistical rules based on graph structure and TF-IDF.
 */
export function buildOntology(
  graph: KnowledgeGraph,
  _triplets: Triplet[],
): OntologyEntry[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const entries: OntologyEntry[] = [];
  const seen = new Set<string>();

  for (const edge of graph.edges) {
    const nodeA = nodeMap.get(edge.source);
    const nodeB = nodeMap.get(edge.target);
    if (!nodeA || !nodeB) continue;

    const key = [nodeA.label, nodeB.label].sort().join("|||");
    if (seen.has(key)) continue;
    seen.add(key);

    const tfidfDiff = Math.abs(nodeA.tfidf - nodeB.tfidf);
    const maxTfidf = Math.max(...graph.nodes.map((n) => n.tfidf), 0.0001);
    const normalizedDiff = tfidfDiff / maxTfidf;

    let relationType: RelationType;
    let confidence: number;

    // Part-whole: one term is a substring of the other
    if (
      nodeA.label.includes(nodeB.label) ||
      nodeB.label.includes(nodeA.label)
    ) {
      relationType = "hierarchical"; // maps to part-whole
      confidence = 0.9;
    }
    // Type-subtype: large TF-IDF differential (>30% of max)
    else if (normalizedDiff > 0.3) {
      relationType = "hierarchical";
      confidence = 0.5 + normalizedDiff * 0.4;
    }
    // Functional: high edge weight, one term modifies the other
    else if (edge.weight > 0.6) {
      relationType = "functional";
      confidence = 0.5 + edge.weight * 0.4;
    }
    // Association: moderate co-occurrence
    else if (edge.weight > 0.2) {
      relationType = "association";
      confidence = 0.4 + edge.weight * 0.5;
    }
    // Default: co-occurrence
    else {
      relationType = "co-occurrence";
      confidence = 0.2 + edge.weight * 0.6;
    }

    entries.push({
      entityA: nodeA.label,
      entityB: nodeB.label,
      relationType,
      confidence: Math.min(confidence, 1),
    });
  }

  return entries.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Convert ontology entries to CSV string.
 */
export function ontologyToCSV(entries: OntologyEntry[]): string {
  const header = "Entity A,Entity B,Relation Type,Confidence\n";
  const rows = entries
    .map(
      (e) =>
        `"${e.entityA}","${e.entityB}","${e.relationType}",${e.confidence.toFixed(4)}`,
    )
    .join("\n");
  return header + rows;
}
