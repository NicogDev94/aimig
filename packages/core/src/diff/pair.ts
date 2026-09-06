import type { NodeId } from '../domain/common.js';
import type { OrdinalScale } from '../domain/knowledge.js';
import type { ReasoningNode, ReasoningState } from '../domain/reasoning.js';

/**
 * Groups the derived nodes of a state by what they conclude.
 *
 * Observations are excluded: they are the patient layer projected in, not
 * conclusions, and pairing them would drown the diff in noise.
 */
export function derivedByKey(
  state: ReasoningState,
): ReadonlyMap<string, readonly ReasoningNode[]> {
  const groups = new Map<string, ReasoningNode[]>();
  for (const node of state.nodes) {
    if (node.type === 'Observation') continue;
    const list = groups.get(node.conclusionKey);
    if (list === undefined) groups.set(node.conclusionKey, [node]);
    else list.push(node);
  }
  for (const list of groups.values()) list.sort((a, b) => (a.id < b.id ? -1 : 1));
  return groups;
}

/** Deterministic representative when several nodes share a conclusion. */
export function representative(nodes: readonly ReasoningNode[]): ReasoningNode | undefined {
  return nodes[0];
}

export function sameNodeSet(
  a: readonly ReasoningNode[],
  b: readonly ReasoningNode[],
): boolean {
  const ids = (nodes: readonly ReasoningNode[]): string =>
    nodes
      .map((n) => n.id)
      .sort()
      .join('|');
  return ids(a) === ids(b);
}

export function attributeDeltas(
  before: ReasoningNode,
  after: ReasoningNode,
): Record<string, { from: string | number; to: string | number }> {
  const deltas: Record<string, { from: string | number; to: string | number }> = {};
  for (const key of new Set([
    ...Object.keys(before.attributes),
    ...Object.keys(after.attributes),
  ])) {
    const from = before.attributes[key];
    const to = after.attributes[key];
    if (from === to) continue;
    if (from === undefined || to === undefined) continue;
    deltas[key] = { from, to };
  }
  return deltas;
}

export function premiseIds(node: ReasoningNode | undefined): NodeId[] {
  return (node?.derivation?.premises ?? []).map((p) => p.nodeId);
}

/**
 * Reads a direction off the declared ordinal scales.
 *
 * `weakened` and `strengthened` are only ever *derived*, never guessed: an
 * attribute with no declared scale yields `changed`, and attributes that move
 * in opposite directions yield `changed` too. The engine does not invent an
 * ordering it was not given.
 */
export function verdictFromDeltas(
  deltas: Readonly<Record<string, { from: string | number; to: string | number }>>,
  scales: readonly OrdinalScale[],
): 'strengthened' | 'weakened' | 'changed' {
  const directions = new Set<'up' | 'down'>();

  for (const [attribute, delta] of Object.entries(deltas)) {
    const scale = scales.find((s) => s.attribute === attribute);
    if (scale === undefined) continue;
    const from = scale.order.indexOf(String(delta.from));
    const to = scale.order.indexOf(String(delta.to));
    if (from === -1 || to === -1 || from === to) continue;
    directions.add(to > from ? 'up' : 'down');
  }

  if (directions.size !== 1) return 'changed';
  return directions.has('up') ? 'strengthened' : 'weakened';
}
