import type { NodeId, Version } from './common.js';

/**
 * `Evidence` is deliberately absent from this union in Milestone 0.
 *
 * Nothing produces an Evidence node: evidence reaches explanations through
 * `Derivation.knowledgeUsed` resolved to `EvidenceRef[]`. A union member no
 * rule can emit is a permanent source of "why is this never produced?", so it
 * is left out until a real need for patient-specific evidence appears.
 */
export type ReasoningNodeType =
  | 'Observation'
  | 'Hypothesis'
  | 'Claim'
  | 'Action'
  | 'Question'
  | 'Conflict';

/**
 * `supersedes` is deliberately absent: supersession is a layer-2 fact,
 * already modelled by `PatientFact.supersededBy`. A layer-3 edge would
 * duplicate it.
 */
export type ReasoningEdgeType =
  | 'derived_from'
  | 'supports'
  | 'contradicts'
  | 'increases_likelihood'
  | 'recommends'
  | 'requires';

/** One premise of a derivation, carrying the semantics of the link. */
export interface Premise {
  readonly nodeId: NodeId;
  readonly edgeType: ReasoningEdgeType;
}

/**
 * The record of how a node was produced.
 *
 * Rules return their premises rather than declaring them separately, so the
 * dependency graph is a by-product of firing and cannot drift from what
 * actually happened.
 */
export interface Derivation {
  readonly ruleId: string;
  readonly premises: readonly Premise[];
  /** Ids of the `KnowledgeAssertion` / `ThresholdBand` / `ActionRule` used. */
  readonly knowledgeUsed: readonly string[];
}

/**
 * A node of the reasoning graph.
 *
 * There is no `status` field. A reasoning state contains exactly the nodes
 * that hold in that version; a node that stops holding simply is not there.
 * `retracted` is a category of `ReasoningDiff`, not a state of a node — and
 * nothing is lost by that, because any earlier version can be re-derived from
 * the log on demand.
 */
export interface ReasoningNode {
  readonly id: NodeId;
  readonly type: ReasoningNodeType;
  /** Stable identity of *what is concluded*, independent of the premises used. */
  readonly conclusionKey: string;
  readonly label: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  /** Present on every node except `Observation`. */
  readonly derivation?: Derivation;
  /** Present only on `Observation`, pointing at the active fact it projects. */
  readonly sourceFactId?: NodeId;
}

export interface ReasoningState {
  readonly version: Version;
  readonly knowledgeVersion: string;
  readonly nodes: readonly ReasoningNode[];
}

export function findNode(
  state: ReasoningState,
  id: NodeId,
): ReasoningNode | undefined {
  return state.nodes.find((n) => n.id === id);
}

export function nodesByConclusionKey(
  state: ReasoningState,
  conclusionKey: string,
): readonly ReasoningNode[] {
  return state.nodes.filter((n) => n.conclusionKey === conclusionKey);
}

/** The recommendations of a state, in stable order. */
export function actionsOf(state: ReasoningState): readonly ReasoningNode[] {
  return state.nodes.filter((n) => n.type === 'Action');
}
