/**
 * IntentAnalysisPanel.tsx
 *
 * Displays:
 * 1. Intent type classification (Informational / Navigational / Transactional / Commercial) per intent
 * 2. Cluster density metrics per intent
 * 3. Cannibalization analysis between intents (with shared tokens)
 */

import type React from "react";
import { useMemo } from "react";
import {
  type CannibalizationPair,
  type IntentAnalysis,
  type IntentType,
  analyzeIntents,
  detectCannibalization,
} from "../lib/intentClassifier";
import type { IntentGroup } from "../types";
import { TooltipIcon } from "./TooltipIcon";

interface IntentAnalysisPanelProps {
  intentGroups: IntentGroup[];
}

// ─── Colors & labels for intent types ────────────────────────────────────────

const INTENT_TYPE_COLORS: Record<IntentType, string> = {
  Informational: "#00d4f5",
  Navigational: "#a855f7",
  Transactional: "#f59e0b",
  Commercial: "#22c55e",
};

const INTENT_TYPE_ICONS: Record<IntentType, string> = {
  Informational: "ℹ️",
  Navigational: "🔍",
  Transactional: "🛒",
  Commercial: "⭐",
};

const _INTENT_TYPE_LABELS_RU: Record<IntentType, string> = {
  Informational: "Информационный",
  Navigational: "Навигационный",
  Transactional: "Транзакционный",
  Commercial: "Коммерческий",
};

const INTENT_TYPE_DESC: Record<IntentType, string> = {
  Informational:
    "Пользователь ищет информацию, объяснения, инструкции. Идеально для обучающих статей.",
  Navigational:
    "Пользователь ищет конкретный сайт, бренд или страницу. Сложнее продвигаться органически.",
  Transactional:
    "Пользователь готов совершить действие: купить, заказать, скачать. Высокая коммерческая ценность.",
  Commercial:
    "Пользователь выбирает между вариантами, изучает отзывы. Идеально для сравнительных материалов.",
};

const RISK_COLORS: Record<CannibalizationPair["risk"], string> = {
  Критичный: "#ef4444",
  Высокий: "#f59e0b",
  Умеренный: "#22c55e",
};

const DENSITY_COLORS: Record<string, string> = {
  Высокая: "#22c55e",
  Средняя: "#f59e0b",
  Низкая: "#ef4444",
};

// ─── Tooltips ─────────────────────────────────────────────────────────────────

const CLASSIFICATION_TOOLTIP = (
  <div className="space-y-2">
    <p className="font-semibold" style={{ color: "#00d4f5" }}>
      Классификация типа интента
    </p>
    <p>
      Каждый интент автоматически определяется по одному из четырёх SEO-типов на
      основе статистического анализа ключевых слов.
    </p>
    <ul className="space-y-1 list-none mt-1">
      <li>
        <span style={{ color: "#00d4f5" }}>Информационный</span> — пользователь
        хочет узнать что-то (как, почему, что такое)
      </li>
      <li>
        <span style={{ color: "#a855f7" }}>Навигационный</span> — ищет
        конкретный сайт/бренд
      </li>
      <li>
        <span style={{ color: "#f59e0b" }}>Транзакционный</span> — готов
        купить/заказать/скачать
      </li>
      <li>
        <span style={{ color: "#22c55e" }}>Коммерческий</span> — сравнивает и
        выбирает лучший вариант
      </li>
    </ul>
    <p className="text-muted-foreground">
      Уверенность показывает, насколько однозначно определён тип (чем выше — тем
      чище интент).
    </p>
  </div>
);

const DENSITY_TOOLTIP = (
  <div className="space-y-2">
    <p className="font-semibold" style={{ color: "#f59e0b" }}>
      Плотность кластера
    </p>
    <p>
      Оценка того, насколько «сфокусирован» интент: высокая плотность означает,
      что запросы группы тематически близки и хорошо описывают одну тему.
    </p>
    <ul className="space-y-1 list-none mt-1">
      <li>
        <span style={{ color: "#22c55e" }}>Высокая</span> — чёткий, узкий
        интент, хороший кандидат для отдельной статьи
      </li>
      <li>
        <span style={{ color: "#f59e0b" }}>Средняя</span> — умеренно
        сфокусированный интент
      </li>
      <li>
        <span style={{ color: "#ef4444" }}>Низкая</span> — широкий или размытый
        интент, возможно стоит разбить на несколько
      </li>
    </ul>
    <p className="text-muted-foreground">
      Score рассчитывается как среднее попарное сходство запросов (Jaccard)
      скомбинированное с лексическим разнообразием.
    </p>
  </div>
);

const CANNIBALIZATION_TOOLTIP = (
  <div className="space-y-2">
    <p className="font-semibold" style={{ color: "#ef4444" }}>
      Каннибализация интентов
    </p>
    <p>
      Пары интентов с высоким пересечением ключевых слов могут конкурировать
      между собой в поисковой выдаче. Поисковик не сможет понять, какую страницу
      показывать.
    </p>
    <ul className="space-y-1 list-none mt-1">
      <li>
        <span style={{ color: "#ef4444" }}>Критичный (&gt;60%)</span> — интенты
        практически дублируют друг друга, необходимо объединить или разграничить
      </li>
      <li>
        <span style={{ color: "#f59e0b" }}>Высокий (35-60%)</span> — высокий
        риск, стоит пересмотреть тематику
      </li>
      <li>
        <span style={{ color: "#22c55e" }}>Умеренный (15-35%)</span> — есть
        пересечения, но интенты достаточно различны
      </li>
    </ul>
  </div>
);

// ─── Helper: get top label for an intent group ─────────────────────────────

function getIntentLabel(group: IntentGroup, index: number): string {
  const top = [...group].sort((a, b) => b.frequency - a.frequency)[0];
  const raw = top?.query ?? `Намерение ${index + 1}`;
  return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IntentTypeBadge({ type }: { type: IntentType }) {
  const color = INTENT_TYPE_COLORS[type];
  return (
    <span
      style={{
        color,
        background: `${color}1a`,
        border: `1px solid ${color}44`,
        padding: "1px 8px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      {INTENT_TYPE_ICONS[type]} {type}
    </span>
  );
}

function ConfidenceBar({
  confidence,
  color,
}: {
  confidence: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          flex: 1,
          height: "4px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${confidence * 100}%`,
            height: "100%",
            background: color,
            borderRadius: "2px",
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ color: "#94a3b8", fontSize: "10px", minWidth: "32px" }}>
        {(confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IntentAnalysisPanel({
  intentGroups,
}: IntentAnalysisPanelProps) {
  const labels = useMemo(
    () => intentGroups.map((g, i) => getIntentLabel(g, i)),
    [intentGroups],
  );

  const analyses: IntentAnalysis[] = useMemo(
    () => analyzeIntents(intentGroups),
    [intentGroups],
  );

  const cannibalizationPairs = useMemo(
    () => detectCannibalization(intentGroups, labels, 0.15),
    [intentGroups, labels],
  );

  if (intentGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-mono">
        Нет данных для анализа. Загрузите файл и выполните анализ.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {/* ── Section 1: Classification ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="text-xs font-mono font-semibold uppercase tracking-widest"
            style={{ color: "#00d4f5" }}
          >
            Классификация интентов
          </span>
          <TooltipIcon
            content={CLASSIFICATION_TOOLTIP}
            side="top"
            align="start"
          />
        </div>
        <div className="flex flex-col gap-2">
          {analyses.map((analysis, i) => {
            const color = INTENT_TYPE_COLORS[analysis.classification.type];
            return (
              <div
                key={`intent-class-${labels[i]}`}
                data-ocid={`intent-analysis.classification.item.${i + 1}`}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderLeft: `3px solid ${color}`,
                  borderRadius: "6px",
                  padding: "10px 12px",
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#e2e8f0",
                        fontSize: "12px",
                        fontFamily: '"JetBrains Mono", monospace',
                        marginBottom: "2px",
                        wordBreak: "break-word",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>#{i + 1}</span>{" "}
                      {labels[i]}
                    </div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "10px",
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {INTENT_TYPE_DESC[analysis.classification.type]}
                    </div>
                  </div>
                  <IntentTypeBadge type={analysis.classification.type} />
                </div>

                {/* Confidence bar */}
                <ConfidenceBar
                  confidence={analysis.classification.confidence}
                  color={color}
                />

                {/* Score breakdown (mini) */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {(
                    Object.entries(analysis.classification.scores) as [
                      IntentType,
                      number,
                    ][]
                  ).map(([t, s]) => (
                    <span
                      key={t}
                      style={{
                        color:
                          t === analysis.classification.type
                            ? INTENT_TYPE_COLORS[t]
                            : "#475569",
                        fontSize: "9px",
                        fontFamily: '"JetBrains Mono", monospace',
                        fontWeight:
                          t === analysis.classification.type ? 700 : 400,
                      }}
                    >
                      {t}: {(s * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Cluster Density ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="text-xs font-mono font-semibold uppercase tracking-widest"
            style={{ color: "#f59e0b" }}
          >
            Плотность кластера
          </span>
          <TooltipIcon content={DENSITY_TOOLTIP} side="top" align="start" />
        </div>
        <div className="flex flex-col gap-1.5">
          {analyses.map((analysis, i) => {
            const d = analysis.density;
            const color = DENSITY_COLORS[d.densityLabel];
            return (
              <div
                key={`density-${labels[i]}`}
                data-ocid={`intent-analysis.density.item.${i + 1}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  background: "rgba(255,255,255,0.025)",
                  borderRadius: "5px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {/* Index */}
                <span
                  style={{
                    color: "#475569",
                    fontSize: "10px",
                    minWidth: "20px",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  #{i + 1}
                </span>

                {/* Label */}
                <span
                  style={{
                    color: "#94a3b8",
                    fontSize: "11px",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {labels[i]}
                </span>

                {/* Score bar */}
                <div
                  style={{
                    width: "64px",
                    height: "4px",
                    borderRadius: "2px",
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: `${d.densityScore * 100}%`,
                      height: "100%",
                      background: color,
                      borderRadius: "2px",
                    }}
                  />
                </div>

                {/* Score value */}
                <span
                  style={{
                    color,
                    fontSize: "11px",
                    fontWeight: 600,
                    minWidth: "36px",
                    textAlign: "right",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {(d.densityScore * 100).toFixed(0)}%
                </span>

                {/* Density label badge */}
                <span
                  style={{
                    color,
                    background: `${color}1a`,
                    border: `1px solid ${color}33`,
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontSize: "9px",
                    fontWeight: 600,
                    minWidth: "56px",
                    textAlign: "center",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {d.densityLabel}
                </span>

                {/* Extra stats: tokens, freq */}
                <span
                  style={{
                    color: "#475569",
                    fontSize: "9px",
                    whiteSpace: "nowrap",
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {d.uniqueTermCount}т /{" "}
                  {d.totalFrequency.toLocaleString("ru-RU")}f
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Cannibalization ── */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="text-xs font-mono font-semibold uppercase tracking-widest"
            style={{ color: "#ef4444" }}
          >
            Каннибализация интентов
            {cannibalizationPairs.length > 0 && (
              <span style={{ color: "#f59e0b", marginLeft: "6px" }}>
                ({cannibalizationPairs.length} пар)
              </span>
            )}
          </span>
          <TooltipIcon
            content={CANNIBALIZATION_TOOLTIP}
            side="top"
            align="start"
          />
        </div>

        {cannibalizationPairs.length === 0 ? (
          <div
            style={{
              color: "#22c55e",
              fontSize: "11px",
              fontFamily: '"JetBrains Mono", monospace',
              padding: "8px 10px",
              background: "rgba(34,197,94,0.05)",
              border: "1px solid rgba(34,197,94,0.15)",
              borderRadius: "6px",
            }}
          >
            ✓ Каннибализация не обнаружена (схожесть &lt;15% у всех пар)
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {cannibalizationPairs.map((pair, idx) => {
              const riskColor = RISK_COLORS[pair.risk];
              return (
                <div
                  key={`${pair.indexA}-${pair.indexB}`}
                  data-ocid={`intent-analysis.cannibalization.item.${idx + 1}`}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: `1px solid ${riskColor}33`,
                    borderLeft: `3px solid ${riskColor}`,
                    borderRadius: "6px",
                    padding: "10px 12px",
                  }}
                >
                  {/* Risk badge + similarity */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        color: riskColor,
                        background: `${riskColor}1a`,
                        border: `1px solid ${riskColor}44`,
                        padding: "1px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: 700,
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {pair.risk}
                    </span>
                    <span
                      style={{
                        color: riskColor,
                        fontSize: "14px",
                        fontWeight: 700,
                        fontFamily: '"JetBrains Mono", monospace',
                      }}
                    >
                      {(pair.similarity * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Pair labels */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: "#e2e8f0",
                        fontSize: "11px",
                        fontFamily: '"JetBrains Mono", monospace',
                        flex: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      #{pair.indexA + 1} {pair.labelA}
                    </span>
                    <span
                      style={{
                        color: "#475569",
                        fontSize: "12px",
                        flexShrink: 0,
                      }}
                    >
                      ↔
                    </span>
                    <span
                      style={{
                        color: "#e2e8f0",
                        fontSize: "11px",
                        fontFamily: '"JetBrains Mono", monospace',
                        flex: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      #{pair.indexB + 1} {pair.labelB}
                    </span>
                  </div>

                  {/* Shared tokens */}
                  {pair.sharedTokens.length > 0 && (
                    <div>
                      <div
                        style={{
                          color: "#475569",
                          fontSize: "9px",
                          fontFamily: '"JetBrains Mono", monospace',
                          marginBottom: "4px",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Общие термины ({pair.sharedTokens.length}):
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px",
                        }}
                      >
                        {pair.sharedTokens.map((token) => (
                          <span
                            key={token}
                            style={{
                              color: riskColor,
                              background: `${riskColor}0d`,
                              border: `1px solid ${riskColor}22`,
                              padding: "1px 6px",
                              borderRadius: "3px",
                              fontSize: "9px",
                              fontFamily: '"JetBrains Mono", monospace',
                            }}
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
