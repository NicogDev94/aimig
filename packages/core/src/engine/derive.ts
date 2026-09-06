import type { NodeId, Version } from '../domain/common.js';
import type { PatientFact } from '../domain/facts.js';
import { derivedNodeId, observationNodeId } from '../domain/ids.js';
import type { KnowledgeBase } from '../domain/knowledge.js';
import type { ReasoningNode, ReasoningState } from '../domain/reasoning.js';
import { RULES } from './rules/index.js';
import type { RuleContext, RuleOutput } from './rule-kinds.js';

const MAX_PASSES = 10;

/** Projects the facts that currently hold into the reasoning layer. */
function observationNodes(facts: readonly PatientFact[]): ReasoningNode[] {
  return facts
    .filter((f) => f.status === 'active')
    .map((fact) => ({
      id: observationNodeId(fact.id),
      type: 'Observation' as const,
      conclusionKey: `observation:${fact.concept.code}:${fact.id}`,
      label:
        fact.value?.kind === 'quantity'
          ? `${fact.concept.display} ${fact.value.num} ${fact.value.unit}`
          : fact.concept.display,
      attributes: {
        concept: fact.concept.code,
        observedAt: fact.observedAt,
        ...(fact.value?.kind === 'quantity'
          ? { value: fact.value.num, unit: fact.value.unit }
          : {}),
      },
      sourceFactId: fact.id,
    }));
}

function toNode(output: RuleOutput): ReasoningNode {
  return {
    id: derivedNodeId(output.ruleId, output.conclusionKey, output.premises),
    type: output.type,
    conclusionKey: output.conclusionKey,
    label: output.label,
    attributes: output.attributes,
    derivation: {
      ruleId: output.ruleId,
      premises: output.premises,
      knowledgeUsed: output.knowledgeUsed,
    },
  };
}

function fingerprint(nodes: readonly ReasoningNode[]): string {
  return nodes
    .map((n) => n.id)
    .sort()
    .join('\n');
}

function onePass(
  knowledge: KnowledgeBase,
  facts: readonly PatientFact[],
  observations: readonly ReasoningNode[],
  seed: readonly ReasoningNode[],
): ReasoningNode[] {
  // Rules SEE the previous pass's conclusions, so an out-of-order rule set
  // still converges instead of silently under-deriving...
  const visible = new Map<NodeId, ReasoningNode>(
    [...observations, ...seed].map((n) => [n.id, n]),
  );
  // ...but only what this pass actually re-derives is KEPT. That is what makes
  // a partial result disappear: an aggregate computed before all of its
  // contributions existed is simply not produced again once they do, so it
  // cannot reach the fixed point.
  const kept = new Map<NodeId, ReasoningNode>(observations.map((n) => [n.id, n]));
  const activeFacts = facts.filter((f) => f.status === 'active');

  const ctx: RuleContext = {
    knowledge,
    facts: activeFacts,
    get nodes() {
      return [...visible.values()];
    },
    observationNodeOf: (factId) => visible.get(observationNodeId(factId)),
    nodesWithKey: (key) => [...visible.values()].filter((n) => n.conclusionKey === key),
  };

  // Rules run in dependency order within a pass, so a rule sees what earlier
  // rules concluded from the same facts. The outer loop then confirms the
  // result is stable.
  for (const rule of RULES) {
    for (const output of rule.fire(ctx)) {
      const node = toNode(output);
      kept.set(node.id, node);
      visible.set(node.id, node);
    }
  }
  return [...kept.values()];
}

/**
 * `ReasoningState(v) = derive(knowledge, factsAt(v))`.
 *
 * Each pass **rebuilds** the derived set from the observations rather than
 * accumulating onto the previous one. That is what keeps partial results from
 * surviving: an aggregate computed before all of its contributions existed
 * simply is not produced again once they do, so it never reaches the fixed
 * point. Accumulating instead would leave both the partial and the complete
 * node in the state, and every diff would be noise.
 *
 * Pure: no clock, no I/O, no randomness, no LLM. Same inputs, same state,
 * byte for byte — which is what makes any past version recomputable from the
 * log alone.
 */
export function derive(
  knowledge: KnowledgeBase,
  facts: readonly PatientFact[],
  version: Version = 0,
): ReasoningState {
  const observations = observationNodes(facts);

  let current: ReasoningNode[] = observations;
  let previous = fingerprint(current);

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = onePass(knowledge, facts, observations, current);
    const signature = fingerprint(next);
    if (signature === previous) {
      return { version, knowledgeVersion: knowledge.version, nodes: sorted(next) };
    }
    previous = signature;
    current = next;
  }

  throw new Error(
    `derivation did not reach a fixed point in ${MAX_PASSES} passes (${current.length} nodes); the rule set may be non-monotone`,
  );
}

/** Stable order, so two derivations of the same inputs are identical values. */
function sorted(nodes: readonly ReasoningNode[]): ReasoningNode[] {
  return [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
