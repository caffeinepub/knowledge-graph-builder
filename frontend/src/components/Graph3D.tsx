import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { KnowledgeGraph, GraphNode, GraphEdge, RelationType } from '../types';
import { TooltipIcon } from './TooltipIcon';

// Color mapping for relation types (literal values for Three.js)
const RELATION_COLORS: Record<RelationType, string> = {
  'association': '#00d4f5',
  'co-occurrence': '#a855f7',
  'hierarchical': '#f59e0b',
  'functional': '#22c55e',
};

const RELATION_LABELS: Record<RelationType, string> = {
  'association': 'ассоциация',
  'co-occurrence': 'совместная встречаемость',
  'hierarchical': 'иерархическая',
  'functional': 'функциональная',
};

const RELATION_TOOLTIPS: Record<RelationType, React.ReactNode> = {
  'association': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: '#00d4f5' }}>Ассоциация</p>
      <p>Высокая совместная встречаемость и схожие TF-IDF значения. Термины тематически близки и относятся к одной предметной области.</p>
    </div>
  ),
  'co-occurrence': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: '#a855f7' }}>Совместная встречаемость</p>
      <p>Термины часто появляются вместе в пределах одного контекстного окна. Статистическая связь без явной семантики.</p>
    </div>
  ),
  'hierarchical': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: '#f59e0b' }}>Иерархическая</p>
      <p>Один термин является подтипом, категорией или обобщением другого. Отношение «является частью» или «является видом».</p>
    </div>
  ),
  'functional': (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: '#22c55e' }}>Функциональная</p>
      <p>Один термин модифицирует, уточняет или функционально дополняет другой. Отношение «используется для» или «влияет на».</p>
    </div>
  ),
};

const NODE_COLOR_HIGH = '#00d4f5';
const NODE_COLOR_LOW = '#1e3a5f';

interface NodeMeshProps {
  node: GraphNode;
  isSelected: boolean;
  isNeighbor: boolean;
  isHighlighted: boolean;
  onClick: (id: string) => void;
  onHover: (node: GraphNode | null) => void;
}

function NodeMesh({ node, isSelected, isNeighbor, isHighlighted, onClick, onHover }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const radius = 0.15 + node.weight * 0.55;
  const opacity = isHighlighted || isSelected || isNeighbor ? 1 : 0.25;

  const color = useMemo(() => {
    if (isSelected) return '#ffffff';
    if (isNeighbor) return '#f59e0b';
    if (hovered) return '#7dd3fc';
    return new THREE.Color(NODE_COLOR_LOW).lerp(new THREE.Color(NODE_COLOR_HIGH), Math.min(node.tfidf * 8, 1));
  }, [isSelected, isNeighbor, hovered, node.tfidf]);

  useFrame((_, delta) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(node); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); onHover(null); document.body.style.cursor = 'default'; }}
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
      {(hovered || isSelected) && (
        <Html distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(10,10,20,0.92)',
              border: '1px solid rgba(0,212,245,0.4)',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '11px',
              fontFamily: '"JetBrains Mono", monospace',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 0 12px rgba(0,212,245,0.2)',
            }}
          >
            <div style={{ color: '#00d4f5', fontWeight: 600 }}>{node.label}</div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>
              TF-IDF: {node.tfidf.toFixed(5)}
            </div>
            <div style={{ color: '#94a3b8' }}>
              Вес: {node.weight.toFixed(3)}
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

function EdgeLine({ edge, sourceNode, targetNode, isHighlighted, anySelected }: EdgeLineProps) {
  const lineRef = useRef<THREE.Line>(null);

  const color = RELATION_COLORS[edge.relationType];
  const opacity = anySelected ? (isHighlighted ? 0.9 : 0.05) : 0.35 + edge.weight * 0.4;

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
      new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [sourceNode.x, sourceNode.y, sourceNode.z, targetNode.x, targetNode.y, targetNode.z]);

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
}

function Scene({ graph }: SceneProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        .filter(e => e.source === selectedId || e.target === selectedId)
        .map(e => e.id)
    );
  }, [selectedId, graph.edges]);

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const anySelected = selectedId !== null;

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[20, 20, 20]} intensity={1.2} color="#00d4f5" />
      <pointLight position={[-20, -10, -20]} intensity={0.6} color="#f59e0b" />
      <pointLight position={[0, -20, 10]} intensity={0.4} color="#a855f7" />

      {graph.edges.map(edge => {
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

      {graph.nodes.map(node => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={selectedId === node.id}
          isNeighbor={neighborIds.has(node.id)}
          isHighlighted={!anySelected || selectedId === node.id || neighborIds.has(node.id)}
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
}

const GRAPH_INTERACTION_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: '#00d4f5' }}>Управление 3D-графом</p>
    <ul className="space-y-0.5 list-none">
      <li><span style={{ color: '#00d4f5' }}>Вращение</span> — зажмите левую кнопку мыши и перетащите</li>
      <li><span style={{ color: '#f59e0b' }}>Масштаб</span> — прокрутите колесо мыши</li>
      <li><span style={{ color: '#a855f7' }}>Перемещение</span> — зажмите правую кнопку мыши и перетащите</li>
      <li><span style={{ color: '#22c55e' }}>Клик по узлу</span> — выделяет узел и его соседей, подсвечивает связанные рёбра</li>
    </ul>
    <p className="text-muted-foreground">Размер узла отражает его вес (значимость). Наведите курсор на узел для просмотра TF-IDF и веса.</p>
  </div>
);

export function Graph3D({ graph }: Graph3DProps) {
  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
          <div
            className="w-16 h-16 rounded-full border flex items-center justify-center animate-pulse-glow"
            style={{ borderColor: 'oklch(0.82 0.19 195 / 0.3)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="8" cy="8" r="3" fill="#00d4f5" opacity="0.8" />
              <circle cx="24" cy="8" r="3" fill="#f59e0b" opacity="0.8" />
              <circle cx="16" cy="24" r="3" fill="#a855f7" opacity="0.8" />
              <line x1="8" y1="8" x2="24" y2="8" stroke="#00d4f5" strokeOpacity="0.4" strokeWidth="1" />
              <line x1="8" y1="8" x2="16" y2="24" stroke="#f59e0b" strokeOpacity="0.4" strokeWidth="1" />
              <line x1="24" y1="8" x2="16" y2="24" stroke="#a855f7" strokeOpacity="0.4" strokeWidth="1" />
            </svg>
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            Загрузите файл .xlsx и нажмите{' '}
            <span style={{ color: 'oklch(0.82 0.19 195)' }}>Анализировать</span>{' '}
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
        <TooltipIcon content={GRAPH_INTERACTION_TOOLTIP} side="left" align="start" />
      </div>

      <Canvas
        camera={{ position: [0, 0, 35], fov: 60, near: 0.1, far: 1000 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene graph={graph} />
      </Canvas>
    </div>
  );
}
