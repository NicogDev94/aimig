import type { ConceptRef } from './common.js';

/**
 * Structured reference to the source backing a knowledge assertion.
 *
 * Auditability is a central claim of AIMIG, so provenance is structured from
 * day one rather than being a free-text string. This is deliberately NOT a
 * bibliographic engine: no ingestion, no DOI resolution, no citation styles.
 * It carries exactly what `Why?` and `Why changed?` need in order to point at
 * a source a human can go and check.
 */
export interface EvidenceRef {
  readonly id: string;
  readonly title: string;
  readonly publisher?: string;
  readonly version?: string;
  readonly publishedAt?: string;
  readonly url?: string;
  readonly locator?: { readonly section?: string; readonly page?: string };
}

export type KnowledgePredicate =
  | 'increases_risk_of'
  | 'contraindicates'
  | 'requires_monitoring_of'
  | 'contradicts';

export type Strength = 'weak' | 'moderate' | 'strong';

/** General medical knowledge: true of the world, not of one patient. */
export interface KnowledgeAssertion {
  readonly id: string;
  readonly subject: ConceptRef;
  readonly predicate: KnowledgePredicate;
  readonly object: ConceptRef;
  readonly strength: Strength;
  readonly evidence: readonly EvidenceRef[];
}

export type Severity = 'mild' | 'moderate' | 'severe';

/**
 * Maps a numeric observation onto a qualitative claim.
 * `min` is inclusive, `max` is exclusive; either may be omitted for open bands.
 */
export interface ThresholdBand {
  readonly id: string;
  readonly analyte: ConceptRef;
  readonly unit: string;
  readonly min?: number;
  readonly max?: number;
  readonly conclusion: ConceptRef;
  readonly severity: Severity;
  readonly evidence: readonly EvidenceRef[];
}

/**
 * Declared ordering of an ordinal attribute.
 *
 * Without this the diff cannot tell `weakened` from `strengthened` — it can
 * only say `changed`. The engine never infers an order; an attribute with no
 * declared scale falls back to `changed`.
 */
export interface OrdinalScale {
  readonly attribute: string;
  /** Weakest first. */
  readonly order: readonly string[];
}

/** Turns an aggregated hypothesis into a recommendation. */
export interface ActionRule {
  readonly id: string;
  readonly whenConclusion: string;
  readonly whenLevel: string;
  readonly actionKey: string;
  readonly actionLabel: string;
  readonly urgency: string;
  readonly evidence: readonly EvidenceRef[];
}

/** Declares that two concepts cannot both be actively asserted without ambiguity. */
export interface ConflictRule {
  readonly id: string;
  /** Two active observations of this analyte whose values disagree beyond `tolerance`. */
  readonly analyte: ConceptRef;
  readonly tolerance: number;
  /** Observations further apart than this (in days) are history, not a conflict. */
  readonly withinDays: number;
}

/**
 * Says what this rule set has and has not been validated for.
 *
 * Rendered by the README, the CLI demo and every UI view. It lives in the data
 * rather than in three hard-coded strings so that it cannot drift, and so that
 * the rule set cannot be displayed without its status.
 */
export interface ValidationNotice {
  readonly scope: 'reasoning_mechanics_only';
  readonly clinicalValidity: 'unvalidated';
  readonly notice: string;
}

export interface KnowledgeBase {
  readonly version: string;
  readonly validation: ValidationNotice;
  readonly assertions: readonly KnowledgeAssertion[];
  readonly bands: readonly ThresholdBand[];
  readonly actions: readonly ActionRule[];
  readonly conflicts: readonly ConflictRule[];
  readonly ordinalScales: readonly OrdinalScale[];
}
