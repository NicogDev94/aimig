import { NotImplementedError } from '../contracts.js';
import type { PatientFact } from '../domain/facts.js';
import type { Mutation } from '../domain/log.js';

/**
 * Folds the canonical log into the set of statused facts for a version.
 *
 * Implemented in PR4. Declared now so the benchmark harness is written against
 * a stable contract instead of being rewritten when corrections land.
 */
export function applyMutations(
  _facts: readonly PatientFact[],
  _mutations: readonly Mutation[],
  _at: string,
): PatientFact[] {
  throw new NotImplementedError('applyMutations');
}
