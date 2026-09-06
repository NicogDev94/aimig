/**
 * Identifiers and values shared by all three layers.
 *
 * A `NodeId` addresses either a patient fact (layer 2) or a reasoning node
 * (layer 3). The two namespaces never collide: reasoning node ids are built by
 * `src/domain/ids.ts`, which always prefixes them.
 */
export type NodeId = string;

/** Index of a commit in a case log. Version 0 is the state before any commit. */
export type Version = number;

/**
 * Reference to a clinical concept.
 *
 * `system` is fixed to the local vocabulary in Milestone 0. It exists now so
 * that mapping to SNOMED CT / LOINC later is additive rather than a migration.
 */
export interface ConceptRef {
  readonly system: 'aimig-local';
  readonly code: string;
  readonly display: string;
}

/** Where a piece of information came from, and who vouched for it. */
export interface Provenance {
  readonly origin: 'manual' | 'fixture' | 'llm_proposal';
  readonly actor: string;
  readonly note?: string;
  /**
   * Set when a human confirmed a proposal. An `llm_proposal` without this is
   * never part of the canonical state — see docs/milestone-0.md, PR7.
   */
  readonly confirmedBy?: string;
}

export function sameConcept(a: ConceptRef, b: ConceptRef): boolean {
  return a.system === b.system && a.code === b.code;
}
