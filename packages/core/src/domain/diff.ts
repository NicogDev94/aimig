import type { NodeId } from './common.js';
import type { PatientFact } from './facts.js';
import type { EvidenceRef, KnowledgeAssertion } from './knowledge.js';
import type { Mutation } from './log.js';
import type { ReasoningNode } from './reasoning.js';

/** The premise tree behind one node, as returned by `explain`. */
export interface DerivationTree {
  readonly node: ReasoningNode;
  readonly ruleId?: string;
  readonly knowledgeUsed: readonly KnowledgeAssertion[];
  readonly evidence: readonly EvidenceRef[];
  readonly premises: readonly DerivationTree[];
}

export type ChangeVerdict =
  | 'added'
  | 'retracted'
  | 'strengthened'
  | 'weakened'
  | 'changed'
  | 'unchanged';

export interface ChangedNode {
  readonly conclusionKey: string;
  readonly before: ReasoningNode;
  readonly after: ReasoningNode;
  readonly attributeDeltas: Readonly<
    Record<string, { readonly from: string | number; readonly to: string | number }>
  >;
  readonly premisesLost: readonly NodeId[];
  readonly premisesGained: readonly NodeId[];
  readonly verdict: Extract<ChangeVerdict, 'strengthened' | 'weakened' | 'changed'>;
}

/**
 * `retracted` lives here and nowhere else: it is the only place in the system
 * where a node absent from the current state is represented.
 */
export interface ReasoningDiff {
  readonly facts: {
    readonly added: readonly PatientFact[];
    readonly superseded: readonly {
      readonly fact: PatientFact;
      readonly by: PatientFact;
      readonly reason: string;
    }[];
    readonly invalidated: readonly {
      readonly fact: PatientFact;
      readonly reason: string;
    }[];
  };
  readonly nodes: {
    readonly added: readonly ReasoningNode[];
    readonly retracted: readonly ReasoningNode[];
    readonly changed: readonly ChangedNode[];
  };
  readonly recommendations: {
    readonly before: readonly ReasoningNode[];
    readonly after: readonly ReasoningNode[];
    readonly urgencyDelta?: { readonly from: string; readonly to: string };
  };
}

/**
 * The answer to "why did this change?", reconstructed from structured
 * mutations and real dependencies — never authored after the fact.
 */
export interface ChangeExplanation {
  readonly target: string;
  readonly causedBy: readonly Mutation[];
  readonly premisesLost: readonly DerivationTree[];
  readonly premisesGained: readonly DerivationTree[];
  readonly rulesRefired: readonly string[];
  readonly knowledgeCited: readonly KnowledgeAssertion[];
  readonly evidenceCited: readonly EvidenceRef[];
  readonly verdict: ChangeVerdict;
}
