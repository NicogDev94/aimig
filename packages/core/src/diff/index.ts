import type { NodeId } from '../domain/common.js';
import type {
  ChangeExplanation,
  ChangeVerdict,
  ChangedNode,
  DerivationTree,
  ReasoningDiff,
} from '../domain/diff.js';
import type { PatientFact } from '../domain/facts.js';
import type { KnowledgeBase } from '../domain/knowledge.js';
import type { Mutation } from '../domain/log.js';
import { actionsOf, findNode, type ReasoningNode, type ReasoningState } from '../domain/reasoning.js';
import { explain } from '../engine/explain.js';
import { KnowledgeIndex } from '../engine/knowledge-index.js';
import {
  attributeDeltas,
  derivedByKey,
  premiseIds,
  representative,
  sameNodeSet,
  verdictFromDeltas,
} from './pair.js';

/** One version, as the diff sees it: what held, and what it was derived from. */
export interface VersionSnapshot {
  readonly state: ReasoningState;
  readonly facts: readonly PatientFact[];
}

// ── facts ────────────────────────────────────────────────────────────────────

function diffFacts(
  before: VersionSnapshot,
  after: VersionSnapshot,
): ReasoningDiff['facts'] {
  const was = new Map(before.facts.map((f) => [f.id, f]));
  const now = new Map(after.facts.map((f) => [f.id, f]));

  const added = after.facts.filter((f) => !was.has(f.id));
  const superseded: { fact: PatientFact; by: PatientFact; reason: string }[] = [];
  const invalidated: { fact: PatientFact; reason: string }[] = [];

  for (const previous of before.facts) {
    const current = now.get(previous.id);
    if (current === undefined || current.status === previous.status) continue;

    if (current.status === 'superseded') {
      const by = current.supersededBy === undefined ? undefined : now.get(current.supersededBy);
      if (by !== undefined) {
        superseded.push({ fact: current, by, reason: current.statusReason ?? '' });
      }
    } else if (current.status === 'invalidated') {
      invalidated.push({ fact: current, reason: current.statusReason ?? '' });
    }
  }
  return { added, superseded, invalidated };
}

// ── nodes ────────────────────────────────────────────────────────────────────

/**
 * Pairs conclusions by `conclusionKey`.
 *
 * This is what a full recompute needs to stay legible. Without it, recomputing
 * renumbers every derived node and each version reads as a wholesale
 * replacement instead of "this conclusion weakened".
 *
 * A node present in both versions with the *same id* does not appear in the
 * diff at all: identical id means identical rule, conclusion and premise set,
 * so there is genuinely nothing to report.
 */
function diffNodes(
  knowledge: KnowledgeBase,
  before: VersionSnapshot,
  after: VersionSnapshot,
): ReasoningDiff['nodes'] {
  const was = derivedByKey(before.state);
  const now = derivedByKey(after.state);

  const added: ReasoningNode[] = [];
  const retracted: ReasoningNode[] = [];
  const changed: ChangedNode[] = [];

  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const previous = was.get(key) ?? [];
    const current = now.get(key) ?? [];

    if (previous.length === 0) {
      added.push(...current);
      continue;
    }
    if (current.length === 0) {
      retracted.push(...previous);
      continue;
    }
    if (sameNodeSet(previous, current)) continue;

    const a = representative(previous)!;
    const b = representative(current)!;
    const deltas = attributeDeltas(a, b);
    const beforePremises = premiseIds(a);
    const afterPremises = premiseIds(b);

    changed.push({
      conclusionKey: key,
      before: a,
      after: b,
      attributeDeltas: deltas,
      premisesLost: beforePremises.filter((id) => !afterPremises.includes(id)),
      premisesGained: afterPremises.filter((id) => !beforePremises.includes(id)),
      verdict: verdictFromDeltas(deltas, knowledge.ordinalScales),
    });
  }

  return { added, retracted, changed };
}

// ── recommendations ──────────────────────────────────────────────────────────

function diffRecommendations(
  before: VersionSnapshot,
  after: VersionSnapshot,
): ReasoningDiff['recommendations'] {
  const wasActions = actionsOf(before.state);
  const nowActions = actionsOf(after.state);

  const shared = nowActions.find((n) =>
    wasActions.some((w) => w.conclusionKey === n.conclusionKey),
  );
  const previous = shared
    ? wasActions.find((w) => w.conclusionKey === shared.conclusionKey)
    : undefined;

  const from = previous?.attributes['urgency'];
  const to = shared?.attributes['urgency'];

  return {
    before: wasActions,
    after: nowActions,
    ...(from !== undefined && to !== undefined && from !== to
      ? { urgencyDelta: { from: String(from), to: String(to) } }
      : {}),
  };
}

export function diffStates(
  knowledge: KnowledgeBase,
  before: VersionSnapshot,
  after: VersionSnapshot,
  _mutations: readonly Mutation[] = [],
): ReasoningDiff {
  return {
    facts: diffFacts(before, after),
    nodes: diffNodes(knowledge, before, after),
    recommendations: diffRecommendations(before, after),
  };
}

// ── why changed ──────────────────────────────────────────────────────────────

/** Every fact a conclusion transitively rests on. */
function factClosure(state: ReasoningState, nodeId: NodeId | undefined): Set<NodeId> {
  const facts = new Set<NodeId>();
  if (nodeId === undefined) return facts;

  const seen = new Set<NodeId>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = findNode(state, id);
    if (node === undefined) continue;
    if (node.sourceFactId !== undefined) facts.add(node.sourceFactId);
    for (const premise of node.derivation?.premises ?? []) queue.push(premise.nodeId);
  }
  return facts;
}

function nodeClosure(state: ReasoningState, nodeId: NodeId | undefined): ReasoningNode[] {
  const out: ReasoningNode[] = [];
  if (nodeId === undefined) return out;
  const seen = new Set<NodeId>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = findNode(state, id);
    if (node === undefined) continue;
    out.push(node);
    for (const premise of node.derivation?.premises ?? []) queue.push(premise.nodeId);
  }
  return out;
}

/**
 * Which mutations actually caused this conclusion to move.
 *
 * A mutation qualifies only if the fact it touches lies on a dependency path to
 * the conclusion — in the version where that path existed. This is what stops
 * an unrelated correction from being cited as a cause: the `no-change`
 * category is precisely the assertion that this filter is causal rather than
 * chronological.
 *
 * A supersession also carries its replacement, because "eGFR 28 was superseded
 * by eGFR 55" is one explanation, not two — and the replacement may itself
 * conclude nothing at all.
 */
function causedBy(
  mutations: readonly Mutation[],
  beforeFacts: ReadonlySet<NodeId>,
  afterFacts: ReadonlySet<NodeId>,
): Mutation[] {
  return mutations.filter((mutation) => {
    switch (mutation.op) {
      case 'add_fact':
        return afterFacts.has(mutation.fact.id);
      case 'invalidate_fact':
        return beforeFacts.has(mutation.factId);
      case 'supersede_fact':
        return (
          beforeFacts.has(mutation.factId) ||
          afterFacts.has(mutation.factId) ||
          afterFacts.has(mutation.by)
        );
    }
  });
}

export function whyChanged(
  knowledge: KnowledgeBase,
  before: VersionSnapshot,
  after: VersionSnapshot,
  mutations: readonly Mutation[],
  conclusionKey: string,
): ChangeExplanation {
  const index = new KnowledgeIndex(knowledge);
  const was = representative(derivedByKey(before.state).get(conclusionKey) ?? []);
  const now = representative(derivedByKey(after.state).get(conclusionKey) ?? []);

  const verdict = ((): ChangeVerdict => {
    if (was === undefined && now === undefined) return 'unchanged';
    if (was === undefined) return 'added';
    if (now === undefined) return 'retracted';
    if (was.id === now.id) return 'unchanged';
    return verdictFromDeltas(attributeDeltas(was, now), knowledge.ordinalScales);
  })();

  const beforeClosure = factClosure(before.state, was?.id);
  const afterClosure = factClosure(after.state, now?.id);
  const responsible = causedBy(mutations, beforeClosure, afterClosure);

  // Only the part of the reasoning that actually moved is cited. Everything
  // that held before and still holds is not an explanation of a change.
  const wasNodes = nodeClosure(before.state, was?.id);
  const nowNodes = nodeClosure(after.state, now?.id);
  const wasIds = new Set(wasNodes.map((n) => n.id));
  const nowIds = new Set(nowNodes.map((n) => n.id));
  const moved = [
    ...wasNodes.filter((n) => !nowIds.has(n.id)),
    ...nowNodes.filter((n) => !wasIds.has(n.id)),
  ];

  const knowledgeIds = [...new Set(moved.flatMap((n) => n.derivation?.knowledgeUsed ?? []))];
  const rulesRefired = [
    ...new Set(moved.flatMap((n) => (n.derivation ? [n.derivation.ruleId] : []))),
  ].sort();

  const lostIds = premiseIds(was).filter((id) => !premiseIds(now).includes(id));
  const gainedIds = premiseIds(now).filter((id) => !premiseIds(was).includes(id));
  const tree = (state: ReasoningState, id: NodeId): DerivationTree[] => {
    try {
      return [explain(knowledge, state, id, index)];
    } catch {
      return [];
    }
  };

  return {
    target: conclusionKey,
    causedBy: responsible,
    premisesLost: lostIds.flatMap((id) => tree(before.state, id)),
    premisesGained: gainedIds.flatMap((id) => tree(after.state, id)),
    rulesRefired,
    knowledgeCited: index.assertions(knowledgeIds),
    evidenceCited: index.evidence(knowledgeIds),
    verdict,
  };
}
