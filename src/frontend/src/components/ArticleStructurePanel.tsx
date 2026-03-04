import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeGraph, TaxonomyNode } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface ArticleStructurePanelProps {
  graph: KnowledgeGraph | null;
  taxonomy: TaxonomyNode | null;
}

interface ArticleStructure {
  h1: string;
  h2sections: Array<{
    title: string;
    h3items: string[];
  }>;
  lsiWords: string[];
}

const PANEL_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.72 0.2 145)" }}>
      Структура статьи
    </p>
    <p>
      Автоматически генерируемый план статьи на основе таксономии графа знаний.
      Отражает иерархию понятий: от общего к частному.
    </p>
    <ul className="space-y-0.5 list-none mt-1">
      <li>
        <span style={{ color: "oklch(0.82 0.19 195)" }}>H1</span> — главный
        заголовок (топ-сущность по TF-IDF)
      </li>
      <li>
        <span style={{ color: "oklch(0.78 0.19 75)" }}>H2</span> — разделы
        (верхнеуровневые дочерние узлы таксономии)
      </li>
      <li>
        <span style={{ color: "oklch(0.65 0.22 300)" }}>H3</span> — подразделы
        (дочерние узлы каждого H2)
      </li>
      <li>
        <span style={{ color: "oklch(0.72 0.2 145)" }}>LSI-слова</span> —
        дополнительные термины для обогащения текста
      </li>
    </ul>
    <p className="text-muted-foreground">
      Используйте эту структуру как основу для написания SEO-оптимизированной
      статьи.
    </p>
  </div>
);

const LSI_TOOLTIP = (
  <div className="space-y-1.5">
    <p className="font-semibold" style={{ color: "oklch(0.72 0.2 145)" }}>
      LSI-слова (Latent Semantic Indexing)
    </p>
    <p>
      Семантически связанные термины, которые НЕ вошли в заголовки H1/H2/H3.
      Рекомендуется использовать их в тексте статьи для улучшения семантической
      полноты.
    </p>
    <p className="text-muted-foreground">
      Поисковые системы ожидают наличие таких слов в хорошо написанных статьях
      по теме. Включайте их естественно в текст.
    </p>
  </div>
);

const COPY_TOOLTIP = (
  <div className="space-y-1">
    <p className="font-semibold" style={{ color: "oklch(0.82 0.19 195)" }}>
      Скопировать в Markdown
    </p>
    <p>
      Копирует план статьи в буфер обмена в формате Markdown (H1, H2, H3,
      LSI-слова). Вставьте в любой редактор: Notion, Obsidian, VS Code и т.д.
    </p>
  </div>
);

function buildArticleStructure(
  graph: KnowledgeGraph,
  taxonomy: TaxonomyNode,
): ArticleStructure {
  // H1: graph label or top entity by tfidf
  const topByTfidf = [...graph.nodes].sort((a, b) => b.tfidf - a.tfidf)[0];
  const h1 =
    taxonomy.label !== "Knowledge Graph" && taxonomy.label !== "Root"
      ? taxonomy.label
      : (topByTfidf?.label ?? "Статья");

  // H2: root's direct children (taxonomy top level), up to 7
  const h2nodes = taxonomy.children.slice(0, 7);

  // H3: each H2's children, up to 4 per H2
  const h2sections = h2nodes.map((h2node) => ({
    title: h2node.label,
    h3items: h2node.children.slice(0, 4).map((h3) => h3.label),
  }));

  // LSI words: nodes NOT already in H1/H2/H3, top 20 by tfidf
  const usedLabels = new Set<string>([
    h1.toLowerCase(),
    ...h2sections.map((s) => s.title.toLowerCase()),
    ...h2sections.flatMap((s) => s.h3items.map((h) => h.toLowerCase())),
  ]);

  const lsiWords = [...graph.nodes]
    .sort((a, b) => b.tfidf - a.tfidf)
    .filter((n) => !usedLabels.has(n.label.toLowerCase()))
    .slice(0, 20)
    .map((n) => n.label);

  return { h1, h2sections, lsiWords };
}

function toMarkdown(structure: ArticleStructure): string {
  const lines: string[] = [`# ${structure.h1}`, ""];
  for (const section of structure.h2sections) {
    lines.push(`## ${section.title}`);
    for (const h3 of section.h3items) {
      lines.push(`### ${h3}`);
    }
    lines.push("");
  }
  if (structure.lsiWords.length > 0) {
    lines.push(`**LSI-слова:** ${structure.lsiWords.join(", ")}`);
  }
  return lines.join("\n");
}

export function ArticleStructurePanel({
  graph,
  taxonomy,
}: ArticleStructurePanelProps) {
  const [copied, setCopied] = useState(false);

  const structure = useMemo(() => {
    if (!graph || !taxonomy) return null;
    return buildArticleStructure(graph, taxonomy);
  }, [graph, taxonomy]);

  const handleCopy = async () => {
    if (!structure) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(structure));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (!graph || !taxonomy || !structure) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет данных. Загрузите файл и запустите анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-muted-foreground">
            Автоструктура статьи
          </span>
          <TooltipIcon content={PANEL_TOOLTIP} side="top" align="start" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            data-ocid="article.primary_button"
            className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border transition-all duration-150"
            style={
              copied
                ? {
                    color: "oklch(0.72 0.2 145)",
                    borderColor: "oklch(0.72 0.2 145 / 0.5)",
                    backgroundColor: "oklch(0.72 0.2 145 / 0.1)",
                  }
                : {
                    color: "oklch(0.82 0.19 195)",
                    borderColor: "oklch(0.82 0.19 195 / 0.4)",
                    backgroundColor: "oklch(0.82 0.19 195 / 0.05)",
                  }
            }
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Скопировано!" : "Скопировать MD"}
          </button>
          <TooltipIcon content={COPY_TOOLTIP} side="top" align="end" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 text-xs font-mono">
          {/* H1 */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                color: "oklch(0.82 0.19 195)",
                backgroundColor: "oklch(0.82 0.19 195 / 0.15)",
              }}
            >
              H1
            </span>
            <span
              className="font-semibold"
              style={{ color: "oklch(0.92 0.01 240)" }}
            >
              {structure.h1}
            </span>
          </div>

          {/* H2 + H3 sections */}
          {structure.h2sections.map((section) => (
            <div
              key={section.title}
              className="space-y-1 pl-2 border-l border-kg-border/40"
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    color: "oklch(0.78 0.19 75)",
                    backgroundColor: "oklch(0.78 0.19 75 / 0.15)",
                  }}
                >
                  H2
                </span>
                <span style={{ color: "oklch(0.88 0.01 240)" }}>
                  {section.title}
                </span>
              </div>
              {section.h3items.map((h3) => (
                <div key={h3} className="flex items-center gap-2 pl-4">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      color: "oklch(0.65 0.22 300)",
                      backgroundColor: "oklch(0.65 0.22 300 / 0.12)",
                    }}
                  >
                    H3
                  </span>
                  <span className="text-muted-foreground">{h3}</span>
                </div>
              ))}
            </div>
          ))}

          {structure.h2sections.length === 0 && (
            <p className="text-muted-foreground">
              Недостаточно данных для построения иерархии. Попробуйте добавить
              больше запросов.
            </p>
          )}

          {/* LSI Words */}
          {structure.lsiWords.length > 0 && (
            <div className="pt-2 border-t border-kg-border/40 space-y-1">
              <div className="flex items-center gap-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "oklch(0.72 0.2 145)" }}
                >
                  LSI-слова
                </span>
                <TooltipIcon content={LSI_TOOLTIP} side="top" align="start" />
              </div>
              <div className="flex flex-wrap gap-1">
                {structure.lsiWords.map((word) => (
                  <span
                    key={word}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      color: "oklch(0.72 0.2 145)",
                      backgroundColor: "oklch(0.72 0.2 145 / 0.1)",
                      border: "1px solid oklch(0.72 0.2 145 / 0.3)",
                    }}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
