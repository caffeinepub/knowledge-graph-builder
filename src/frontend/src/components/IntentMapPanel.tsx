import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { processText } from "../lib/textProcessor";
import type { IntentGroup, KnowledgeGraph } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface IntentMapPanelProps {
  intentGraphs: KnowledgeGraph[];
  intentGroups: IntentGroup[];
}

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Карта намерений (Intent Map)
    </p>
    <p>
      Тепловая матрица семантической схожести между всеми намерениями. Каждая
      ячейка показывает, насколько похожи два намерения по составу ключевых
      слов.
    </p>
    <ul className="space-y-0.5 list-none mt-1">
      <li>
        <span style={{ color: "oklch(0.65 0.22 300)" }}>100%</span> — полное
        совпадение (намерения дублируют друг друга)
      </li>
      <li>
        <span style={{ color: "oklch(0.55 0.02 240)" }}>0%</span> — нет общих
        слов (намерения полностью различны)
      </li>
    </ul>
    <p className="text-muted-foreground">
      Схожесть &gt;40% сигнализирует о возможной «каннибализации» — когда разные
      страницы сайта конкурируют за одни запросы.
    </p>
  </div>
);

const CANNIBALIZATION_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.78 0.19 75)" }}>
      Каннибализация намерений
    </p>
    <p>
      Пары намерений с высокой схожестью (&gt;40%) могут конкурировать между
      собой в поисковой выдаче. Это означает, что поисковик может не понять,
      какую страницу показывать по запросу.
    </p>
    <p className="text-muted-foreground">
      Решение: объединить похожие намерения в одну статью или чётко разграничить
      их тематику.
    </p>
  </div>
);

function getIntentLabel(group: IntentGroup, index: number): string {
  const top = [...group].sort((a, b) => b.frequency - a.frequency)[0];
  return top?.query ?? `Намерение ${index + 1}`;
}

function jaccardSimilarity(tokensA: Set<string>, tokensB: Set<string>): number {
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function IntentMapPanel({ intentGroups }: IntentMapPanelProps) {
  const labels = useMemo(
    () => intentGroups.map((g, i) => getIntentLabel(g, i)),
    [intentGroups],
  );

  const termSets = useMemo(
    () =>
      intentGroups.map(
        (group) => new Set(group.flatMap((entry) => processText(entry.query))),
      ),
    [intentGroups],
  );

  const matrix = useMemo(() => {
    const n = termSets.length;
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_x, j) => {
        if (i === j) return 1;
        return jaccardSimilarity(termSets[i], termSets[j]);
      }),
    );
  }, [termSets]);

  const cannibalizationPairs = useMemo(() => {
    const pairs: { a: string; b: string; similarity: number; key: string }[] =
      [];
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix[i].length; j++) {
        if (matrix[i][j] > 0.4) {
          pairs.push({
            a: labels[i],
            b: labels[j],
            similarity: matrix[i][j],
            key: `${i}-${j}`,
          });
        }
      }
    }
    return pairs.sort((a, b) => b.similarity - a.similarity);
  }, [matrix, labels]);

  if (intentGroups.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нужно минимум 2 намерения для карты интентов
      </div>
    );
  }

  const n = labels.length;

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          Карта схожести намерений ({n} × {n})
        </span>
        <TooltipIcon content={PANEL_TOOLTIP} side="top" align="start" />
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Heatmap matrix */}
          <div className="overflow-x-auto w-full">
            <table
              className="text-xs font-mono border-collapse"
              style={{ minWidth: "max-content" }}
            >
              <thead>
                <tr>
                  {/* Empty corner cell */}
                  <th
                    className="py-1 px-1 text-muted-foreground font-normal"
                    style={{ minWidth: "180px" }}
                  />
                  {labels.map((label) => (
                    <th
                      key={`col-${label}`}
                      className="py-1 px-1 text-muted-foreground font-normal text-center"
                      style={{ minWidth: "80px" }}
                    >
                      <div
                        className="text-center"
                        style={{
                          writingMode: "vertical-lr",
                          transform: "rotate(180deg)",
                          height: "90px",
                          fontSize: "10px",
                          whiteSpace: "nowrap",
                          overflow: "visible",
                        }}
                      >
                        {label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={`row-${labels[i]}`}>
                    <td
                      className="py-1 px-2 text-muted-foreground"
                      style={{
                        fontSize: "10px",
                        whiteSpace: "nowrap",
                        minWidth: "180px",
                      }}
                    >
                      {labels[i]}
                    </td>
                    {row.map((sim, j) => {
                      const colLabel = labels[j];
                      const isdiag = i === j;
                      return (
                        <td
                          key={`cell-${labels[i]}-${colLabel}`}
                          className="py-0.5 px-1 text-center"
                          style={{
                            backgroundColor: isdiag
                              ? "oklch(0.65 0.22 300 / 0.3)"
                              : `oklch(0.65 0.22 300 / ${sim * 0.7})`,
                            color:
                              sim > 0.5
                                ? "oklch(0.95 0.01 240)"
                                : "oklch(0.70 0.01 240)",
                            minWidth: "60px",
                          }}
                        >
                          {isdiag ? "—" : `${(sim * 100).toFixed(0)}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cannibalization pairs */}
          {cannibalizationPairs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: "oklch(0.78 0.19 75)" }}
                >
                  Возможная каннибализация ({cannibalizationPairs.length} пар)
                </span>
                <TooltipIcon
                  content={CANNIBALIZATION_TOOLTIP}
                  side="top"
                  align="start"
                />
              </div>
              <div className="space-y-1">
                {cannibalizationPairs.map((pair, i) => (
                  <div
                    key={pair.key}
                    data-ocid={`intent-map.item.${i + 1}`}
                    className="flex items-center gap-2 text-xs font-mono py-1 px-2 rounded border border-kg-border/40 bg-kg-panel/50"
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                      style={{
                        color:
                          pair.similarity > 0.6
                            ? "oklch(0.72 0.2 145)"
                            : "oklch(0.78 0.19 75)",
                        backgroundColor:
                          pair.similarity > 0.6
                            ? "oklch(0.72 0.2 145 / 0.15)"
                            : "oklch(0.78 0.19 75 / 0.15)",
                      }}
                    >
                      {(pair.similarity * 100).toFixed(0)}%
                    </span>
                    <span style={{ color: "oklch(0.92 0.01 240)" }}>
                      {pair.a}
                    </span>
                    <span className="text-muted-foreground">↔</span>
                    <span style={{ color: "oklch(0.92 0.01 240)" }}>
                      {pair.b}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cannibalizationPairs.length === 0 && (
            <p className="text-xs font-mono text-muted-foreground">
              Каннибализации не обнаружено (схожесть &lt;40% у всех пар)
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
