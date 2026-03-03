export interface QueryEntry {
  query: string;
  frequency: number;
}

export type IntentGroup = QueryEntry[];

export type AnalysisMode = "global" | "intent";

export interface GraphNode {
  id: string;
  label: string;
  weight: number;
  tfidf: number;
  group: string; // 'global' or intent index as string
  x: number;
  y: number;
  z: number;
  degree?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  weight: number;
}

export type RelationType =
  | "association"
  | "co-occurrence"
  | "hierarchical"
  | "functional";

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  label?: string;
}

export interface Triplet {
  subject: string;
  predicate: RelationType;
  object: string;
  weight: number;
}

export interface TaxonomyNode {
  id: string;
  label: string;
  weight: number;
  tfidf: number;
  children: TaxonomyNode[];
}

export interface OntologyEntry {
  entityA: string;
  entityB: string;
  relationType: RelationType;
  confidence: number;
}

export interface AnalysisResult {
  graph: KnowledgeGraph;
  triplets: Triplet[];
  taxonomy: TaxonomyNode;
  ontology: OntologyEntry[];
  intentGraphs?: KnowledgeGraph[];
  metaGraph?: KnowledgeGraph;
  intentTaxonomies?: TaxonomyNode[];
}
