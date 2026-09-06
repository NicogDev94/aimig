import type { CaseLog, Commit, PatientFact, KnowledgeBase } from './domain/index.js';
import type { NodeId, Version } from './domain/common.js';
import type { ReasoningState } from './domain/reasoning.js';
import type { DerivationTree } from './domain/diff.js';

/**
 * Persistence, and nothing else.
 *
 * A graph database buys nothing here: the canonical record is an append-only
 * log of assertions, versioning and diffing are trivial over a log and painful
 * over a mutable graph, and the derived state is small enough to hold in
 * memory. The interface exists so that swapping the JSON file for SQLite later
 * is painless — not because several backends are planned.
 */
export interface ReasoningStore {
  load(caseId: string): Promise<CaseLog>;
  append(caseId: string, commit: Commit): Promise<Version>;
  has(caseId: string): Promise<boolean>;
  create(caseId: string): Promise<CaseLog>;
}

/**
 * The deterministic reasoning engine. No LLM, no I/O, no clock.
 *
 * `derive` is a pure function of (knowledge, facts), which is what makes the
 * whole state reproducible from the log alone.
 */
export interface ReasoningEngine {
  derive(
    knowledge: KnowledgeBase,
    facts: readonly PatientFact[],
    version: Version,
  ): ReasoningState;

  /** Answers "why does this node exist?", down to the evidence. */
  explain(
    knowledge: KnowledgeBase,
    state: ReasoningState,
    nodeId: NodeId,
  ): DerivationTree;

  /**
   * Every conclusion transitively depending on a fact.
   *
   * Used to *explain* a correction, never to schedule the recomputation —
   * the engine always recomputes in full.
   */
  affectedBy(state: ReasoningState, factId: NodeId): readonly NodeId[];
}

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet`);
    this.name = 'NotImplementedError';
  }
}
