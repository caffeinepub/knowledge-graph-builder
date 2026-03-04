/**
 * MiniGraph.tsx
 *
 * A 2D SVG mini-graph showing 2-level neighbourhood of a selected node.
 * Level 1: direct neighbours of the focal node.
 * Level 2: neighbours of level-1 nodes (excluding the focal node itself).
 *
 * Supports mouse-wheel zoom and click+drag pan. Double-click resets view.
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "../types";

const RELATION_COLORS: Record<string, string> = {
  association: "#00d4f5",
  "co-occurrence": "#a855f7",
  hierarchical: "#f59e0b",
  functional: "#22c55e",
};

/** Color for the focal/central node label — bright green for visibility */
const FOCAL_LABEL_COLOR = "#00ff88";

interface NodePos {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
  level: 0 | 1 | 2;
  weight: number;
}

interface EdgePos {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  opacity: number;
}

interface SubGraph {
  nodePosMap: Map<string, NodePos>;
  edges: EdgePos[];
  truncated: boolean;
}

const MAX_L1 = 12;
const MAX_L2 = 18;

function buildSubGraph(
  focalNode: GraphNode,
  graph: KnowledgeGraph,
  width: number,
  height: number,
): SubGraph {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgesByNode = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    if (!edgesByNode.has(edge.source)) edgesByNode.set(edge.source, []);
    if (!edgesByNode.has(edge.target)) edgesByNode.set(edge.target, []);
    edgesByNode.get(edge.source)!.push(edge);
    edgesByNode.get(edge.target)!.push(edge);
  }

  // Level 1 neighbours
  const l1Edges = edgesByNode.get(focalNode.id) ?? [];
  const l1Ids = new Set<string>();
  for (const e of l1Edges) {
    const other = e.source === focalNode.id ? e.target : e.source;
    l1Ids.add(other);
  }
  const l1Sorted = [...l1Ids]
    .map((id) => nodeMap.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_L1);
  const l1IdSet = new Set(l1Sorted.map((n) => n.id));

  // Level 2 neighbours
  const l2IdSet = new Set<string>();
  for (const l1Node of l1Sorted) {
    const l2Edges = edgesByNode.get(l1Node.id) ?? [];
    for (const e of l2Edges) {
      const other = e.source === l1Node.id ? e.target : e.source;
      if (other !== focalNode.id && !l1IdSet.has(other)) {
        l2IdSet.add(other);
      }
    }
  }
  const l2Sorted = [...l2IdSet]
    .map((id) => nodeMap.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_L2);
  const l2IdSetFinal = new Set(l2Sorted.map((n) => n.id));

  const truncated = l1Ids.size > MAX_L1 || l2IdSet.size > MAX_L2;

  // ── Layout: simple circular placement ─────────────────────────────────────
  const cx = width / 2;
  const cy = height / 2;

  const nodePosMap = new Map<string, NodePos>();

  // Focal node at center
  nodePosMap.set(focalNode.id, {
    id: focalNode.id,
    label: focalNode.label,
    x: cx,
    y: cy,
    r: 10,
    color: "#ffffff",
    level: 0,
    weight: focalNode.weight,
  });

  // L1 in a circle
  const l1R = Math.min(width, height) * 0.28;
  l1Sorted.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / l1Sorted.length - Math.PI / 2;
    nodePosMap.set(node.id, {
      id: node.id,
      label: node.label,
      x: cx + l1R * Math.cos(angle),
      y: cy + l1R * Math.sin(angle),
      r: 5 + node.weight * 10,
      color: "#00d4f5",
      level: 1,
      weight: node.weight,
    });
  });

  // L2 in outer ring, grouped around parent L1
  const l2R = Math.min(width, height) * 0.46;
  // Group L2 nodes by their L1 parent
  const l2ByParent = new Map<string, string[]>();
  for (const l2Node of l2Sorted) {
    const parentEdges = edgesByNode.get(l2Node.id) ?? [];
    for (const e of parentEdges) {
      const other = e.source === l2Node.id ? e.target : e.source;
      if (l1IdSet.has(other)) {
        if (!l2ByParent.has(other)) l2ByParent.set(other, []);
        l2ByParent.get(other)!.push(l2Node.id);
        break; // associate with first found L1 parent
      }
    }
  }

  // For each L1 parent, spread its L2 children around it angularly
  l1Sorted.forEach((l1Node, l1Idx) => {
    const parentAngle = (2 * Math.PI * l1Idx) / l1Sorted.length - Math.PI / 2;
    const children = l2ByParent.get(l1Node.id) ?? [];
    const spread = Math.min((Math.PI * 0.6) / l1Sorted.length, Math.PI / 6);
    children.forEach((childId, j) => {
      const childNode = nodeMap.get(childId);
      if (!childNode || !l2IdSetFinal.has(childId)) return;
      const offset =
        children.length === 1
          ? 0
          : ((j / (children.length - 1)) * 2 - 1) * spread;
      const angle = parentAngle + offset;
      nodePosMap.set(childId, {
        id: childId,
        label: childNode.label,
        x: cx + l2R * Math.cos(angle),
        y: cy + l2R * Math.sin(angle),
        r: 3 + childNode.weight * 7,
        color: "#a855f7",
        level: 2,
        weight: childNode.weight,
      });
    });
  });

  // ── Build edge list ──────────────────────────────────────────────────────
  const relevantNodeIds = new Set([
    focalNode.id,
    ...l1Sorted.map((n) => n.id),
    ...l2Sorted.map((n) => n.id),
  ]);

  const edges: EdgePos[] = [];
  for (const edge of graph.edges) {
    if (!relevantNodeIds.has(edge.source) || !relevantNodeIds.has(edge.target))
      continue;
    const src = nodePosMap.get(edge.source);
    const tgt = nodePosMap.get(edge.target);
    if (!src || !tgt) continue;

    const isL1Edge =
      (edge.source === focalNode.id || edge.target === focalNode.id) &&
      (l1IdSet.has(edge.source) || l1IdSet.has(edge.target));

    const isL2Edge =
      (l1IdSet.has(edge.source) || l1IdSet.has(edge.target)) &&
      (l2IdSetFinal.has(edge.source) || l2IdSetFinal.has(edge.target));

    if (!isL1Edge && !isL2Edge) continue;

    edges.push({
      x1: src.x,
      y1: src.y,
      x2: tgt.x,
      y2: tgt.y,
      color: RELATION_COLORS[edge.relationType] ?? "#64748b",
      opacity: isL1Edge ? 0.7 : 0.3,
    });
  }

  return { nodePosMap, edges, truncated };
}

// ── Pan/Zoom state ──────────────────────────────────────────────────────────

interface Transform {
  tx: number; // translate X
  ty: number; // translate Y
  scale: number;
}

const DEFAULT_TRANSFORM: Transform = { tx: 0, ty: 0, scale: 1 };
const MIN_SCALE = 0.25;
const MAX_SCALE = 5;

interface MiniGraphProps {
  focalNode: GraphNode;
  graph: KnowledgeGraph;
  onNodeClick?: (nodeLabel: string) => void;
}

export function MiniGraph({ focalNode, graph, onNodeClick }: MiniGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 580, height: 320 });

  // Pan/zoom transform state
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);

  // Drag state (stored in refs to avoid re-renders during drag)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { nodePosMap, edges, truncated } = useMemo(
    () => buildSubGraph(focalNode, graph, size.width, size.height),
    [focalNode, graph, size],
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const nodes = useMemo(() => [...nodePosMap.values()], [nodePosMap]);

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    // Mouse position relative to SVG viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, prev.scale * delta),
      );
      // Keep the point under the cursor fixed
      const scaleRatio = newScale / prev.scale;
      const newTx = mouseX - scaleRatio * (mouseX - prev.tx);
      const newTy = mouseY - scaleRatio * (mouseY - prev.ty);
      return { tx: newTx, ty: newTy, scale: newScale };
    });
  }, []);

  // ── Drag to pan ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Only respond to primary button
      if (e.button !== 0) return;
      // Don't start panning if clicking a node (node has its own onClick)
      isDragging.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.tx,
        ty: transform.ty,
      };
      e.currentTarget.style.cursor = "grabbing";
    },
    [transform.tx, transform.ty],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTransform((prev) => ({
      ...prev,
      tx: dragStart.current.tx + dx,
      ty: dragStart.current.ty + dy,
    }));
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging.current) {
      isDragging.current = false;
      e.currentTarget.style.cursor = "grab";
    }
  }, []);

  // ── Double-click to reset ─────────────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM);
  }, []);

  // Compose SVG transform string
  const svgTransform = `translate(${transform.tx}, ${transform.ty}) scale(${transform.scale})`;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "320px",
        position: "relative",
        background: "rgba(0,0,0,0.4)",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Interaction hint bar */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "10px",
          fontSize: "9px",
          fontFamily: '"JetBrains Mono", monospace',
          color: "#334155",
          display: "flex",
          gap: "10px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <span>Колесо мыши — зум</span>
        <span>Тащи — перемещение</span>
        <span>2×клик — сброс</span>
      </div>

      {/* Reset button */}
      {(transform.tx !== 0 || transform.ty !== 0 || transform.scale !== 1) && (
        <button
          type="button"
          data-ocid="mini_graph.reset.button"
          onClick={() => setTransform(DEFAULT_TRANSFORM)}
          style={{
            position: "absolute",
            top: "8px",
            left: "10px",
            zIndex: 3,
            background: "rgba(0,212,245,0.12)",
            border: "1px solid rgba(0,212,245,0.3)",
            borderRadius: "5px",
            padding: "2px 8px",
            color: "#00d4f5",
            fontSize: "9px",
            fontFamily: '"JetBrains Mono", monospace',
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(0,212,245,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(0,212,245,0.12)";
          }}
        >
          Сброс вида
        </button>
      )}

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        style={{
          position: "absolute",
          inset: 0,
          cursor: "grab",
          display: "block",
        }}
        aria-label="Мини-граф окружения узла"
        role="img"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {/* All graph content lives inside this transformable group */}
        <g transform={svgTransform}>
          {/* Edges */}
          {edges.map((e, i) => (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: stable positional index
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.color}
              strokeOpacity={e.opacity}
              strokeWidth={1}
            />
          ))}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredId === node.id;
            const isFocal = node.level === 0;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: SVG node interaction in graph visualization
              <g
                key={node.id}
                style={{
                  cursor: !isFocal && onNodeClick ? "pointer" : "default",
                }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  // Only fire click when not finishing a drag
                  if (isDragging.current) return;
                  e.stopPropagation();
                  if (!isFocal && onNodeClick) onNodeClick(node.label);
                }}
              >
                {/* Glow for focal node */}
                {isFocal && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 8}
                    fill={FOCAL_LABEL_COLOR}
                    fillOpacity={0.08}
                  />
                )}
                {/* Glow for hovered */}
                {isHovered && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 5}
                    fill={isFocal ? FOCAL_LABEL_COLOR : node.color}
                    fillOpacity={0.18}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={isFocal ? FOCAL_LABEL_COLOR : node.color}
                  fillOpacity={
                    isFocal
                      ? 0.85
                      : isHovered
                        ? 0.9
                        : node.level === 1
                          ? 0.75
                          : 0.5
                  }
                  stroke={isFocal ? FOCAL_LABEL_COLOR : node.color}
                  strokeWidth={isFocal ? 2.5 : 1}
                  strokeOpacity={isFocal ? 1 : 0.8}
                />
              </g>
            );
          })}

          {/* Labels — only for focal + L1, and hovered L2 */}
          {nodes.map((node) => {
            const show = node.level <= 1 || hoveredId === node.id;
            if (!show) return null;

            const isFocal = node.level === 0;
            const maxLabelLen = isFocal ? 20 : 15;
            const raw = node.label;
            const label =
              raw.length > maxLabelLen ? `${raw.slice(0, maxLabelLen)}…` : raw;

            // Determine offset direction from center
            const cx = size.width / 2;
            const cy = size.height / 2;
            const dx = node.x - cx;
            const dy = node.y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const offsetX = (dx / d) * (node.r + 6);
            const offsetY = (dy / d) * (node.r + 6);

            return (
              <text
                key={`label-${node.id}`}
                x={node.x + offsetX}
                y={node.y + offsetY}
                textAnchor={dx > 5 ? "start" : dx < -5 ? "end" : "middle"}
                dominantBaseline={
                  dy > 5 ? "hanging" : dy < -5 ? "auto" : "middle"
                }
                fill={isFocal ? FOCAL_LABEL_COLOR : node.color}
                fontSize={isFocal ? 13 : 9}
                fontWeight={isFocal ? 800 : 400}
                fontFamily='"JetBrains Mono", monospace'
                style={{ pointerEvents: "none", userSelect: "none" }}
                opacity={isFocal ? 1 : 0.85}
              >
                {isFocal ? `★ ${label}` : label}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "10px",
          display: "flex",
          gap: "12px",
          fontSize: "9px",
          fontFamily: '"JetBrains Mono", monospace',
          color: "#475569",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <span>
          <span style={{ color: FOCAL_LABEL_COLOR }}>●</span> Центральный
        </span>
        <span>
          <span style={{ color: "#00d4f5" }}>●</span> Уровень 1
        </span>
        <span>
          <span style={{ color: "#a855f7" }}>●</span> Уровень 2
        </span>
        {truncated && (
          <span style={{ color: "#f59e0b" }}>⚠ показан частичный граф</span>
        )}
      </div>
    </div>
  );
}
