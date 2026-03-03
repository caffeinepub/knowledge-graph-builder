import { ScrollArea } from "@/components/ui/scroll-area";
import type React from "react";
import { useMemo, useState } from "react";
import type { OntologyEntry, RelationType } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface OntologyPanelProps {
  ontology: OntologyEntry[];
}

const RELATION_COLORS: Record<RelationType, string> = {
  association: "oklch(0.82 0.19 195)",
  "co-occurrence": "oklch(0.65 0.22 300)",
  hierarchical: "oklch(0.78 0.19 75)",
  functional: "oklch(0.72 0.2 145)",
};

const RELATION_LABELS: Record<RelationType, string> = {
  association: "ассоциация",
  "co-occurrence": "совместная встречаемость",
  hierarchical: "иерархическая",
  functional: "функциональная",
};

const RELATION_TOOLTIPS: Record<RelationType, React.ReactNode> = {
  association: (
    <div className="space-y-1">
      <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
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
      <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
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
      <p className="font-semibold" style={{ color: "oklch(0.78 0.19 75)" }}>
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
      <p className="font-semibold" style={{ color: "oklch(0.72 0.2 145)" }}>
        Функциональная
      </p>
      <p>
        Один термин модифицирует, уточняет или функционально дополняет другой.
        Отношение «используется для» или «влияет на».
      </p>
    </div>
  ),
};

const _PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Онтология
    </p>
    <p>
      Формальное представление знаний: типизированные связи между сущностями с
      оценкой уверенности.
    </p>
    <ul className="space-y-0.5 list-none">
      <li>
        <span style={{ color: "oklch(0.82 0.19 195)" }}>Сущность 1/2</span> —
        связанные термины
      </li>
      <li>
        <span style={{ color: "oklch(0.78 0.19 75)" }}>Тип связи</span> —
        семантический тип отношения
      </li>
      <li>
        <span style={{ color: "oklch(0.65 0.22 300)" }}>Уверенность</span> —
        достоверность классификации (0–100%)
      </li>
    </ul>
    <p className="text-muted-foreground">
      Используйте фильтры для изучения конкретных типов отношений.
    </p>
  </div>
);

const CONFIDENCE_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Уверенность
    </p>
    <p>
      Степень достоверности классификации типа связи (0–100%). Высокое значение
      означает, что алгоритм уверен в правильности определённого типа отношения.
    </p>
    <ul className="space-y-0.5 list-none mt-1">
      <li>
        <span style={{ color: "oklch(0.72 0.2 145)" }}>&gt;70%</span> — высокая
        уверенность
      </li>
      <li>
        <span style={{ color: "oklch(0.78 0.19 75)" }}>40–70%</span> — средняя
        уверенность
      </li>
      <li className="text-muted-foreground">&lt;40% — низкая уверенность</li>
    </ul>
  </div>
);

const FILTER_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Фильтр по типу связи
    </p>
    <p>
      Отображает только онтологические записи с выбранным типом отношения. «Все»
      — показывает все записи без фильтрации.
    </p>
  </div>
);

export function OntologyPanel({ ontology }: OntologyPanelProps) {
  const [filterType, setFilterType] = useState<RelationType | "all">("all");

  const filtered = useMemo(() => {
    return filterType === "all"
      ? ontology
      : ontology.filter((e) => e.relationType === filterType);
  }, [ontology, filterType]);

  const relationTypes: RelationType[] = [
    "association",
    "co-occurrence",
    "hierarchical",
    "functional",
  ];

  if (ontology.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет онтологии. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterType === "all" ? "border-foreground/40 text-foreground" : "border-kg-border text-muted-foreground hover:border-foreground/20"}`}
          >
            Все ({ontology.length})
          </button>
          <TooltipIcon content={FILTER_TOOLTIP} side="top" align="start" />
        </div>
        {relationTypes.map((rt) => (
          <div key={rt} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setFilterType(rt)}
              className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors ${filterType === rt ? "border-foreground/40 text-foreground" : "border-kg-border text-muted-foreground hover:border-foreground/20"}`}
            >
              {RELATION_LABELS[rt]}
            </button>
            <TooltipIcon
              content={RELATION_TOOLTIPS[rt]}
              side="top"
              align="start"
            />
          </div>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kg-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Сущность 1
                  <TooltipIcon
                    content={
                      <p>
                        Первая сущность в паре. Субъект онтологического
                        отношения.
                      </p>
                    }
                    side="top"
                    align="start"
                  />
                </div>
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Тип связи
                  <TooltipIcon
                    content={
                      <p>
                        Семантический тип отношения между двумя сущностями.
                        Определяет характер связи.
                      </p>
                    }
                    side="top"
                    align="start"
                  />
                </div>
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center gap-1">
                  Сущность 2
                  <TooltipIcon
                    content={
                      <p>
                        Вторая сущность в паре. Объект онтологического
                        отношения.
                      </p>
                    }
                    side="top"
                    align="start"
                  />
                </div>
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Уверенность
                  <TooltipIcon
                    content={CONFIDENCE_TOOLTIP}
                    side="top"
                    align="end"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={`${e.entityA}-${e.entityB}-${i}`}
                className="border-b border-kg-border/40 hover:bg-kg-panel/50 transition-colors"
              >
                <td className="py-1 px-2 text-foreground/90 max-w-[110px] truncate">
                  {e.entityA}
                </td>
                <td className="py-1 px-2">
                  <div className="flex items-center gap-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        color: RELATION_COLORS[e.relationType],
                        backgroundColor: `${RELATION_COLORS[e.relationType]}20`,
                      }}
                    >
                      {RELATION_LABELS[e.relationType]}
                    </span>
                    <TooltipIcon
                      content={RELATION_TOOLTIPS[e.relationType]}
                      side="top"
                      align="start"
                    />
                  </div>
                </td>
                <td className="py-1 px-2 text-foreground/90 max-w-[110px] truncate">
                  {e.entityB}
                </td>
                <td className="py-1 px-2 text-right">
                  <span
                    className="font-mono"
                    style={{
                      color:
                        e.confidence > 0.7
                          ? "oklch(0.72 0.2 145)"
                          : e.confidence > 0.4
                            ? "oklch(0.78 0.19 75)"
                            : "oklch(0.55 0.02 240)",
                    }}
                  >
                    {(e.confidence * 100).toFixed(0)}%
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
