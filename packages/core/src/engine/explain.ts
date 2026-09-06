import type { NodeId } from '../domain/common.js';
import type { DerivationTree } from '../domain/diff.js';
import type { KnowledgeBase } from '../domain/knowledge.js';
import { findNode, type ReasoningState } from '../domain/reasoning.js';
import { KnowledgeIndex } from './knowledge-index.js';

/**
 * Answers "why does this node exist?" by walking the premises it was actually
 * derived from — not by describing them afterwards.
 *
 * The tree bottoms out at Observations, which is where the reasoning layer
 * meets the patient layer, and it resolves the knowledge used all the way down
 * to structured evidence so the answer ends at something a human can check.
 */
export function explain(
  knowledge: KnowledgeBase,
  state: ReasoningState,
  nodeId: NodeId,
  index: KnowledgeIndex = new KnowledgeIndex(knowledge),
  seen: ReadonlySet<NodeId> = new Set(),
): DerivationTree {
  const node = findNode(state, nodeId);
  if (node === undefined) throw new Error(`node "${nodeId}" is not in this state`);

  const derivation = node.derivation;
  if (derivation === undefined) {
    return { node, knowledgeUsed: [], evidence: [], premises: [] };
  }

  // The graph is acyclic by construction, but explanations are user-facing and
  // a guard here is cheaper than an unbounded recursion in a demo.
  const guard = new Set([...seen, nodeId]);

  return {
    node,
    ruleId: derivation.ruleId,
    knowledgeUsed: index.assertions(derivation.knowledgeUsed),
    evidence: index.evidence(derivation.knowledgeUsed),
    premises: derivation.premises
      .filter((p) => !guard.has(p.nodeId))
      .map((p) => explain(knowledge, state, p.nodeId, index, guard)),
  };
}
