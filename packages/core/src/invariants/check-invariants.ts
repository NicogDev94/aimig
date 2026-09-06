import type { NodeId } from '../domain/common.js';
import type { PatientFact } from '../domain/facts.js';
import { derivedNodeId, isObservationNodeId, observationNodeId } from '../domain/ids.js';
import type { ReasoningNode, ReasoningState } from '../domain/reasoning.js';

/**
 * The invariants of the reasoning state, named after what they protect.
 *
 * These are the properties the whole milestone rests on. They are checked as a
 * pure function so that every `derive` in the test suite can assert them, and
 * so that a violation names itself instead of surfacing as a confusing diff
 * three layers away.
 */
export type InvariantId =
  /** 1 — an Observation is never implicitly turned into a Hypothesis. */
  | 'observation-is-not-derived'
  /** 1 — anything that is not an Observation must say how it was derived. */
  | 'derived-node-has-derivation'
  /** 2 — a Hypothesis is never presented as a patient fact. */
  | 'only-observations-reference-facts'
  /** 3 — a fact that is no longer active must say why, and by what. */
  | 'inactive-fact-is-explained'
  /** 4 — a conclusion is always linked to its premises. */
  | 'derivation-has-premises'
  /** Structural — premises resolve to nodes that exist in the same state. */
  | 'premises-resolve'
  /** Structural — the reasoning graph is acyclic. */
  | 'derivation-graph-is-acyclic'
  /** Structural — node identity is unique within a state. */
  | 'node-ids-are-unique'
  /** D2bis — the state projects active facts only; no ghosts. */
  | 'state-projects-active-facts-only'
  /** D3 — derived identity is the canonical composite, so diffs stay meaningful. */
  | 'derived-id-is-canonical';

export interface InvariantViolation {
  readonly invariant: InvariantId;
  readonly message: string;
  readonly nodeId?: NodeId;
  readonly factId?: NodeId;
}

/**
 * Validates a reasoning state against the facts it was derived from.
 *
 * Returns every violation rather than throwing on the first, because when
 * something is wrong you want the whole picture, not the alphabetically
 * earliest symptom.
 */
export function checkInvariants(
  state: ReasoningState,
  facts: readonly PatientFact[],
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const factById = new Map(facts.map((f) => [f.id, f]));
  const nodeById = new Map<NodeId, ReasoningNode>();

  for (const node of state.nodes) {
    if (nodeById.has(node.id)) {
      violations.push({
        invariant: 'node-ids-are-unique',
        nodeId: node.id,
        message: `node id "${node.id}" appears more than once`,
      });
      continue;
    }
    nodeById.set(node.id, node);
  }

  for (const node of state.nodes) {
    checkNodeShape(node, violations);
    checkFactProjection(node, factById, violations);
    checkPremises(node, nodeById, violations);
    checkCanonicalId(node, violations);
  }

  for (const fact of facts) {
    checkInactiveFactIsExplained(fact, violations);
  }

  checkAcyclic(state, nodeById, violations);

  return violations;
}

function checkNodeShape(node: ReasoningNode, out: InvariantViolation[]): void {
  if (node.type === 'Observation') {
    if (node.derivation !== undefined) {
      out.push({
        invariant: 'observation-is-not-derived',
        nodeId: node.id,
        message: `Observation "${node.id}" carries a derivation; observations project facts, they are never concluded`,
      });
    }
    if (node.sourceFactId === undefined) {
      out.push({
        invariant: 'observation-is-not-derived',
        nodeId: node.id,
        message: `Observation "${node.id}" has no sourceFactId`,
      });
    }
    return;
  }

  if (node.derivation === undefined) {
    out.push({
      invariant: 'derived-node-has-derivation',
      nodeId: node.id,
      message: `${node.type} "${node.id}" has no derivation; every conclusion must say how it was reached`,
    });
    return;
  }
  if (node.derivation.premises.length === 0) {
    out.push({
      invariant: 'derivation-has-premises',
      nodeId: node.id,
      message: `${node.type} "${node.id}" was derived from no premises`,
    });
  }
}

function checkFactProjection(
  node: ReasoningNode,
  factById: ReadonlyMap<NodeId, PatientFact>,
  out: InvariantViolation[],
): void {
  if (node.sourceFactId === undefined) {
    if (isObservationNodeId(node.id) && node.type !== 'Observation') {
      out.push({
        invariant: 'only-observations-reference-facts',
        nodeId: node.id,
        message: `${node.type} "${node.id}" uses the observation id namespace`,
      });
    }
    return;
  }

  if (node.type !== 'Observation') {
    out.push({
      invariant: 'only-observations-reference-facts',
      nodeId: node.id,
      message: `${node.type} "${node.id}" points at fact "${node.sourceFactId}"; only Observations may project a patient fact`,
    });
    return;
  }

  const fact = factById.get(node.sourceFactId);
  if (fact === undefined) {
    out.push({
      invariant: 'premises-resolve',
      nodeId: node.id,
      factId: node.sourceFactId,
      message: `Observation "${node.id}" projects unknown fact "${node.sourceFactId}"`,
    });
    return;
  }
  if (fact.status !== 'active') {
    out.push({
      invariant: 'state-projects-active-facts-only',
      nodeId: node.id,
      factId: fact.id,
      message: `Observation "${node.id}" projects fact "${fact.id}" whose status is "${fact.status}"; a state holds only what currently holds`,
    });
  }
  if (node.id !== observationNodeId(fact.id)) {
    out.push({
      invariant: 'derived-id-is-canonical',
      nodeId: node.id,
      factId: fact.id,
      message: `Observation node id "${node.id}" is not the canonical id for fact "${fact.id}"`,
    });
  }
}

function checkPremises(
  node: ReasoningNode,
  nodeById: ReadonlyMap<NodeId, ReasoningNode>,
  out: InvariantViolation[],
): void {
  for (const premise of node.derivation?.premises ?? []) {
    if (!nodeById.has(premise.nodeId)) {
      out.push({
        invariant: 'premises-resolve',
        nodeId: node.id,
        message: `"${node.id}" depends on "${premise.nodeId}", which is not in this state`,
      });
    }
  }
}

function checkCanonicalId(node: ReasoningNode, out: InvariantViolation[]): void {
  const derivation = node.derivation;
  if (derivation === undefined) return;
  const expected = derivedNodeId(
    derivation.ruleId,
    node.conclusionKey,
    derivation.premises,
  );
  if (node.id !== expected) {
    out.push({
      invariant: 'derived-id-is-canonical',
      nodeId: node.id,
      message: `"${node.id}" is not the canonical id for its rule, conclusion and premises (expected "${expected}"); non-canonical ids make diffs meaningless`,
    });
  }
}

function checkInactiveFactIsExplained(
  fact: PatientFact,
  out: InvariantViolation[],
): void {
  if (fact.status === 'active') return;

  if (fact.statusReason === undefined || fact.statusReason.trim() === '') {
    out.push({
      invariant: 'inactive-fact-is-explained',
      factId: fact.id,
      message: `fact "${fact.id}" is "${fact.status}" without a reason; the judgement must stay on the record`,
    });
  }
  if (fact.status === 'superseded' && fact.supersededBy === undefined) {
    out.push({
      invariant: 'inactive-fact-is-explained',
      factId: fact.id,
      message: `fact "${fact.id}" is superseded but does not say by what`,
    });
  }
}

function checkAcyclic(
  state: ReasoningState,
  nodeById: ReadonlyMap<NodeId, ReasoningNode>,
  out: InvariantViolation[],
): void {
  const VISITING = 1;
  const DONE = 2;
  const marks = new Map<NodeId, number>();

  const visit = (id: NodeId, trail: readonly NodeId[]): void => {
    const mark = marks.get(id);
    if (mark === DONE) return;
    if (mark === VISITING) {
      out.push({
        invariant: 'derivation-graph-is-acyclic',
        nodeId: id,
        message: `cycle in the derivation graph: ${[...trail, id].join(' -> ')}`,
      });
      return;
    }
    marks.set(id, VISITING);
    for (const premise of nodeById.get(id)?.derivation?.premises ?? []) {
      if (nodeById.has(premise.nodeId)) visit(premise.nodeId, [...trail, id]);
    }
    marks.set(id, DONE);
  };

  for (const node of state.nodes) visit(node.id, []);
}
