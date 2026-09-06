import type { NodeId } from './common.js';
import type { Premise } from './reasoning.js';

const OBSERVATION_PREFIX = 'obs';
const DERIVED_SEPARATOR = '#';

/**
 * Identity of derived nodes.
 *
 * Two nodes are the same node when the same rule reached the same conclusion
 * from the same premises. That is what makes a diff meaningful: without stable
 * identity, a full recompute renumbers everything and every version looks like
 * a complete replacement.
 *
 * A composite string is used rather than a hash. It is collision-free by
 * construction instead of collision-*unlikely*, it needs no crypto dependency
 * (keeping `@aimig/core` runnable in a browser), and — most useful in practice
 * — when two nodes differ you can read *why* straight off the id.
 */
export function derivedNodeId(
  ruleId: string,
  conclusionKey: string,
  premises: readonly Premise[],
): NodeId {
  const premiseIds = premises
    .map((p) => p.nodeId)
    .slice()
    .sort();
  return [ruleId, conclusionKey, premiseIds.join(',')].join(DERIVED_SEPARATOR);
}

/** Reasoning-layer id of the `Observation` node projecting a patient fact. */
export function observationNodeId(factId: NodeId): NodeId {
  return `${OBSERVATION_PREFIX}${DERIVED_SEPARATOR}${factId}`;
}

export function isObservationNodeId(id: NodeId): boolean {
  return id.startsWith(`${OBSERVATION_PREFIX}${DERIVED_SEPARATOR}`);
}

/** Inverse of `observationNodeId`. */
export function factIdOfObservationNode(id: NodeId): NodeId | undefined {
  if (!isObservationNodeId(id)) return undefined;
  return id.slice(OBSERVATION_PREFIX.length + DERIVED_SEPARATOR.length);
}
