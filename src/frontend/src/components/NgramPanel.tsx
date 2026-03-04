import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { processText } from "../lib/textProcessor";
import type { IntentGroup } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface NgramPanelProps {
  intentGroups: IntentGroup[];
}

interface NgramEntry {
  text: string;
  frequency: number;
  count: number;
}

type NgramSize = 2 | 3;

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      N-граммы (биграммы и триграммы)
    </p>
    <p>
      Устойчивые словосочетания из 2 или 3 слов, встречающиеся в ваших запросах.
      Помогают выявить характерные фразы для темы.
    </p>
    <ul className="space-y-0.5 list-none mt-1">
      <li>
        <span style={{ color: "oklch(0.82 0.19 195)" }}>Биграммы</span> —
        словосочетания из 2 слов (напр. «купить квартиру»)
      </li>
      <li>
        <span style={{ color: "oklch(0.72 0.2 145)" }}>Триграммы</span> — фразы
        из 3 слов (напр. «купить квартиру Москва»)
      </li>
    </ul>
    <p className="text-muted-foreground">
      Используйте N-граммы как основу для подзаголовков (H2/H3) и LSI-слов в
      статье.
    </p>
  </div>
);

const FREQ_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.78 0.19 75)" }}>
      Суммарная частота
    </p>
    <p>
      Суммарная частота всех запросов, содержащих данный N-грамм. Отражает общий
      поисковый спрос по этой фразе.
    </p>
  </div>
);

const COUNT_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.65 0.22 300)" }}>
      Кол-во запросов
    </p>
    <p>
      Количество различных запросов из файла, которые содержат данный N-грамм.
      Высокое значение = N-грамм встречается во многих запросах.
    </p>
  </div>
);

function extractNgrams(
  intentGroups: IntentGroup[],
  n: NgramSize,
): NgramEntry[] {
  const ngramFreq = new Map<string, number>();
  const ngramCount = new Map<string, number>();

  for (const group of intentGroups) {
    for (const entry of group) {
      const tokens = processText(entry.query);
      if (tokens.length < n) continue;

      const seen = new Set<string>();
      for (let i = 0; i <= tokens.length - n; i++) {
        const gram = tokens.slice(i, i + n).join(" ");
        ngramFreq.set(gram, (ngramFreq.get(gram) ?? 0) + entry.frequency);
        if (!seen.has(gram)) {
          ngramCount.set(gram, (ngramCount.get(gram) ?? 0) + 1);
          seen.add(gram);
        }
      }
    }
  }

  return Array.from(ngramFreq.entries())
    .map(([text, frequency]) => ({
      text,
      frequency,
      count: ngramCount.get(text) ?? 0,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

export function NgramPanel({ intentGroups }: NgramPanelProps) {
  const [ngramSize, setNgramSize] = useState<NgramSize>(2);
  const [search, setSearch] = useState("");

  const allNgrams = useMemo(
    () => extractNgrams(intentGroups, ngramSize),
    [intentGroups, ngramSize],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allNgrams;
    const q = search.toLowerCase();
    return allNgrams.filter((g) => g.text.includes(q));
  }, [allNgrams, search]);

  const maxFreq = filtered[0]?.frequency ?? 1;

  if (intentGroups.length === 0 || intentGroups.flat().length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет данных. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setNgramSize(2)}
            data-ocid="ngrams.toggle"
            className={`text-xs font-mono px-2.5 py-0.5 rounded border transition-colors ${
              ngramSize === 2
                ? "border-kg-cyan/60"
                : "border-kg-border text-muted-foreground hover:border-kg-cyan/30"
            }`}
            style={
              ngramSize === 2
                ? {
                    color: "oklch(0.82 0.19 195)",
                    borderColor: "oklch(0.82 0.19 195 / 0.5)",
                  }
                : {}
            }
          >
            Биграммы
          </button>
          <button
            type="button"
            onClick={() => setNgramSize(3)}
            className={`text-xs font-mono px-2.5 py-0.5 rounded border transition-colors ${
              ngramSize === 3
                ? "border-kg-green/60"
                : "border-kg-border text-muted-foreground hover:border-kg-green/30"
            }`}
            style={
              ngramSize === 3
                ? {
                    color: "oklch(0.72 0.2 145)",
                    borderColor: "oklch(0.72 0.2 145 / 0.5)",
                  }
                : {}
            }
          >
            Триграммы
          </button>
          <TooltipIcon content={PANEL_TOOLTIP} side="top" align="start" />
        </div>

        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-ocid="ngrams.search_input"
          className="ml-auto text-xs font-mono px-2 py-0.5 rounded border border-kg-border bg-kg-panel focus:outline-none focus:border-kg-cyan/40 transition-colors"
          style={{ color: "oklch(0.92 0.01 240)", minWidth: "120px" }}
        />

        <span className="text-xs font-mono text-muted-foreground">
          {filtered.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kg-table-border">
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal w-6">
                #
              </th>
              <th className="text-left py-1.5 px-2 text-muted-foreground font-normal">
                N-грамм
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Частота
                  <TooltipIcon content={FREQ_TOOLTIP} side="top" align="end" />
                </div>
              </th>
              <th className="text-right py-1.5 px-2 text-muted-foreground font-normal">
                <div className="flex items-center justify-end gap-1">
                  Запросов
                  <TooltipIcon content={COUNT_TOOLTIP} side="top" align="end" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((gram, i) => (
              <tr
                key={gram.text}
                data-ocid={`ngrams.item.${i + 1}`}
                className="border-b border-kg-table-border hover:bg-kg-panel/50 transition-colors"
              >
                <td className="py-1 px-2 text-muted-foreground/60">{i + 1}</td>
                <td
                  className="py-1 px-2"
                  style={{ color: "oklch(0.92 0.01 240)" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1 rounded-full flex-shrink-0"
                      style={{
                        width: `${Math.max(4, (gram.frequency / maxFreq) * 60)}px`,
                        backgroundColor:
                          ngramSize === 2
                            ? "oklch(0.82 0.19 195 / 0.7)"
                            : "oklch(0.72 0.2 145 / 0.7)",
                      }}
                    />
                    {gram.text}
                  </div>
                </td>
                <td
                  className="py-1 px-2 text-right"
                  style={{ color: "oklch(0.78 0.19 75)" }}
                >
                  {gram.frequency.toLocaleString()}
                </td>
                <td className="py-1 px-2 text-right text-muted-foreground">
                  {gram.count}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-4 text-center text-muted-foreground"
                >
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
