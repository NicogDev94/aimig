import type { NodeId } from '../domain/common.js';
import { observationNodeId } from '../domain/ids.js';
import type { ReasoningState } from '../domain/reasoning.js';

/**
 * Reverse index: for a node, everything that was derived from it.
 *
 * This is what makes a correction explainable. It is deliberately NOT used to
 * schedule recomputation — the engine always recomputes in full (D2). Mixing
 * the two is where incremental-invalidation bugs come from; keeping them apart
 * gives the same observable behaviour for a fraction of the complexity.
 */
export function dependents(state: ReasoningState): ReadonlyMap<NodeId, readonly NodeId[]> {
  const index = new Map<NodeId, NodeId[]>();
  for (const node of state.nodes) {
    for (const premise of node.derivation?.premises ?? []) {
      const list = index.get(premise.nodeId);
      if (list === undefined) index.set(premise.nodeId, [node.id]);
      else list.push(node.id);
    }
  }
  return index;
}

/**
 * Every conclusion transitively resting on a fact.
 *
 * Excludes the observation node itself: the question a clinician asks is "what
 * did this value change?", not "did this value change itself?".
 */
export function affectedBy(state: ReasoningState, factId: NodeId): NodeId[] {
  const index = dependents(state);
  const start = observationNodeId(factId);
  const reached = new Set<NodeId>();
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dependent of index.get(current) ?? []) {
      if (reached.has(dependent)) continue;
      reached.add(dependent);
      queue.push(dependent);
    }
  }
  return [...reached];
}
