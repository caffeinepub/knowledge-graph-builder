import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeGraph } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface EntitiesPanelProps {
  graph: KnowledgeGraph | null;
}

type SortKey = "label" | "tfidf" | "weight" | "group";
type SortDir = "asc" | "desc";

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Сущности графа
    </p>
    <p>
      Полный список всех узлов (сущностей) графа знаний с их характеристиками.
      Каждая сущность — это ключевой термин, извлечённый из ваших запросов.
    </p>
    <p className="text-muted-foreground">
      Кликните на заголовок колонки для сортировки. Сущности с высоким TF-IDF и
      весом — наиболее значимые термины для темы.
    </p>
  </div>
);

const TFIDF_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      TF-IDF
    </p>
    <p>
      Term Frequency–Inverse Document Frequency. Статистический показатель,
      отражающий важность термина в контексте всего набора запросов.
    </p>
    <ul className="space-y-0.5 list-none mt-1">
      <li>
        <span style={{ color: "oklch(0.72 0.2 145)" }}>Высокий TF-IDF</span> —
        термин часто встречается в данном интенте, но редко в других
      </li>
      <li>
        <span style={{ color: "oklch(0.55 0.02 240)" }}>Низкий TF-IDF</span> —
        термин широко распространён и менее специфичен
      </li>
    </ul>
  </div>
);

const WEIGHT_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.78 0.19 75)" }}>
      Вес (нормализованный)
    </p>
    <p>
      Нормализованный вес узла в графе (0–100%). Рассчитывается на основе
      частоты запроса и связей с другими узлами.
    </p>
    <p className="text-muted-foreground">
      Узлы с высоким весом — смысловые «ядра» темы, вокруг которых
      концентрируются остальные запросы.
    </p>
  </div>
);

const GROUP_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Группа
    </p>
    <p>
      Источник сущности: «global» — из глобального графа, «intent-N» — из
      конкретного намерения N.
    </p>
  </div>
);

export function EntitiesPanel({ graph }: EntitiesPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!graph) return [];
    return [...graph.nodes].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "label") cmp = a.label.localeCompare(b.label);
      else if (sortKey === "tfidf") cmp = a.tfidf - b.tfidf;
      else if (sortKey === "weight") cmp = a.weight - b.weight;
      else if (sortKey === "group") cmp = a.group.localeCompare(b.group);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [graph, sortKey, sortDir]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет сущностей. Загрузите файл и запустите анализ.
      </div>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 opacity-60">
      {sortKey === col ? (
        sortDir === "desc" ? (
          "↓"
        ) : (
          "↑"
        )
      ) : (
        <ArrowUpDown className="inline w-2.5 h-2.5 opacity-40" />
      )}
    </span>
  );

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            Всего сущностей:
          </span>
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: "oklch(0.82 0.19 195)" }}
          >
            {graph.nodes.length}
          </span>
        </div>
        <TooltipIcon content={PANEL_TOOLTIP} side="top" align="start" />
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kg-table-border">
              <th
                className="text-left py-1.5 px-2 text-muted-foreground font-normal cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("label")}
                onKeyDown={(e) => e.key === "Enter" && handleSort("label")}
              >
                <div className="flex items-center gap-1">
                  Термин
                  <SortIcon col="label" />
                </div>
              </th>
              <th
                className="text-right py-1.5 px-2 text-muted-foreground font-normal cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("tfidf")}
                onKeyDown={(e) => e.key === "Enter" && handleSort("tfidf")}
              >
                <div className="flex items-center justify-end gap-1">
                  TF-IDF
                  <SortIcon col="tfidf" />
                  <TooltipIcon content={TFIDF_TOOLTIP} side="top" align="end" />
                </div>
              </th>
              <th
                className="text-right py-1.5 px-2 text-muted-foreground font-normal cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("weight")}
                onKeyDown={(e) => e.key === "Enter" && handleSort("weight")}
              >
                <div className="flex items-center justify-end gap-1">
                  Вес
                  <SortIcon col="weight" />
                  <TooltipIcon
                    content={WEIGHT_TOOLTIP}
                    side="top"
                    align="end"
                  />
                </div>
              </th>
              <th
                className="text-left py-1.5 px-2 text-muted-foreground font-normal cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort("group")}
                onKeyDown={(e) => e.key === "Enter" && handleSort("group")}
              >
                <div className="flex items-center gap-1">
                  Группа
                  <SortIcon col="group" />
                  <TooltipIcon
                    content={GROUP_TOOLTIP}
                    side="top"
                    align="start"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((node, i) => (
              <tr
                key={node.id}
                data-ocid={`entities.item.${i + 1}`}
                className="border-b border-kg-table-border hover:bg-kg-panel/50 transition-colors"
              >
                <td
                  className="py-1 px-2 max-w-[200px] truncate"
                  style={{ color: "oklch(0.92 0.01 240)" }}
                >
                  {node.label}
                </td>
                <td
                  className="py-1 px-2 text-right font-mono"
                  style={{ color: "oklch(0.82 0.19 195)" }}
                >
                  {node.tfidf.toFixed(4)}
                </td>
                <td className="py-1 px-2 text-right">
                  <span
                    className="font-mono"
                    style={{
                      color:
                        node.weight > 0.7
                          ? "oklch(0.72 0.2 145)"
                          : node.weight > 0.4
                            ? "oklch(0.78 0.19 75)"
                            : "oklch(0.55 0.02 240)",
                    }}
                  >
                    {(node.weight * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-1 px-2 text-muted-foreground truncate max-w-[80px]">
                  {node.group}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
