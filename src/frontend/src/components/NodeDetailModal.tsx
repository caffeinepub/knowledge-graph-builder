import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useMemo } from "react";
import { tokenize } from "../lib/textProcessor";
import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  TaxonomyNode,
} from "../types";
import type { IntentGroup } from "../types";
import { MiniGraph } from "./MiniGraph";

const RELATION_LABELS: Record<string, string> = {
  association: "Ассоциация",
  "co-occurrence": "Совм. встречаемость",
  hierarchical: "Иерархическая",
  functional: "Функциональная",
};

const RELATION_COLORS: Record<string, string> = {
  association: "#00d4f5",
  "co-occurrence": "#a855f7",
  hierarchical: "#f59e0b",
  functional: "#22c55e",
};

/** Flatten a taxonomy tree and find the node's parent and children */
function findTaxonomyPosition(
  root: TaxonomyNode | null,
  nodeLabel: string,
): { parent: string | null; children: string[] } {
  if (!root) return { parent: null, children: [] };

  function search(
    node: TaxonomyNode,
    parentLabel: string | null,
  ): { parent: string | null; children: string[] } | null {
    if (node.label.toLowerCase() === nodeLabel.toLowerCase()) {
      return {
        parent: parentLabel,
        children: node.children.map((c) => c.label),
      };
    }
    for (const child of node.children) {
      const found = search(child, node.label);
      if (found) return found;
    }
    return null;
  }

  return search(root, null) ?? { parent: null, children: [] };
}

/** Extract bigrams and trigrams containing the node label from query corpus */
function findRelatedNgrams(
  nodeLabel: string,
  intentGroups: IntentGroup[],
  topN = 8,
): Array<{ ngram: string; frequency: number }> {
  const ngramFreq = new Map<string, number>();
  const lowerLabel = nodeLabel.toLowerCase();

  for (const group of intentGroups) {
    for (const entry of group) {
      const tokens = tokenize(entry.query);
      const freq = entry.frequency;

      // Bigrams
      for (let i = 0; i < tokens.length - 1; i++) {
        const bg = `${tokens[i]} ${tokens[i + 1]}`;
        if (bg.includes(lowerLabel)) {
          ngramFreq.set(bg, (ngramFreq.get(bg) ?? 0) + freq);
        }
      }

      // Trigrams
      for (let i = 0; i < tokens.length - 2; i++) {
        const tg = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
        if (tg.includes(lowerLabel)) {
          ngramFreq.set(tg, (ngramFreq.get(tg) ?? 0) + freq);
        }
      }
    }
  }

  return Array.from(ngramFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([ngram, frequency]) => ({ ngram, frequency }));
}

/** Get connected nodes and edge info */
function getConnectedNodes(
  node: GraphNode,
  graph: KnowledgeGraph,
): Array<{
  label: string;
  relationType: string;
  weight: number;
  edgeWeight: number;
}> {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const result: Array<{
    label: string;
    relationType: string;
    weight: number;
    edgeWeight: number;
  }> = [];

  for (const edge of graph.edges) {
    let connectedId: string | null = null;
    if (edge.source === node.id) connectedId = edge.target;
    else if (edge.target === node.id) connectedId = edge.source;

    if (connectedId) {
      const connected = nodeMap.get(connectedId);
      if (connected) {
        result.push({
          label: connected.label,
          relationType: edge.relationType,
          weight: connected.weight,
          edgeWeight: edge.weight,
        });
      }
    }
  }

  return result.sort((a, b) => b.edgeWeight - a.edgeWeight);
}

interface NodeDetailModalProps {
  node: GraphNode;
  graph: KnowledgeGraph;
  taxonomy: TaxonomyNode | null;
  intentGroups: IntentGroup[];
  connectionCount: number;
  onClose: () => void;
  onNavigateToNode: (nodeLabel: string) => void;
  history: string[];
  onBack: () => void;
}

export function NodeDetailModal({
  node,
  graph,
  taxonomy,
  intentGroups,
  connectionCount,
  onClose,
  onNavigateToNode,
  history,
  onBack,
}: NodeDetailModalProps) {
  const connectedNodes = useMemo(
    () => getConnectedNodes(node, graph),
    [node, graph],
  );

  const taxonomyPosition = useMemo(
    () => findTaxonomyPosition(taxonomy, node.label),
    [taxonomy, node.label],
  );

  const relatedNgrams = useMemo(
    () => findRelatedNgrams(node.label, intentGroups),
    [node.label, intentGroups],
  );

  const nodeTypeLabel =
    node.group === "global"
      ? "Глобальный"
      : node.group === "meta"
        ? "Мета-узел"
        : `Интент ${Number(node.group.replace("intent-", "")) + 1}`;

  const centrality =
    (node.degree ?? connectionCount) > 0
      ? ((node.degree ?? connectionCount) / 10).toFixed(3)
      : "0.000";

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-ocid="node_detail.modal"
    >
      <div
        style={{
          background: "rgba(8,10,24,0.98)",
          border: "1px solid rgba(0,212,245,0.25)",
          borderLeft: "4px solid #00d4f5",
          borderRadius: "14px",
          width: "min(680px, 92vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          fontFamily: '"JetBrains Mono", "Courier New", monospace',
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.9), 0 0 60px rgba(0,212,245,0.12)",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(0,212,245,0.3) transparent",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "rgba(8,10,24,0.98)",
            backdropFilter: "blur(12px)",
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            zIndex: 1,
          }}
        >
          <div>
            <div
              style={{
                color: "#00d4f5",
                fontWeight: 700,
                fontSize: "20px",
                letterSpacing: "0.02em",
                lineHeight: 1.3,
                wordBreak: "break-word",
                maxWidth: "520px",
              }}
            >
              {node.label}
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "11px",
                marginTop: "4px",
                display: "flex",
                gap: "12px",
              }}
            >
              <span
                style={{
                  color: "#7dd3fc",
                  background: "rgba(125,211,252,0.1)",
                  padding: "1px 8px",
                  borderRadius: "4px",
                }}
              >
                {nodeTypeLabel}
              </span>
              <span>{connectionCount} связей</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-ocid="node_detail.close_button"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
              color: "#94a3b8",
              flexShrink: 0,
              marginLeft: "12px",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.06)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "20px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Breadcrumb navigation history */}
          {history.length > 0 && (
            <button
              type="button"
              data-ocid="node_detail.back.button"
              onClick={onBack}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                padding: "0",
                cursor: "pointer",
                color: "#64748b",
                fontSize: "11px",
                fontFamily: '"JetBrains Mono", "Courier New", monospace',
                marginTop: "-8px",
                transition: "color 0.15s",
                alignSelf: "flex-start",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
              }}
            >
              <ArrowLeft size={12} />
              <span>Назад: {history[history.length - 1]}</span>
            </button>
          )}

          {/* Section 1: Base metrics */}
          <Section title="Основные метрики" color="#00d4f5">
            <MetricGrid>
              {node.frequency !== undefined && (
                <MetricCard
                  label="Частота"
                  value={node.frequency.toLocaleString("ru-RU")}
                  color="#00d4f5"
                  large
                />
              )}
              <MetricCard
                label="TF-IDF"
                value={node.tfidf.toFixed(5)}
                color="#e2e8f0"
              />
              <MetricCard
                label="Вес"
                value={node.weight.toFixed(3)}
                color="#e2e8f0"
              />
              <MetricCard
                label="Связей"
                value={String(connectionCount)}
                color="#a78bfa"
                large
              />
              <MetricCard
                label="Центральность"
                value={centrality}
                color="#e2e8f0"
              />
            </MetricGrid>
          </Section>

          {/* Section 2: Connected nodes */}
          {connectedNodes.length > 0 && (
            <Section
              title={`Связанные узлы (${connectedNodes.length})`}
              color="#a855f7"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {connectedNodes.map((cn, idx) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: interactive row with visual feedback
                  <div
                    key={`${cn.label}-${cn.relationType}`}
                    data-ocid={`node_detail.connected_node.item.${idx + 1}`}
                    onClick={() => onNavigateToNode(cn.label)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "rgba(168,85,247,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "rgba(255,255,255,0.03)";
                    }}
                  >
                    <span
                      style={{
                        color: "#e2e8f0",
                        fontSize: "13px",
                        flex: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      {cn.label}
                    </span>
                    <span
                      style={{
                        color: RELATION_COLORS[cn.relationType] ?? "#94a3b8",
                        fontSize: "11px",
                        background: `${RELATION_COLORS[cn.relationType] ?? "#94a3b8"}1a`,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {RELATION_LABELS[cn.relationType] ?? cn.relationType}
                    </span>
                    <span
                      style={{
                        color: "#64748b",
                        fontSize: "11px",
                        minWidth: "42px",
                        textAlign: "right",
                      }}
                    >
                      {cn.edgeWeight.toFixed(3)}
                    </span>
                    <ArrowRight
                      size={12}
                      style={{
                        color: RELATION_COLORS[cn.relationType] ?? "#94a3b8",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Section 3: Taxonomy position */}
          <Section title="Место в таксономии" color="#f59e0b">
            {taxonomyPosition.parent === null &&
            taxonomyPosition.children.length === 0 ? (
              <EmptyNote text="Узел не найден в таксономии текущего графа" />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {taxonomyPosition.parent && (
                  <ClickableTaxRow
                    label="Родительский узел"
                    value={taxonomyPosition.parent}
                    color="#f59e0b"
                    onNavigate={() =>
                      onNavigateToNode(taxonomyPosition.parent as string)
                    }
                  />
                )}
                {!taxonomyPosition.parent && (
                  <div
                    style={{
                      color: "#22c55e",
                      fontSize: "12px",
                      padding: "4px 0",
                    }}
                  >
                    ★ Верхнеуровневый узел (корневой)
                  </div>
                )}
                {taxonomyPosition.children.length > 0 && (
                  <div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "11px",
                        marginBottom: "6px",
                      }}
                    >
                      Дочерние узлы ({taxonomyPosition.children.length}):
                    </div>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                    >
                      {taxonomyPosition.children.map((child, idx) => (
                        // biome-ignore lint/a11y/useKeyWithClickEvents: interactive tag with visual feedback
                        <span
                          key={child}
                          data-ocid={`node_detail.taxonomy_child.item.${idx + 1}`}
                          onClick={() => onNavigateToNode(child)}
                          style={{
                            color: "#f59e0b",
                            background: "rgba(245,158,11,0.1)",
                            border: "1px solid rgba(245,158,11,0.2)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "background 0.15s, border-color 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLSpanElement
                            ).style.background = "rgba(245,158,11,0.22)";
                            (
                              e.currentTarget as HTMLSpanElement
                            ).style.borderColor = "rgba(245,158,11,0.5)";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLSpanElement
                            ).style.background = "rgba(245,158,11,0.1)";
                            (
                              e.currentTarget as HTMLSpanElement
                            ).style.borderColor = "rgba(245,158,11,0.2)";
                          }}
                        >
                          {child}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Section 4: Mini graph (2-level neighbourhood) */}
          <Section title="Окружение узла (2 уровня)" color="#00d4f5">
            <MiniGraph
              focalNode={node}
              graph={graph}
              onNodeClick={onNavigateToNode}
            />
          </Section>

          {/* Section 5: Related N-grams */}
          <Section title="Связанные N-граммы" color="#22c55e">
            {relatedNgrams.length === 0 ? (
              <EmptyNote text="N-граммы с данным узлом не найдены" />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {relatedNgrams.map((ng) => (
                  <div
                    key={ng.ngram}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "rgba(34,197,94,0.04)",
                      border: "1px solid rgba(34,197,94,0.1)",
                    }}
                  >
                    <span style={{ color: "#e2e8f0", fontSize: "13px" }}>
                      {ng.ngram}
                    </span>
                    <span
                      style={{
                        color: "#22c55e",
                        fontSize: "12px",
                        fontWeight: 600,
                        background: "rgba(34,197,94,0.1)",
                        padding: "1px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {ng.frequency.toLocaleString("ru-RU")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: "3px",
            height: "16px",
            borderRadius: "2px",
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color,
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
  large,
}: {
  label: string;
  value: string;
  color: string;
  large?: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        padding: "10px 14px",
        minWidth: "100px",
        flex: "1 1 100px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "10px",
          marginBottom: "4px",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontSize: large ? "20px" : "15px",
          fontWeight: large ? 700 : 500,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ClickableTaxRow({
  label,
  value,
  color,
  onNavigate,
}: {
  label: string;
  value: string;
  color: string;
  onNavigate: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <span style={{ color: "#64748b", fontSize: "12px", minWidth: "130px" }}>
        {label}:
      </span>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: interactive tag with visual feedback */}
      <span
        data-ocid="node_detail.taxonomy_parent.button"
        onClick={onNavigate}
        style={{
          color,
          background: `${color}1a`,
          border: `1px solid ${color}33`,
          padding: "2px 10px",
          borderRadius: "4px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLSpanElement).style.background = `${color}33`;
          (e.currentTarget as HTMLSpanElement).style.borderColor = `${color}66`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLSpanElement).style.background = `${color}1a`;
          (e.currentTarget as HTMLSpanElement).style.borderColor = `${color}33`;
        }}
      >
        {value}
      </span>
      <ArrowRight size={12} style={{ color, opacity: 0.6, flexShrink: 0 }} />
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "#475569",
        fontSize: "12px",
        fontStyle: "italic",
        padding: "4px 0",
      }}
    >
      {text}
    </div>
  );
}

// React import needed for JSX
import type React from "react";
