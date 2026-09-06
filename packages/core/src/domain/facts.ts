import type { ConceptRef, NodeId, Provenance } from './common.js';

/**
 * `disputed` is deliberately absent in Milestone 0.
 *
 * Contestation is *derived* — it surfaces as a `Conflict` reasoning node — so
 * storing it on the fact would duplicate derived state into layer 2 and break
 * the guarantee that the reasoning layer is a pure function of the facts. The
 * only ways out of a conflict in M0 are supersession and invalidation, both
 * explicit human acts. Dispute resolution is Milestone 1.
 */
export type FactStatus = 'active' | 'superseded' | 'invalidated';

export type FactValue =
  | { readonly kind: 'quantity'; readonly num: number; readonly unit: string }
  | { readonly kind: 'coded'; readonly code: string };

/**
 * A fact about one patient. Bi-temporal on purpose: the canonical scenario
 * turns entirely on the difference between when something was *observed* and
 * when it was *recorded*.
 */
export interface PatientFact {
  readonly id: NodeId;
  readonly kind: 'observation' | 'medication' | 'condition';
  readonly concept: ConceptRef;
  readonly value?: FactValue;
  /** Clinical time: when the observation is true of the patient. */
  readonly observedAt: string;
  /** System time: when the system learned it. */
  readonly recordedAt: string;
  readonly status: FactStatus;
  readonly supersededBy?: NodeId;
  /** Required whenever status is not `active`. Never inferred. */
  readonly statusReason?: string;
  readonly provenance: Provenance;
}

export function isActive(fact: PatientFact): boolean {
  return fact.status === 'active';
}

export function quantity(num: number, unit: string): FactValue {
  return { kind: 'quantity', num, unit };
}
