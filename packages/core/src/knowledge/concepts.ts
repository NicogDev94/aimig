import type { ConceptRef } from '../domain/common.js';

function c(code: string, display: string): ConceptRef {
  return { system: 'aimig-local', code, display };
}

/**
 * The closed vocabulary of Milestone 0.
 *
 * Deliberately tiny. It is not an attempt at a terminology: SNOMED CT and LOINC
 * already do that far better, and mapping onto them is Milestone 1 work that
 * `ConceptRef.system` is already shaped to absorb.
 */
export const CONCEPTS = {
  // medications
  spironolactone: c('spironolactone', 'Spironolactone'),
  ramipril: c('ramipril', 'Ramipril'),
  ibuprofen: c('ibuprofen', 'Ibuprofen'),
  warfarin: c('warfarin', 'Warfarin'),
  amiodarone: c('amiodarone', 'Amiodarone'),

  // analytes
  potassium: c('potassium', 'Potassium'),
  egfr: c('egfr', 'eGFR'),
  inr: c('inr', 'INR'),
  weight: c('weight', 'Body weight'),

  // qualitative claims and risk targets
  hyperkalemia: c('hyperkalemia', 'Hyperkalemia'),
  renal_impairment: c('renal_impairment', 'Renal impairment'),
  over_anticoagulation: c('over_anticoagulation', 'Over-anticoagulation'),
  bleeding: c('bleeding', 'Bleeding'),
} as const satisfies Record<string, ConceptRef>;

export type ConceptCode = keyof typeof CONCEPTS;

export function conceptByCode(code: string): ConceptRef | undefined {
  return (CONCEPTS as Record<string, ConceptRef>)[code];
}
