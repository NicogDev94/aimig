import {
  derivedNodeId,
  observationNodeId,
  quantity,
  type ConceptRef,
  type PatientFact,
  type Premise,
  type ReasoningNode,
  type ReasoningState,
} from '../src/index.js';

export function concept(code: string, display = code): ConceptRef {
  return { system: 'aimig-local', code, display };
}

export function fact(over: Partial<PatientFact> & { id: string }): PatientFact {
  return {
    kind: 'observation',
    concept: concept('potassium'),
    value: quantity(5.8, 'mmol/L'),
    observedAt: '2024-03-01',
    recordedAt: '2024-03-01',
    status: 'active',
    provenance: { origin: 'fixture', actor: 'test' },
    ...over,
  };
}

export function observationNode(f: PatientFact): ReasoningNode {
  return {
    id: observationNodeId(f.id),
    type: 'Observation',
    conclusionKey: `observation:${f.concept.code}`,
    label: f.concept.display,
    attributes: {},
    sourceFactId: f.id,
  };
}

export function derivedNode(
  over: Partial<ReasoningNode> & {
    ruleId: string;
    conclusionKey: string;
    premises: readonly Premise[];
  },
): ReasoningNode {
  const { ruleId, conclusionKey, premises, ...rest } = over;
  return {
    id: derivedNodeId(ruleId, conclusionKey, premises),
    type: 'Claim',
    conclusionKey,
    label: conclusionKey,
    attributes: {},
    derivation: { ruleId, premises, knowledgeUsed: [] },
    ...rest,
  };
}

export function state(nodes: readonly ReasoningNode[]): ReasoningState {
  return { version: 1, knowledgeVersion: 'test-kb', nodes };
}

export function supports(nodeId: string): Premise {
  return { nodeId, edgeType: 'supports' };
}
