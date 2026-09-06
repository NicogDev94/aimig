import { describe, expect, it } from 'vitest';
import { checkInvariants, observationNodeId } from '../src/index.js';
import type { InvariantId } from '../src/index.js';
import { derivedNode, fact, observationNode, state, supports } from './helpers.js';

function ids(violations: { invariant: InvariantId }[]): InvariantId[] {
  return violations.map((v) => v.invariant);
}

describe('a valid state', () => {
  it('reports no violation', () => {
    const k = fact({ id: 'obs-k-58' });
    const obs = observationNode(k);
    const claim = derivedNode({
      ruleId: 'threshold.potassium',
      conclusionKey: 'hyperkalemia',
      premises: [supports(obs.id)],
    });
    expect(checkInvariants(state([obs, claim]), [k])).toEqual([]);
  });
});

describe('invariant 1 - an Observation is never implicitly a Hypothesis', () => {
  it('rejects an Observation that carries a derivation', () => {
    const k = fact({ id: 'obs-k-58' });
    const bad = { ...observationNode(k), derivation: { ruleId: 'r', premises: [], knowledgeUsed: [] } };
    expect(ids(checkInvariants(state([bad]), [k]))).toContain('observation-is-not-derived');
  });

  it('rejects an Observation with no source fact', () => {
    const k = fact({ id: 'obs-k-58' });
    const { sourceFactId: _drop, ...bad } = observationNode(k);
    expect(ids(checkInvariants(state([bad]), [k]))).toContain('observation-is-not-derived');
  });

  it('rejects a Hypothesis with no derivation', () => {
    const bad = {
      id: 'h1',
      type: 'Hypothesis' as const,
      conclusionKey: 'risk',
      label: 'risk',
      attributes: {},
    };
    expect(ids(checkInvariants(state([bad]), []))).toContain('derived-node-has-derivation');
  });
});

describe('invariant 2 - a Hypothesis is never presented as a patient fact', () => {
  it('rejects a derived node that points at a patient fact', () => {
    const k = fact({ id: 'obs-k-58' });
    const obs = observationNode(k);
    const bad = {
      ...derivedNode({
        ruleId: 'threshold.potassium',
        conclusionKey: 'hyperkalemia',
        premises: [supports(obs.id)],
      }),
      type: 'Hypothesis' as const,
      sourceFactId: k.id,
    };
    expect(ids(checkInvariants(state([obs, bad]), [k]))).toContain(
      'only-observations-reference-facts',
    );
  });

  it('rejects a derived node squatting the observation id namespace', () => {
    const bad = {
      id: observationNodeId('obs-k-58'),
      type: 'Claim' as const,
      conclusionKey: 'hyperkalemia',
      label: 'hyperkalemia',
      attributes: {},
      derivation: { ruleId: 'r', premises: [supports('x')], knowledgeUsed: [] },
    };
    expect(ids(checkInvariants(state([bad]), []))).toContain(
      'only-observations-reference-facts',
    );
  });
});

describe('invariant 3 - superseded information stays on the record', () => {
  it('rejects a superseded fact with no reason', () => {
    const f = fact({ id: 'obs-egfr-28', status: 'superseded', supersededBy: 'obs-egfr-55' });
    expect(ids(checkInvariants(state([]), [f]))).toContain('inactive-fact-is-explained');
  });

  it('rejects a superseded fact that does not say by what', () => {
    const f = fact({ id: 'obs-egfr-28', status: 'superseded', statusReason: 'acute episode' });
    expect(ids(checkInvariants(state([]), [f]))).toContain('inactive-fact-is-explained');
  });

  it('rejects an invalidated fact with no reason', () => {
    const f = fact({ id: 'obs-egfr-28', status: 'invalidated' });
    expect(ids(checkInvariants(state([]), [f]))).toContain('inactive-fact-is-explained');
  });

  it('accepts a fully explained supersession', () => {
    const f = fact({
      id: 'obs-egfr-28',
      status: 'superseded',
      supersededBy: 'obs-egfr-55',
      statusReason: 'value came from a resolved acute episode',
    });
    expect(checkInvariants(state([]), [f])).toEqual([]);
  });
});

describe('invariant 4 - a conclusion is linked to its premises', () => {
  it('rejects a derivation with no premises', () => {
    const bad = derivedNode({ ruleId: 'r', conclusionKey: 'c', premises: [] });
    expect(ids(checkInvariants(state([bad]), []))).toContain('derivation-has-premises');
  });

  it('rejects a premise that is not in the state', () => {
    const bad = derivedNode({
      ruleId: 'r',
      conclusionKey: 'c',
      premises: [supports('ghost')],
    });
    expect(ids(checkInvariants(state([bad]), []))).toContain('premises-resolve');
  });
});

describe('D2bis - a state holds only what currently holds', () => {
  it('rejects an Observation projecting a superseded fact', () => {
    const f = fact({
      id: 'obs-egfr-28',
      status: 'superseded',
      supersededBy: 'obs-egfr-55',
      statusReason: 'acute episode',
    });
    expect(ids(checkInvariants(state([observationNode(f)]), [f]))).toContain(
      'state-projects-active-facts-only',
    );
  });

  it('rejects an Observation projecting an unknown fact', () => {
    const f = fact({ id: 'obs-ghost' });
    expect(ids(checkInvariants(state([observationNode(f)]), []))).toContain(
      'premises-resolve',
    );
  });
});

describe('D3 - derived identity is canonical', () => {
  it('rejects a derived node whose id does not match rule, conclusion and premises', () => {
    const k = fact({ id: 'obs-k-58' });
    const obs = observationNode(k);
    const bad = {
      ...derivedNode({
        ruleId: 'threshold.potassium',
        conclusionKey: 'hyperkalemia',
        premises: [supports(obs.id)],
      }),
      id: 'hand-written-id',
    };
    expect(ids(checkInvariants(state([obs, bad]), [k]))).toContain('derived-id-is-canonical');
  });

  it('rejects an Observation node with a non-canonical id', () => {
    const k = fact({ id: 'obs-k-58' });
    const bad = { ...observationNode(k), id: 'obs#wrong' };
    expect(ids(checkInvariants(state([bad]), [k]))).toContain('derived-id-is-canonical');
  });
});

describe('structural integrity', () => {
  it('rejects duplicate node ids', () => {
    const k = fact({ id: 'obs-k-58' });
    const obs = observationNode(k);
    expect(ids(checkInvariants(state([obs, obs]), [k]))).toContain('node-ids-are-unique');
  });

  it('rejects a cycle in the derivation graph', () => {
    const a = {
      id: 'a',
      type: 'Claim' as const,
      conclusionKey: 'a',
      label: 'a',
      attributes: {},
      derivation: { ruleId: 'r', premises: [supports('b')], knowledgeUsed: [] },
    };
    const b = {
      id: 'b',
      type: 'Claim' as const,
      conclusionKey: 'b',
      label: 'b',
      attributes: {},
      derivation: { ruleId: 'r', premises: [supports('a')], knowledgeUsed: [] },
    };
    expect(ids(checkInvariants(state([a, b]), []))).toContain('derivation-graph-is-acyclic');
  });
});

describe('reporting', () => {
  it('returns every violation rather than the first', () => {
    const orphan = derivedNode({ ruleId: 'r', conclusionKey: 'c', premises: [] });
    const unexplained = fact({ id: 'f', status: 'invalidated' });
    const found = ids(checkInvariants(state([orphan]), [unexplained]));
    expect(found).toContain('derivation-has-premises');
    expect(found).toContain('inactive-fact-is-explained');
  });
});
