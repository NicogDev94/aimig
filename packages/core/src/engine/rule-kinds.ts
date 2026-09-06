import type { NodeId } from '../domain/common.js';
import type { PatientFact } from '../domain/facts.js';
import type { KnowledgeBase } from '../domain/knowledge.js';
import type { Premise, ReasoningNode, ReasoningNodeType } from '../domain/reasoning.js';

/**
 * The six rule kinds of Milestone 0. The cap is frozen.
 *
 * `conflict` is the sixth: the `Conflict` primitive needs a producer and no
 * other kind can emit it — a knowledge edge cannot express "two potassium
 * results disagree". A seventh kind is not added on the engine's own
 * initiative; the reason the model is insufficient gets documented and the
 * decision gets asked for.
 */
export type RuleKind =
  | 'threshold'
  | 'knowledge_link'
  | 'aggregate'
  | 'action'
  | 'gap'
  | 'conflict';

/** What a rule saw when it fired, and what it concluded from it. */
export interface RuleOutput {
  readonly ruleId: string;
  readonly type: ReasoningNodeType;
  readonly conclusionKey: string;
  readonly label: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  /**
   * Rules return their premises rather than declaring them separately, so the
   * dependency graph is a by-product of firing and cannot drift from what
   * actually happened.
   */
  readonly premises: readonly Premise[];
  readonly knowledgeUsed: readonly string[];
}

export interface RuleContext {
  readonly knowledge: KnowledgeBase;
  /** Active facts only. A superseded fact is not part of what currently holds. */
  readonly facts: readonly PatientFact[];
  /** Everything derived so far in this pass. */
  readonly nodes: readonly ReasoningNode[];
  observationNodeOf(factId: NodeId): ReasoningNode | undefined;
  nodesWithKey(conclusionKey: string): readonly ReasoningNode[];
}

export interface Rule {
  readonly kind: RuleKind;
  fire(ctx: RuleContext): RuleOutput[];
}
