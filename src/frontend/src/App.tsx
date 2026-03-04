import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

import { ArticleStructurePanel } from "./components/ArticleStructurePanel";
import { EntitiesPanel } from "./components/EntitiesPanel";
import { ExportButtons } from "./components/ExportButtons";
import { FileUpload } from "./components/FileUpload";
import { Graph3D } from "./components/Graph3D";
import { GraphSelector } from "./components/GraphSelector";
import { IntentAnalysisPanel } from "./components/IntentAnalysisPanel";
import { IntentMapPanel } from "./components/IntentMapPanel";
import { ModeSelector } from "./components/ModeSelector";
import { NgramPanel } from "./components/NgramPanel";
import { OntologyPanel } from "./components/OntologyPanel";
import { SemanticCorePanel } from "./components/SemanticCorePanel";
import { TaxonomyPanel } from "./components/TaxonomyPanel";
import { TooltipIcon } from "./components/TooltipIcon";
import { TripletsPanel } from "./components/TripletsPanel";

import type {
  AnalysisMode,
  IntentGroup,
  KnowledgeGraph,
  OntologyEntry,
  TaxonomyNode,
  Triplet,
} from "./types";

import { buildKnowledgeGraph, buildMetaGraph } from "./lib/knowledgeGraph";
import {
  buildCoOccurrenceMatrix,
  computeTFIDF,
  extractEntityCandidates,
  extractRelationCandidates,
} from "./lib/nlpEngine";
import { buildOntology } from "./lib/ontology";
import { buildTaxonomy } from "./lib/taxonomy";
import { extractTriplets } from "./lib/triplets";

function runAnalysis(
  intentGroups: IntentGroup[],
  mode: AnalysisMode,
): {
  graph: KnowledgeGraph;
  triplets: Triplet[];
  taxonomy: TaxonomyNode;
  ontology: OntologyEntry[];
  intentGraphs: KnowledgeGraph[];
  metaGraph: KnowledgeGraph | null;
} {
  if (mode === "global") {
    const allQueries = intentGroups.flat();
    const tfidfMap = computeTFIDF(allQueries);
    const coOccurrence = buildCoOccurrenceMatrix(allQueries, 4);
    const entities = extractEntityCandidates(tfidfMap, 60);
    const relations = extractRelationCandidates(coOccurrence, entities);
    const graph = buildKnowledgeGraph(entities, relations, tfidfMap, "global");
    const triplets = extractTriplets(graph);
    const taxonomy = buildTaxonomy(graph);
    const ontology = buildOntology(graph, triplets);
    return {
      graph,
      triplets,
      taxonomy,
      ontology,
      intentGraphs: [],
      metaGraph: null,
    };
  }
  const intentGraphs: KnowledgeGraph[] = intentGroups.map((group, i) => {
    const tfidfMap = computeTFIDF(group);
    const coOccurrence = buildCoOccurrenceMatrix(group, 4);
    const entities = extractEntityCandidates(tfidfMap, 40);
    const relations = extractRelationCandidates(coOccurrence, entities);
    return buildKnowledgeGraph(
      entities,
      relations,
      tfidfMap,
      `intent-${i}`,
      80,
    );
  });

  const intentLabels = intentGroups.map((g, i) => {
    const topQuery =
      [...g].sort((a, b) => b.frequency - a.frequency)[0]?.query ??
      `Намерение ${i + 1}`;
    return topQuery.length > 20 ? `${topQuery.slice(0, 20)}…` : topQuery;
  });

  const metaGraph = buildMetaGraph(intentGraphs, intentLabels);

  const allQueries = intentGroups.flat();
  const globalTfidf = computeTFIDF(allQueries);
  const globalCoOcc = buildCoOccurrenceMatrix(allQueries, 4);
  const globalEntities = extractEntityCandidates(globalTfidf, 60);
  const globalRelations = extractRelationCandidates(
    globalCoOcc,
    globalEntities,
  );
  const globalGraph = buildKnowledgeGraph(
    globalEntities,
    globalRelations,
    globalTfidf,
    "global",
  );

  const triplets = extractTriplets(globalGraph);
  const taxonomy = buildTaxonomy(globalGraph);
  const ontology = buildOntology(globalGraph, triplets);

  return {
    graph: globalGraph,
    triplets,
    taxonomy,
    ontology,
    intentGraphs,
    metaGraph,
  };
}

const LEGEND_TOOLTIPS: Record<string, React.ReactNode> = {
  association: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#00d4f5" }}>
        Ассоциация
      </p>
      <p>
        Высокая совместная встречаемость и схожие TF-IDF значения. Термины
        тематически близки.
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
      </p>
    </div>
  ),
  hierarchical: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#f59e0b" }}>
        Иерархическая
      </p>
      <p>Один термин является подтипом, категорией или обобщением другого.</p>
    </div>
  ),
  functional: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "#22c55e" }}>
        Функциональная
      </p>
      <p>
        Один термин модифицирует, уточняет или функционально дополняет другой.
      </p>
    </div>
  ),
};

const MIN_FREQ_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Минимальная частота
    </p>
    <p>
      Минимальная частота запроса для включения в анализ и граф. Запросы с
      частотой ниже порога скрываются из всех вычислений.
    </p>
    <p className="text-muted-foreground">
      Используйте для фильтрации редких/нерелевантных запросов и фокусировки
      анализа на наиболее популярных темах.
    </p>
  </div>
);

export default function App() {
  const [intentGroups, setIntentGroups] = useState<IntentGroup[]>([]);
  const [mode, setMode] = useState<AnalysisMode>("global");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [minFreq, setMinFreq] = useState(0);

  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [triplets, setTriplets] = useState<Triplet[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyNode | null>(null);
  const [ontology, setOntology] = useState<OntologyEntry[]>([]);
  const [intentGraphs, setIntentGraphs] = useState<KnowledgeGraph[]>([]);
  const [metaGraph, setMetaGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedGraphIndex, setSelectedGraphIndex] = useState<number | "meta">(
    0,
  );

  const handleParsed = useCallback((groups: IntentGroup[]) => {
    setIntentGroups(groups);
    setHasAnalyzed(false);
    setGraph(null);
    setTriplets([]);
    setTaxonomy(null);
    setOntology([]);
    setIntentGraphs([]);
    setMetaGraph(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    if (intentGroups.length === 0) return;
    setIsAnalyzing(true);

    setTimeout(() => {
      try {
        // Apply minFreq filter before analysis
        const filteredGroups =
          minFreq > 0
            ? intentGroups
                .map((g) => g.filter((q) => q.frequency >= minFreq))
                .filter((g) => g.length > 0)
            : intentGroups;

        if (filteredGroups.length === 0) {
          setIsAnalyzing(false);
          return;
        }

        const result = runAnalysis(filteredGroups, mode);
        setGraph(result.graph);
        setTriplets(result.triplets);
        setTaxonomy(result.taxonomy);
        setOntology(result.ontology);
        setIntentGraphs(result.intentGraphs);
        setMetaGraph(result.metaGraph);
        setSelectedGraphIndex(result.intentGraphs.length > 0 ? "meta" : 0);
        setHasAnalyzed(true);
      } finally {
        setIsAnalyzing(false);
      }
    }, 50);
  }, [intentGroups, mode, minFreq]);

  const displayGraph = useMemo(() => {
    if (!hasAnalyzed) return null;
    if (mode === "global") return graph;
    if (selectedGraphIndex === "meta") return metaGraph;
    if (typeof selectedGraphIndex === "number")
      return intentGraphs[selectedGraphIndex] ?? null;
    return graph;
  }, [hasAnalyzed, mode, graph, metaGraph, intentGraphs, selectedGraphIndex]);

  const stats = useMemo(() => {
    if (!displayGraph) return null;
    return {
      nodes: displayGraph.nodes.length,
      edges: displayGraph.edges.length,
      triplets: triplets.length,
      ontology: ontology.length,
    };
  }, [displayGraph, triplets, ontology]);

  const appId =
    typeof window !== "undefined"
      ? encodeURIComponent(window.location.hostname)
      : "knowledge-graph-builder";

  return (
    <div className="flex flex-col h-screen bg-kg-dark overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-kg-border bg-kg-panel-dark">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full bg-kg-cyan animate-pulse-glow"
              style={{ backgroundColor: "oklch(0.82 0.19 195)" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-kg-amber"
              style={{ backgroundColor: "oklch(0.78 0.19 75)" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-kg-purple"
              style={{ backgroundColor: "oklch(0.65 0.22 300)" }}
            />
          </div>
          <h1
            className="text-sm font-mono font-semibold tracking-tight"
            style={{ color: "oklch(0.92 0.01 240)" }}
          >
            SEO Intent Nodes
          </h1>
          <Badge
            variant="outline"
            className="text-xs font-mono border-kg-border text-muted-foreground hidden sm:flex"
          >
            v1.0
          </Badge>
        </div>

        {stats && (
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <span>
              <span style={{ color: "oklch(0.82 0.19 195)" }}>
                {stats.nodes}
              </span>{" "}
              узлов
            </span>
            <span>
              <span style={{ color: "oklch(0.78 0.19 75)" }}>
                {stats.edges}
              </span>{" "}
              рёбер
            </span>
            <span>
              <span style={{ color: "oklch(0.65 0.22 300)" }}>
                {stats.triplets}
              </span>{" "}
              триплетов
            </span>
          </div>
        )}
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="flex-shrink-0 w-52 flex flex-col gap-4 p-3 border-r border-kg-border bg-kg-panel-dark overflow-y-auto">
          {/* File Upload */}
          <div className="space-y-1.5">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Источник данных
            </p>
            <FileUpload onParsed={handleParsed} />
          </div>

          <Separator className="bg-kg-border" />

          {/* Mode Selector */}
          <ModeSelector mode={mode} onChange={setMode} disabled={isAnalyzing} />

          {/* Analyze Button */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={intentGroups.length === 0 || isAnalyzing}
            data-ocid="analyze.primary_button"
            className={`
              w-full py-2 px-3 rounded text-xs font-mono font-semibold transition-all duration-200
              ${
                intentGroups.length > 0 && !isAnalyzing
                  ? "bg-kg-cyan/20 border border-kg-cyan/60 hover:bg-kg-cyan/30 hover:shadow-glow-cyan"
                  : "bg-kg-panel border border-kg-border opacity-40 cursor-not-allowed"
              }
            `}
            style={
              intentGroups.length > 0 && !isAnalyzing
                ? {
                    color: "oklch(0.82 0.19 195)",
                    borderColor: "oklch(0.82 0.19 195 / 0.6)",
                  }
                : {}
            }
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Анализ...
              </span>
            ) : (
              "⚡ Анализировать"
            )}
          </button>

          {/* Min Frequency Filter */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label
                htmlFor="min-freq-input"
                className="text-xs font-mono text-muted-foreground"
              >
                Мин. частота
              </label>
              <TooltipIcon
                content={MIN_FREQ_TOOLTIP}
                side="right"
                align="start"
              />
            </div>
            <input
              id="min-freq-input"
              type="number"
              min={0}
              step={1}
              value={minFreq}
              onChange={(e) => setMinFreq(Math.max(0, Number(e.target.value)))}
              data-ocid="filter.input"
              className="w-full text-xs font-mono px-2 py-1 rounded border border-kg-border bg-kg-panel focus:outline-none focus:border-kg-cyan/40 transition-colors"
              style={{ color: "oklch(0.92 0.01 240)" }}
            />
          </div>

          {/* Intent Graph Selector (only in intent mode) */}
          {mode === "intent" && intentGraphs.length > 0 && (
            <>
              <Separator className="bg-kg-border" />
              <GraphSelector
                intentGraphs={intentGraphs}
                selectedIndex={selectedGraphIndex}
                onChange={setSelectedGraphIndex}
                intentGroups={intentGroups}
              />
            </>
          )}

          <Separator className="bg-kg-border" />

          {/* Export Buttons */}
          <ExportButtons
            graph={graph}
            triplets={triplets}
            taxonomy={taxonomy}
            ontology={ontology}
            disabled={!hasAnalyzed}
          />

          {/* Legend */}
          {hasAnalyzed && (
            <>
              <Separator className="bg-kg-border" />
              <div className="space-y-1.5">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                  Легенда
                </p>
                <div className="space-y-1">
                  {[
                    {
                      color: "#00d4f5",
                      label: "ассоциация",
                      key: "association",
                    },
                    {
                      color: "#a855f7",
                      label: "совм. встречаемость",
                      key: "co-occurrence",
                    },
                    {
                      color: "#f59e0b",
                      label: "иерархическая",
                      key: "hierarchical",
                    },
                    {
                      color: "#22c55e",
                      label: "функциональная",
                      key: "functional",
                    },
                  ].map(({ color, label, key }) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono text-muted-foreground flex-1">
                        {label}
                      </span>
                      <TooltipIcon
                        content={LEGEND_TOOLTIPS[key]}
                        side="right"
                        align="start"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Central Canvas + Bottom Panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* 3D Graph Canvas */}
          <div className="flex-1 relative overflow-hidden bg-black">
            {/* Graph label */}
            {displayGraph && (
              <div className="absolute top-3 left-3 z-10">
                <span
                  className="text-xs font-mono px-2 py-1 rounded border"
                  style={{
                    backgroundColor: "oklch(0.14 0.008 255 / 0.8)",
                    borderColor: "oklch(0.25 0.015 255)",
                    color: "oklch(0.82 0.19 195)",
                  }}
                >
                  {displayGraph.label ?? "Граф знаний"}
                </span>
              </div>
            )}

            <div className="absolute inset-0 z-10">
              <Graph3D
                graph={displayGraph}
                fullGraph={graph}
                taxonomy={taxonomy}
                intentGroups={intentGroups}
              />
            </div>
          </div>

          {/* Bottom Data Panel */}
          <div
            className="flex-shrink-0 border-t border-kg-border bg-kg-panel-dark"
            style={{ height: "300px" }}
          >
            <Tabs defaultValue="triplets" className="h-full flex flex-col">
              <div className="flex-shrink-0 px-3 pt-2">
                <TabsList
                  className="bg-kg-panel border border-kg-border h-7 flex-nowrap overflow-x-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  <TabsTrigger
                    value="triplets"
                    data-ocid="tabs.tab"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.82_0.19_195)] data-[state=active]:bg-kg-cyan/20"
                  >
                    Триплеты
                    {triplets.length > 0 && (
                      <span className="ml-1 opacity-60">
                        ({triplets.length})
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="taxonomy"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.78_0.19_75)] data-[state=active]:bg-kg-amber/20"
                  >
                    Таксономия
                  </TabsTrigger>
                  <TabsTrigger
                    value="ontology"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.65_0.22_300)] data-[state=active]:bg-kg-purple/20"
                  >
                    Онтология
                    {ontology.length > 0 && (
                      <span className="ml-1 opacity-60">
                        ({ontology.length})
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="entities"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.82_0.19_195)] data-[state=active]:bg-kg-cyan/20"
                  >
                    Сущности
                    {graph && graph.nodes.length > 0 && (
                      <span className="ml-1 opacity-60">
                        ({graph.nodes.length})
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="semantic-core"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.72_0.2_145)] data-[state=active]:bg-kg-green/20"
                  >
                    Ядро
                  </TabsTrigger>
                  <TabsTrigger
                    value="ngrams"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.78_0.19_75)] data-[state=active]:bg-kg-amber/20"
                  >
                    N-граммы
                  </TabsTrigger>
                  <TabsTrigger
                    value="intent-map"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.65_0.22_300)] data-[state=active]:bg-kg-purple/20"
                  >
                    Карта интентов
                  </TabsTrigger>
                  <TabsTrigger
                    value="article"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.72_0.2_145)] data-[state=active]:bg-kg-green/20"
                  >
                    Структура статьи
                  </TabsTrigger>
                  <TabsTrigger
                    value="intent-analysis"
                    className="text-[10px] font-mono h-5 px-2 flex-shrink-0 data-[state=inactive]:text-[oklch(0.55_0.02_240)] data-[state=active]:text-[oklch(0.82_0.19_195)] data-[state=active]:bg-kg-cyan/20"
                  >
                    Анализ интентов
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="triplets"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <TripletsPanel triplets={triplets} />
              </TabsContent>
              <TabsContent
                value="taxonomy"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <TaxonomyPanel taxonomy={taxonomy} />
              </TabsContent>
              <TabsContent
                value="ontology"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <OntologyPanel ontology={ontology} />
              </TabsContent>
              <TabsContent
                value="entities"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <EntitiesPanel graph={graph} />
              </TabsContent>
              <TabsContent
                value="semantic-core"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <SemanticCorePanel
                  graph={graph}
                  intentGraphs={intentGraphs}
                  mode={mode}
                />
              </TabsContent>
              <TabsContent
                value="ngrams"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <NgramPanel intentGroups={intentGroups} />
              </TabsContent>
              <TabsContent
                value="intent-map"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <IntentMapPanel
                  intentGraphs={intentGraphs}
                  intentGroups={intentGroups}
                />
              </TabsContent>
              <TabsContent
                value="article"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <ArticleStructurePanel graph={graph} taxonomy={taxonomy} />
              </TabsContent>
              <TabsContent
                value="intent-analysis"
                className="flex-1 min-h-0 px-3 pb-2 mt-2 overflow-y-auto"
              >
                <IntentAnalysisPanel intentGroups={intentGroups} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-1.5 border-t border-kg-border bg-kg-panel-dark text-xs font-mono text-muted-foreground">
        <span>Built with</span>
        <Heart
          className="w-3 h-3 fill-current"
          style={{ color: "oklch(0.82 0.19 195)" }}
        />
        <span>using</span>
        <a
          href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${appId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: "oklch(0.82 0.19 195)" }}
        >
          caffeine.ai
        </a>
        <span className="mx-1 opacity-40">·</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
