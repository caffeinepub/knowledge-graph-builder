import { type KnowledgeGraph, RelationType, type Triplet } from "../types";

/**
 * Extract semantic triplets from knowledge graph edges.
 * Each edge produces one triplet with a classified predicate.
 */
export function extractTriplets(graph: KnowledgeGraph): Triplet[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const triplets: Triplet[] = [];

  for (const edge of graph.edges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    // Determine subject/object order: higher TF-IDF is subject
    const [subject, object] =
      sourceNode.tfidf >= targetNode.tfidf
        ? [sourceNode.label, targetNode.label]
        : [targetNode.label, sourceNode.label];

    triplets.push({
      subject,
      predicate: edge.relationType,
      object,
      weight: edge.weight,
    });
  }

  return triplets.sort((a, b) => b.weight - a.weight);
}

/**
 * Convert triplets to CSV string.
 */
export function tripletsToCSV(triplets: Triplet[]): string {
  const header = "Subject,Predicate,Object,Weight\n";
  const rows = triplets
    .map(
      (t) =>
        `"${t.subject}","${t.predicate}","${t.object}",${t.weight.toFixed(4)}`,
    )
    .join("\n");
  return header + rows;
}
