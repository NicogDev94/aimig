import type { NodeId, Version } from './common.js';
import type { PatientFact } from './facts.js';

/**
 * The canonical log holds *assertions only*. No conclusion is ever persisted:
 * the reasoning layer is recomputed from the facts by `derive`. That is what
 * makes the state reproducible without any conversation history, and what
 * guarantees a conclusion can never outlive its premises.
 *
 * `dispute_fact` is absent in Milestone 0 — see `FactStatus`.
 */
export type Mutation =
  | { readonly op: 'add_fact'; readonly fact: PatientFact }
  | {
      readonly op: 'supersede_fact';
      readonly factId: NodeId;
      readonly by: NodeId;
      /** Always a human judgement. Never inferred from `observedAt`. */
      readonly reason: string;
    }
  | {
      readonly op: 'invalidate_fact';
      readonly factId: NodeId;
      readonly reason: string;
    };

export interface Commit {
  readonly version: Version;
  readonly at: string;
  readonly author: string;
  /** Why the author made this change, in their words. */
  readonly intent: string;
  /**
   * Pinned even though knowledge is frozen in M0: recording it now costs one
   * field and avoids a migration once knowledge becomes versioned.
   */
  readonly knowledgeVersion: string;
  readonly mutations: readonly Mutation[];
}

export interface CaseLog {
  readonly caseId: string;
  readonly commits: readonly Commit[];
}

export function latestVersion(log: CaseLog): Version {
  return log.commits.length === 0 ? 0 : log.commits[log.commits.length - 1]!.version;
}
