import { NotImplementedError } from '../contracts.js';
import type { ChangeExplanation, ReasoningDiff } from '../domain/diff.js';
import type { PatientFact } from '../domain/facts.js';
import type { KnowledgeBase } from '../domain/knowledge.js';
import type { Mutation } from '../domain/log.js';
import type { ReasoningState } from '../domain/reasoning.js';

/** One version, as the diff sees it: what held, and what it was derived from. */
export interface VersionSnapshot {
  readonly state: ReasoningState;
  readonly facts: readonly PatientFact[];
}

/** Implemented in PR5. */
export function diffStates(
  _knowledge: KnowledgeBase,
  _before: VersionSnapshot,
  _after: VersionSnapshot,
  _mutations: readonly Mutation[],
): ReasoningDiff {
  throw new NotImplementedError('diffStates');
}

/** Implemented in PR5. */
export function whyChanged(
  _knowledge: KnowledgeBase,
  _before: VersionSnapshot,
  _after: VersionSnapshot,
  _mutations: readonly Mutation[],
  _conclusionKey: string,
): ChangeExplanation {
  throw new NotImplementedError('whyChanged');
}
