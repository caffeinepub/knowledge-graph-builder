import type { QueryEntry } from "../types";
import { processText } from "./textProcessor";

export interface TFIDFResult {
  term: string;
  tf: number;
  idf: number;
  tfidf: number;
  totalFrequency: number;
  documentFrequency: number;
}

export interface CoOccurrencePair {
  termA: string;
  termB: string;
  count: number;
  weight: number;
}

export interface EntityCandidate {
  term: string;
  tfidf: number;
  totalFrequency: number;
  documentFrequency: number;
}

export interface RelationCandidate {
  termA: string;
  termB: string;
  coOccurrenceCount: number;
  weight: number;
}

/**
 * Compute TF-IDF scores for all terms across the query corpus.
 * Each query is treated as a "document". Frequency is used as term weight.
 */
export function computeTFIDF(queries: QueryEntry[]): Map<string, TFIDFResult> {
  const termDocFreq = new Map<string, number>(); // how many docs contain the term
  const termTotalFreq = new Map<string, number>(); // sum of frequencies across all docs
  const docTermFreqs: Map<string, number>[] = [];

  for (const q of queries) {
    const terms = processText(q.query);
    const docFreq = new Map<string, number>();
    for (const term of terms) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      termTotalFreq.set(term, (termTotalFreq.get(term) ?? 0) + q.frequency);
    }
    docTermFreqs.push(docFreq);
    for (const term of docFreq.keys()) {
      termDocFreq.set(term, (termDocFreq.get(term) ?? 0) + 1);
    }
  }

  const N = queries.length || 1;
  const result = new Map<string, TFIDFResult>();

  for (const [term, docFreq] of termDocFreq.entries()) {
    const totalFreq = termTotalFreq.get(term) ?? 0;
    // TF: normalized frequency across all queries
    const tf = totalFreq / (queries.reduce((s, q) => s + q.frequency, 0) || 1);
    // IDF: log(N / df)
    const idf = Math.log((N + 1) / (docFreq + 1)) + 1;
    const tfidf = tf * idf;

    result.set(term, {
      term,
      tf,
      idf,
      tfidf,
      totalFrequency: totalFreq,
      documentFrequency: docFreq,
    });
  }

  return result;
}

/**
 * Build a co-occurrence matrix for term pairs within a sliding window.
 * windowSize: number of tokens to look ahead/behind.
 */
export function buildCoOccurrenceMatrix(
  queries: QueryEntry[],
  windowSize = 3,
): Map<string, CoOccurrencePair> {
  const coOccurrence = new Map<string, CoOccurrencePair>();

  for (const q of queries) {
    const terms = processText(q.query);
    const weight = q.frequency;

    for (let i = 0; i < terms.length; i++) {
      for (
        let j = i + 1;
        j <= Math.min(i + windowSize, terms.length - 1);
        j++
      ) {
        const a = terms[i] < terms[j] ? terms[i] : terms[j];
        const b = terms[i] < terms[j] ? terms[j] : terms[i];
        const key = `${a}|||${b}`;

        const existing = coOccurrence.get(key);
        if (existing) {
          existing.count += 1;
          existing.weight += weight;
        } else {
          coOccurrence.set(key, { termA: a, termB: b, count: 1, weight });
        }
      }
    }
  }

  return coOccurrence;
}

/**
 * Extract entity candidates from TF-IDF scores above a threshold.
 * Returns top entities sorted by TF-IDF descending.
 */
export function extractEntityCandidates(
  tfidfScores: Map<string, TFIDFResult>,
  maxEntities = 60,
): EntityCandidate[] {
  const sorted = Array.from(tfidfScores.values())
    .filter((r) => r.totalFrequency > 0)
    .sort((a, b) => b.tfidf - a.tfidf);

  return sorted.slice(0, maxEntities).map((r) => ({
    term: r.term,
    tfidf: r.tfidf,
    totalFrequency: r.totalFrequency,
    documentFrequency: r.documentFrequency,
  }));
}

/**
 * Extract relation candidates from co-occurrence matrix filtered to entity candidates.
 */
export function extractRelationCandidates(
  coOccurrenceMatrix: Map<string, CoOccurrencePair>,
  entityCandidates: EntityCandidate[],
): RelationCandidate[] {
  const entitySet = new Set(entityCandidates.map((e) => e.term));
  const relations: RelationCandidate[] = [];

  for (const pair of coOccurrenceMatrix.values()) {
    if (entitySet.has(pair.termA) && entitySet.has(pair.termB)) {
      relations.push({
        termA: pair.termA,
        termB: pair.termB,
        coOccurrenceCount: pair.count,
        weight: pair.weight,
      });
    }
  }

  return relations.sort((a, b) => b.weight - a.weight);
}
