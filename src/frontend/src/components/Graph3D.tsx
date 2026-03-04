import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type {
  GraphEdge,
  GraphNode,
  IntentGroup,
  KnowledgeGraph,
  RelationType,
  TaxonomyNode,
} from "../types";
import { NodeDetailModal } from "./NodeDetailModal";
import { TooltipIcon } from "./TooltipIcon";

// Color mapping for relation types (literal values for Three.js)
const RELATION_COLORS: Record<RelationType, string> = {
  association: "#00d4f5",
  "co-occurrence": "#a855f7",
  hierarchical: "#f59e0b",
  functional: "#22c55e",
};

const _RELATION_LABELS: Record<RelationType, string> = {
  association: "ассоциация",
  "co-occurrence": "совместная встречаемость",
  hierarchical: "иерархическая",
  functional: "функциональная",
};

const _RELATION_TOOLTIPS: Record<RelationType, React.ReactNode> = {
  association: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#00d4f5" }}>
        Ассоциация
      </p>
      <p>
        Высокая совместная встречаемость и схожие TF-IDF значения. Термины
        тематически близки и относятся к одной предметной области.
      </p>
    </div>
  ),
  "co-occurrence": (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#a855f7" }}>
        Совместная встречаемость
      </p>
      <p>
        Термины часто появляются вместе в пределах одного контекстного окна.
        Статистическая связь без явной семантики.
      </p>
    </div>
  ),
  hierarchical: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#f59e0b" }}>
        Иерархическая
      </p>
      <p>
        Один термин является подтипом, категорией или обобщением другого.
        Отношение «является частью» или «является видом».
      </p>
    </div>
  ),
  functional: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#22c55e" }}>
        Функциональная
      </p>
      <p>
        Один термин модифицирует, уточняет или функционально дополняет другой.
        Отношение «используется для» или «влияет на».
      </p>
    </div>
  ),
};

const NODE_COLOR_HIGH = "#00d4f5";
const NODE_COLOR_LOW = "#1e3a5f";

const NODE_TYPE_LABELS: Record<string, string> = {
  global: "Глобальный",
  meta: "Мета-узел",
};

interface NodeMeshProps {
  node: GraphNode;
  isSelected: boolean;
  isNeighbor: boolean;
  isHighlighted: boolean;
  connectionCount: number;
  onClick: (node: GraphNode) => void;
  onHover: (node: GraphNode | null) => void;
}

function NodeMesh({
  node,
  isSelected,
  isNeighbor,
  isHighlighted,
  connectionCount,
  onClick,
  onHover,
}: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const radius = 0.15 + node.weight * 0.55;
  const opacity = isHighlighted || isSelected || isNeighbor ? 1 : 0.25;

  const color = useMemo(() => {
    if (isSelected) return "#ffffff";
    if (isNeighbor) return "#f59e0b";
    if (hovered) return "#7dd3fc";
    return new THREE.Color(NODE_COLOR_LOW).lerp(
      new THREE.Color(NODE_COLOR_HIGH),
      Math.min(node.tfidf * 8, 1),
    );
  }, [isSelected, isNeighbor, hovered, node.tfidf]);

  // Border color for the tooltip card matches the node's base color
  const borderColor = isSelected
    ? "#ffffff"
    : isNeighbor
      ? "#f59e0b"
      : "#00d4f5";

  const nodeTypeLabel =
    NODE_TYPE_LABELS[node.group] ?? `Интент ${Number(node.group) + 1}`;

  useFrame((_, delta) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Three.js mesh is not a DOM element
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(node);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "default";
      }}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color as THREE.ColorRepresentation}
        emissive={color as THREE.ColorRepresentation}
        emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.2}
        transparent
        opacity={opacity}
        roughness={0.3}
        metalness={0.6}
      />
      {hovered && (
        <Html distanceFactor={6} style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(8,10,24,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: "10px",
              padding: "14px 18px",
              minWidth: "260px",
              maxWidth: "320px",
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              pointerEvents: "none",
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.85), 0 0 30px rgba(0,212,245,0.15)",
              backdropFilter: "blur(12px)",
            }}
          >
            {/* Node label */}
            <div
              style={{
                color: borderColor,
                fontWeight: 700,
                fontSize: "16px",
                letterSpacing: "0.02em",
                marginBottom: "10px",
                lineHeight: 1.3,
                wordBreak: "break-word",
                whiteSpace: "normal",
              }}
            >
              {node.label}
            </div>

            <div
              style={{
                height: "1px",
                background: "rgba(255,255,255,0.1)",
                marginBottom: "10px",
              }}
            />

            <div
              style={{ display: "flex", flexDirection: "column", gap: "7px" }}
            >
              {node.frequency !== undefined && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                    Частота
                  </span>
                  <span
                    style={{
                      color: "#f8fafc",
                      fontSize: "14px",
                      fontWeight: 700,
                      background: `rgba(${borderColor === "#f59e0b" ? "245,158,11" : "0,212,245"},0.12)`,
                      padding: "1px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {node.frequency.toLocaleString("ru-RU")}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                  TF-IDF
                </span>
                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {node.tfidf.toFixed(5)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>Вес</span>
                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {node.weight.toFixed(3)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                  Связи
                </span>
                <span
                  style={{
                    color: "#a78bfa",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {connectionCount}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: "12px" }}>Тип</span>
                <span
                  style={{
                    color: "#7dd3fc",
                    fontSize: "11px",
                    background: "rgba(125,211,252,0.12)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontWeight: 500,
                  }}
                >
                  {nodeTypeLabel}
                </span>
              </div>
            </div>

            {/* Hint to click */}
            <div
              style={{
                marginTop: "10px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: "8px",
                color: "#475569",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              Кликните для полной аналитики
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

interface EdgeLineProps {
  edge: GraphEdge;
  sourceNode: GraphNode;
  targetNode: GraphNode;
  isHighlighted: boolean;
  anySelected: boolean;
}

function EdgeLine({
  edge,
  sourceNode,
  targetNode,
  isHighlighted,
  anySelected,
}: EdgeLineProps) {
  const lineRef = useRef<THREE.Line>(null);

  const color = RELATION_COLORS[edge.relationType];
  const opacity = anySelected
    ? isHighlighted
      ? 0.9
      : 0.05
    : 0.35 + edge.weight * 0.4;

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [
    sourceNode.x,
    sourceNode.y,
    sourceNode.z,
    targetNode.x,
    targetNode.y,
    targetNode.z,
  ]);

  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
    });
  }, [color, opacity]);

  const lineObject = useMemo(() => {
    const obj = new THREE.Line(geometry, material);
    return obj;
  }, [geometry, material]);

  return <primitive object={lineObject} ref={lineRef} />;
}

interface SceneProps {
  graph: KnowledgeGraph;
  onNodeClick: (node: GraphNode) => void;
}

function Scene({ graph, onNodeClick }: SceneProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when graph changes
  useEffect(() => {
    setSelectedId(null);
  }, [graph]);

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const neighbors = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.source === selectedId) neighbors.add(edge.target);
      if (edge.target === selectedId) neighbors.add(edge.source);
    }
    return neighbors;
  }, [selectedId, graph.edges]);

  const highlightedEdgeIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(
      graph.edges
        .filter((e) => e.source === selectedId || e.target === selectedId)
        .map((e) => e.id),
    );
  }, [selectedId, graph.edges]);

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  // Compute degree (number of connections) per node
  const nodeDegreesMap = useMemo(() => {
    const degreeMap = new Map<string, number>();
    for (const node of graph.nodes) {
      degreeMap.set(node.id, 0);
    }
    for (const edge of graph.edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
    return degreeMap;
  }, [graph.nodes, graph.edges]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedId((prev) => (prev === node.id ? null : node.id));
      onNodeClick(node);
    },
    [onNodeClick],
  );

  const anySelected = selectedId !== null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[20, 20, 20]} intensity={1.2} color="#00d4f5" />
      <pointLight position={[-20, -10, -20]} intensity={0.6} color="#f59e0b" />
      <pointLight position={[0, -20, 10]} intensity={0.4} color="#a855f7" />

      {graph.edges.map((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;
        return (
          <EdgeLine
            key={edge.id}
            edge={edge}
            sourceNode={src}
            targetNode={tgt}
            isHighlighted={highlightedEdgeIds.has(edge.id)}
            anySelected={anySelected}
          />
        );
      })}

      {graph.nodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          isNeighbor={neighborIds.has(node.id)}
          isHighlighted={
            !anySelected || selectedId === node.id || neighborIds.has(node.id)
          }
          connectionCount={nodeDegreesMap.get(node.id) ?? 0}
          onClick={handleNodeClick}
          onHover={() => {}}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        panSpeed={0.6}
        makeDefault
      />
    </>
  );
}

interface Graph3DProps {
  graph: KnowledgeGraph | null;
  fullGraph: KnowledgeGraph | null;
  taxonomy: TaxonomyNode | null;
  intentGroups: IntentGroup[];
}

const GRAPH_INTERACTION_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "#00d4f5" }}>
      Управление 3D-графом
    </p>
    <ul className="space-y-0.5 list-none">
      <li>
        <span style={{ color: "#00d4f5" }}>Вращение</span> — зажмите левую
        кнопку мыши и перетащите
      </li>
      <li>
        <span style={{ color: "#f59e0b" }}>Масштаб</span> — прокрутите колесо
        мыши
      </li>
      <li>
        <span style={{ color: "#a855f7" }}>Перемещение</span> — зажмите правую
        кнопку мыши и перетащите
      </li>
      <li>
        <span style={{ color: "#22c55e" }}>Клик по узлу</span> — открывает
        полную аналитику по узлу в отдельном окне
      </li>
    </ul>
    <p className="text-muted-foreground">
      Размер узла отражает его вес (значимость). Наведите курсор на узел для
      быстрого просмотра данных, кликните для детальной аналитики.
    </p>
  </div>
);

export function Graph3D({
  graph,
  fullGraph,
  taxonomy,
  intentGroups,
}: Graph3DProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeConnectionCount, setNodeConnectionCount] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  // Use fullGraph for the modal analytics (richer data), fallback to display graph
  const analyticsGraph = fullGraph ?? graph;

  // Compute degree map for the analytics graph (fullGraph or graph)
  const analyticsDegreesMap = useMemo(() => {
    if (!analyticsGraph) return new Map<string, number>();
    const degreeMap = new Map<string, number>();
    for (const node of analyticsGraph.nodes) degreeMap.set(node.id, 0);
    for (const edge of analyticsGraph.edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
    return degreeMap;
  }, [analyticsGraph]);

  // Compute degree map for the display graph
  const nodeDegreesMap = useMemo(() => {
    if (!graph) return new Map<string, number>();
    const degreeMap = new Map<string, number>();
    for (const node of graph.nodes) degreeMap.set(node.id, 0);
    for (const edge of graph.edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }
    return degreeMap;
  }, [graph]);

  /** Look up a node by label (case-insensitive) in analyticsGraph, then graph as fallback */
  const findNodeByLabel = useCallback(
    (label: string): GraphNode | undefined => {
      const lower = label.toLowerCase();
      if (analyticsGraph) {
        const found = analyticsGraph.nodes.find(
          (n) => n.label.toLowerCase() === lower,
        );
        if (found) return found;
      }
      if (graph) {
        return graph.nodes.find((n) => n.label.toLowerCase() === lower);
      }
      return undefined;
    },
    [analyticsGraph, graph],
  );

  const getConnectionCount = useCallback(
    (node: GraphNode): number => {
      return (
        analyticsDegreesMap.get(node.id) ?? nodeDegreesMap.get(node.id) ?? 0
      );
    },
    [analyticsDegreesMap, nodeDegreesMap],
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const count = nodeDegreesMap.get(node.id) ?? 0;
      setNodeConnectionCount(count);
      setSelectedNode(node);
      setHistory([]); // reset history when opening a new node from the graph
    },
    [nodeDegreesMap],
  );

  const handleNavigateToNode = useCallback(
    (nodeLabel: string) => {
      if (!selectedNode) return;
      const target = findNodeByLabel(nodeLabel);
      if (!target) return;

      setHistory((prev) => [...prev, selectedNode.label]);
      setSelectedNode(target);
      setNodeConnectionCount(getConnectionCount(target));
    },
    [selectedNode, findNodeByLabel, getConnectionCount],
  );

  const handleBack = useCallback(() => {
    if (history.length === 0) return;
    const prevLabel = history[history.length - 1];
    const prevNode = findNodeByLabel(prevLabel);
    if (!prevNode) return;

    setHistory((prev) => prev.slice(0, -1));
    setSelectedNode(prevNode);
    setNodeConnectionCount(getConnectionCount(prevNode));
  }, [history, findNodeByLabel, getConnectionCount]);

  const handleCloseModal = useCallback(() => {
    setSelectedNode(null);
    setHistory([]);
  }, []);

  // Reset history when graph changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on graph identity change
  useEffect(() => {
    setHistory([]);
    setSelectedNode(null);
  }, [graph]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
          <div
            className="w-16 h-16 rounded-full border flex items-center justify-center animate-pulse-glow"
            style={{ borderColor: "oklch(0.82 0.19 195 / 0.3)" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              aria-labelledby="graph-icon-title"
            >
              <title id="graph-icon-title">Граф знаний</title>
              <circle cx="8" cy="8" r="3" fill="#00d4f5" opacity="0.8" />
              <circle cx="24" cy="8" r="3" fill="#f59e0b" opacity="0.8" />
              <circle cx="16" cy="24" r="3" fill="#a855f7" opacity="0.8" />
              <line
                x1="8"
                y1="8"
                x2="24"
                y2="8"
                stroke="#00d4f5"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <line
                x1="8"
                y1="8"
                x2="16"
                y2="24"
                stroke="#f59e0b"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <line
                x1="24"
                y1="8"
                x2="16"
                y2="24"
                stroke="#a855f7"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
            </svg>
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            Загрузите файл .xlsx и нажмите{" "}
            <span style={{ color: "oklch(0.82 0.19 195)" }}>Анализировать</span>{" "}
            для построения графа знаний
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Interaction tooltip in top-right corner */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
        <TooltipIcon
          content={GRAPH_INTERACTION_TOOLTIP}
          side="left"
          align="start"
        />
      </div>

      <Canvas
        camera={{ position: [0, 0, 35], fov: 60, near: 0.1, far: 1000 }}
        style={{ background: "transparent" }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene graph={graph} onNodeClick={handleNodeClick} />
      </Canvas>

      {/* Node detail modal — rendered outside Canvas in DOM */}
      {selectedNode && analyticsGraph && (
        <NodeDetailModal
          node={selectedNode}
          graph={analyticsGraph}
          taxonomy={taxonomy}
          intentGroups={intentGroups}
          connectionCount={nodeConnectionCount}
          onClose={handleCloseModal}
          onNavigateToNode={handleNavigateToNode}
          history={history}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
