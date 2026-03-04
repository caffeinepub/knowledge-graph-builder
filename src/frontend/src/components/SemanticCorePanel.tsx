import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import type { KnowledgeGraph } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface SemanticCorePanelProps {
  graph: KnowledgeGraph | null;
  intentGraphs: KnowledgeGraph[];
  mode: "global" | "intent";
}

interface ScoredTerm {
  label: string;
  score: number;
  tfidf: number;
  weight: number;
}

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Семантическое ядро
    </p>
    <p>
      Топ-термины, ранжированные по составному баллу (Score), который объединяет
      TF-IDF и нормализованный вес узла. Ядро отражает ключевые понятия темы.
    </p>
    <p className="text-muted-foreground">
      Используйте ядро для выбора главных ключевых слов при написании статьи —
      они должны войти в заголовок H1 и подзаголовки.
    </p>
  </div>
);

const SCORE_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Score (составной балл)
    </p>
    <p>
      Вычисляется по формуле:{" "}
      <span style={{ color: "oklch(0.78 0.19 75)" }}>
        Score = TF-IDF × ln(1 + Вес × 100)
      </span>
    </p>
    <p>
      Объединяет специфичность термина (TF-IDF) и его частотную значимость
      (вес). Термины с высоким Score — наиболее ценные для семантического ядра.
    </p>
  </div>
);

const TFIDF_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      TF-IDF
    </p>
    <p>
      Статистический вес термина. Высокое значение означает, что термин
      характерен именно для этой темы.
    </p>
  </div>
);

const WEIGHT_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.78 0.19 75)" }}>
      Вес (нормализованный)
    </p>
    <p>
      Нормализованная значимость узла в графе (0–1). Отражает частотный вклад
      термина в тему.
    </p>
  </div>
);

function computeCore(graph: KnowledgeGraph): ScoredTerm[] {
  return graph.nodes
    .map((n) => ({
      label: n.label,
      score: n.tfidf * Math.log1p(n.weight * 100),
      tfidf: n.tfidf,
      weight: n.weight,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

export function SemanticCorePanel({
  graph,
  intentGraphs,
  mode,
}: SemanticCorePanelProps) {
  const [selectedIntent, setSelectedIntent] = useState(0);

  const globalCore = useMemo(() => (graph ? computeCore(graph) : []), [graph]);

  const intentCores = useMemo(
    () => intentGraphs.map(computeCore),
    [intentGraphs],
  );

  const displayCore =
    mode === "global"
      ? globalCore
      : (intentCores[selectedIntent] ?? globalCore);

  const displayLabel =
    mode === "global"
      ? "Глобальное"
      : (intentGraphs[selectedIntent]?.label ??
        `Намерение ${selectedIntent + 1}`);

  const maxScore = displayCore[0]?.score ?? 1;

  if (!graph && intentGraphs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет данных. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            Семантическое ядро:
          </span>
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: "oklch(0.82 0.19 195)" }}
          >
            {displayLabel}
          </span>
          <TooltipIcon content={PANEL_TOOLTIP} side="top" align="start" />
        </div>

        {/* Intent selector */}
        {mode === "intent" && intentGraphs.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-auto">
            {intentGraphs.map((g, i) => (
              <button
                key={g.label || String(i)}
                type="button"
                onClick={() => setSelectedIntent(i)}
                className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${
                  selectedIntent === i
                    ? "border-kg-cyan/60"
                    : "border-kg-border text-muted-foreground hover:border-kg-cyan/30"
                }`}
                style={
                  selectedIntent === i
                    ? {
                        color: "oklch(0.82 0.19 195)",
                        borderColor: "oklch(0.82 0.19 195 / 0.5)",
                      }
                    : {}
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kg-table-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal w-6">
                #
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                Термин
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Score
                  <TooltipIcon content={SCORE_TOOLTIP} side="top" align="end" />
                </div>
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  TF-IDF
                  <TooltipIcon content={TFIDF_TOOLTIP} side="top" align="end" />
                </div>
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Вес
                  <TooltipIcon
                    content={WEIGHT_TOOLTIP}
                    side="top"
                    align="end"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayCore.map((term, i) => (
              <tr
                key={term.label}
                data-ocid={`semantic-core.item.${i + 1}`}
                className="border-b border-kg-table-border hover:bg-kg-panel/50 transition-colors"
              >
                <td className="py-1 px-2 text-muted-foreground/60">{i + 1}</td>
                <td
                  className="py-1 px-2 max-w-[200px] truncate"
                  style={{ color: "oklch(0.92 0.01 240)" }}
                >
                  {/* Score bar */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1 rounded-full flex-shrink-0"
                      style={{
                        width: `${Math.max(4, (term.score / maxScore) * 60)}px`,
                        backgroundColor:
                          i < 5
                            ? "oklch(0.82 0.19 195)"
                            : i < 15
                              ? "oklch(0.72 0.2 145)"
                              : "oklch(0.55 0.02 240 / 0.6)",
                      }}
                    />
                    <span>{term.label}</span>
                  </div>
                </td>
                <td
                  className="py-1 px-2 text-right"
                  style={{ color: "oklch(0.82 0.19 195)" }}
                >
                  {term.score.toFixed(3)}
                </td>
                <td className="py-1 px-2 text-right text-muted-foreground">
                  {term.tfidf.toFixed(4)}
                </td>
                <td className="py-1 px-2 text-right">
                  <span
                    style={{
                      color:
                        term.weight > 0.7
                          ? "oklch(0.72 0.2 145)"
                          : term.weight > 0.4
                            ? "oklch(0.78 0.19 75)"
                            : "oklch(0.55 0.02 240)",
                    }}
                  >
                    {term.weight.toFixed(3)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
