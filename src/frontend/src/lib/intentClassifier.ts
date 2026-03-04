/**
 * intentClassifier.ts
 *
 * Classifies each intent group into one of four SEO intent types:
 * - Informational  (что, как, почему, зачем, руководство, гайд, статья)
 * - Navigational   (бренд, официальный, сайт, войти, скачать, личный кабинет)
 * - Transactional  (купить, цена, заказать, стоимость, доставка, скидка, магазин)
 * - Commercial     (лучший, рейтинг, отзывы, сравнение, топ, обзор, vs, или)
 *
 * Also computes cluster density and overlap/cannibalization data.
 */

import type { IntentGroup, QueryEntry } from "../types";
import { tokenize } from "./textProcessor";

// ─── Intent Type ─────────────────────────────────────────────────────────────

export type IntentType =
  | "Informational"
  | "Navigational"
  | "Transactional"
  | "Commercial";

export interface IntentClassification {
  type: IntentType;
  confidence: number; // 0-1
  scores: Record<IntentType, number>;
}

// Keyword sets for each type (Russian + English patterns)
const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  Informational: [
    /\bчто\s+такое\b/i,
    /\bкак\b/i,
    /\bпочему\b/i,
    /\bзачем\b/i,
    /\bчем\b/i,
    /\bчто\b/i,
    /\bкогда\b/i,
    /\bгде\b/i,
    /\bруководств/i,
    /\bгайд/i,
    /\bстатья/i,
    /\bинструкци/i,
    /\bсхема\b/i,
    /\bпринцип\b/i,
    /\bметод/i,
    /\bспособ/i,
    /\bвид[ы]?\b/i,
    /\bтипы\b/i,
    /\bдля\s+чего\b/i,
    /\bсоветы\b/i,
    /\bрекомендации\b/i,
    /\bобъяснение\b/i,
    /\bпонять\b/i,
    /\bузнать\b/i,
    /\bhow\s+to\b/i,
    /\bwhat\s+is\b/i,
    /\bwhy\b/i,
    /\bguide\b/i,
  ],
  Navigational: [
    /\bофициальн/i,
    /\bсайт\b/i,
    /\bстраниц/i,
    /\bпортал\b/i,
    /\bвойти\b/i,
    /\bвход\b/i,
    /\bзарегистрироваться\b/i,
    /\bличный\s+кабинет\b/i,
    /\bлк\b/i,
    /\bскачать\b/i,
    /\bзагрузить\b/i,
    /\bприложение\b/i,
    /\bapp\b/i,
    /\bсайта\b/i,
    /\bwebsite\b/i,
    /\bofficial\b/i,
    /\blogin\b/i,
    /\bsign\s+in\b/i,
    /\bdownload\b/i,
  ],
  Transactional: [
    /\bкупить\b/i,
    /\bзаказать\b/i,
    /\bприобрести\b/i,
    /\bценa\b/i,
    /\bцены\b/i,
    /\bстоимость\b/i,
    /\bоплатить\b/i,
    /\bдоставка\b/i,
    /\bмагазин\b/i,
    /\bинтернет.магазин\b/i,
    /\bскидка\b/i,
    /\bакция\b/i,
    /\bраспродажа\b/i,
    /\bзаказ\b/i,
    /\bкупить\s+онлайн\b/i,
    /\bдешево\b/i,
    /\bнедорого\b/i,
    /\bбюджетн/i,
    /\bоптом\b/i,
    /\bрозница\b/i,
    /\bbuy\b/i,
    /\border\b/i,
    /\bpurchase\b/i,
    /\bprice\b/i,
    /\bshop\b/i,
    /\bcheap\b/i,
    /\bdeal\b/i,
    /\bдоступн/i,
  ],
  Commercial: [
    /\bлучш/i,
    /\bрейтинг\b/i,
    /\bотзыв/i,
    /\bсравнени/i,
    /\bтоп[\s\-]?\d/i,
    /\bтоп\b/i,
    /\bобзор/i,
    /\bвыбор\b/i,
    /\bvsь?\b/i,
    /\bили\b/i,
    /\bкакой\b/i,
    /\bкакую\b/i,
    /\bкакие\b/i,
    /\bстоит\s+ли\b/i,
    /\bрекомендуемый\b/i,
    /\bпоплярн/i,
    /\bпопулярн/i,
    /\bплюсы\b/i,
    /\bминусы\b/i,
    /\bпреимуществ/i,
    /\bнедостатк/i,
    /\bбест\b/i,
    /\bbest\b/i,
    /\breview/i,
    /\bcompare\b/i,
    /\brating\b/i,
    /\bvs\b/i,
    /\btop\b/i,
    /\brecommend/i,
  ],
};

/**
 * Classify a single intent group into one of four types
 */
export function classifyIntent(group: IntentGroup): IntentClassification {
  // Build a single text corpus from the group (weighted by frequency)
  const corpus = group
    .map((entry) => entry.query.repeat(Math.min(entry.frequency, 5)))
    .join(" ");

  const rawScores: Record<IntentType, number> = {
    Informational: 0,
    Navigational: 0,
    Transactional: 0,
    Commercial: 0,
  };

  for (const [type, patterns] of Object.entries(INTENT_PATTERNS) as [
    IntentType,
    RegExp[],
  ][]) {
    for (const pattern of patterns) {
      const matches = corpus.match(new RegExp(pattern.source, "gi"));
      if (matches) {
        rawScores[type] += matches.length;
      }
    }
  }

  // Normalise into probabilities
  const total = Object.values(rawScores).reduce((a, b) => a + b, 0);
  const scores: Record<IntentType, number> =
    total === 0
      ? {
          Informational: 0.25,
          Navigational: 0.25,
          Transactional: 0.25,
          Commercial: 0.25,
        }
      : {
          Informational: rawScores.Informational / total,
          Navigational: rawScores.Navigational / total,
          Transactional: rawScores.Transactional / total,
          Commercial: rawScores.Commercial / total,
        };

  // Pick winner
  const type = (Object.entries(scores) as [IntentType, number][]).reduce(
    (best, [t, s]) => (s > best[1] ? [t, s] : best),
    ["Informational", 0] as [IntentType, number],
  )[0];

  // If no patterns matched at all, default to Informational
  const confidence = total === 0 ? 0.25 : scores[type];

  return { type, confidence, scores };
}

// ─── Cluster Density ─────────────────────────────────────────────────────────

export interface ClusterDensity {
  /** Average number of unique tokens per query in the group */
  avgTerms: number;
  /** Ratio of unique tokens to total tokens (lexical diversity) */
  lexicalDiversity: number;
  /** Normalised density score 0-1 (higher = more focused cluster) */
  densityScore: number;
  /** Label for the density level */
  densityLabel: "Высокая" | "Средняя" | "Низкая";
  /** Total frequency of all queries in the group */
  totalFrequency: number;
  /** Number of distinct tokens across all queries */
  uniqueTermCount: number;
}

export function computeClusterDensity(group: IntentGroup): ClusterDensity {
  if (group.length === 0) {
    return {
      avgTerms: 0,
      lexicalDiversity: 0,
      densityScore: 0,
      densityLabel: "Низкая",
      totalFrequency: 0,
      uniqueTermCount: 0,
    };
  }

  const totalFrequency = group.reduce((s, e) => s + e.frequency, 0);

  // Per-query token sets
  const queryTokenSets = group.map((entry) => new Set(tokenize(entry.query)));
  const avgTerms =
    queryTokenSets.reduce((s, ts) => s + ts.size, 0) / group.length;

  // Global unique token set
  const allTokens = new Set(group.flatMap((e) => tokenize(e.query)));
  const uniqueTermCount = allTokens.size;

  // Total token count (with repetition)
  const totalTokens = group.flatMap((e) => tokenize(e.query)).length;
  const lexicalDiversity =
    totalTokens === 0 ? 0 : uniqueTermCount / totalTokens;

  // Density: inverse of spread — focused clusters have high overlap between queries
  // We measure it as average Jaccard similarity across all pairs
  let pairSimilaritySum = 0;
  let pairCount = 0;
  for (let i = 0; i < queryTokenSets.length; i++) {
    for (let j = i + 1; j < queryTokenSets.length; j++) {
      const a = queryTokenSets[i];
      const b = queryTokenSets[j];
      let intersection = 0;
      for (const t of a) {
        if (b.has(t)) intersection++;
      }
      const union = a.size + b.size - intersection;
      pairSimilaritySum += union === 0 ? 0 : intersection / union;
      pairCount++;
    }
  }

  // If there's only one query, density is maximal by definition
  const avgPairSimilarity = pairCount === 0 ? 1 : pairSimilaritySum / pairCount;

  // Normalise: score = 0.6 * pairSimilarity + 0.4 * (1 - lexicalDiversity)
  // Higher pairSimilarity = more focused. Lower lexical diversity = less spread.
  const densityScore = Math.min(
    1,
    0.6 * avgPairSimilarity + 0.4 * (1 - lexicalDiversity),
  );

  const densityLabel: "Высокая" | "Средняя" | "Низкая" =
    densityScore >= 0.5
      ? "Высокая"
      : densityScore >= 0.25
        ? "Средняя"
        : "Низкая";

  return {
    avgTerms: Math.round(avgTerms * 10) / 10,
    lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000,
    densityScore: Math.round(densityScore * 1000) / 1000,
    densityLabel,
    totalFrequency,
    uniqueTermCount,
  };
}

// ─── Cannibalization detection ─────────────────────────────────────────────

export interface CannibalizationPair {
  indexA: number;
  indexB: number;
  labelA: string;
  labelB: string;
  similarity: number; // Jaccard similarity 0-1
  /** risk level */
  risk: "Критичный" | "Высокий" | "Умеренный";
  /** shared tokens between the two intents */
  sharedTokens: string[];
}

export function detectCannibalization(
  groups: IntentGroup[],
  labels: string[],
  threshold = 0.15,
): CannibalizationPair[] {
  const termSets = groups.map(
    (group) => new Set(group.flatMap((entry) => tokenize(entry.query))),
  );

  const pairs: CannibalizationPair[] = [];

  for (let i = 0; i < termSets.length; i++) {
    for (let j = i + 1; j < termSets.length; j++) {
      const a = termSets[i];
      const b = termSets[j];

      const sharedArr: string[] = [];
      for (const t of a) {
        if (b.has(t)) sharedArr.push(t);
      }

      const union = a.size + b.size - sharedArr.length;
      const similarity = union === 0 ? 0 : sharedArr.length / union;

      if (similarity >= threshold) {
        const risk: CannibalizationPair["risk"] =
          similarity >= 0.6
            ? "Критичный"
            : similarity >= 0.35
              ? "Высокий"
              : "Умеренный";

        pairs.push({
          indexA: i,
          indexB: j,
          labelA: labels[i],
          labelB: labels[j],
          similarity,
          risk,
          sharedTokens: sharedArr.slice(0, 15),
        });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

// ─── Batch classification for all groups ──────────────────────────────────

export interface IntentAnalysis {
  classification: IntentClassification;
  density: ClusterDensity;
}

export function analyzeIntents(groups: IntentGroup[]): IntentAnalysis[] {
  return groups.map((group) => ({
    classification: classifyIntent(group),
    density: computeClusterDensity(group),
  }));
}
