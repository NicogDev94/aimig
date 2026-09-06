import { describe, expect, it } from 'vitest';
import {
  AIMIG_KB_V0 as KB,
  CONCEPTS,
  InMemoryReasoningStore,
  applyCorrection,
  createEngine,
  diffStates,
  explain,
  openCase,
  quantity,
  runCorrectionDemo,
  stateAt,
  whyChanged,
  type CaseContext,
  type Mutation,
  type PatientFact,
  type ReasoningNode,
} from '../src/index.js';

/**
 * The ten steps of Milestone 0, end to end and headless.
 *
 * This is the acceptance test of the milestone. It deliberately uses no UI:
 * if the value of an explicit reasoning state is not legible here, no
 * interface will rescue it.
 */

const facts: PatientFact[] = [
  {
    id: 'med-spiro',
    kind: 'medication',
    concept: CONCEPTS.spironolactone,
    observedAt: '2024-01-10',
    recordedAt: '2024-01-10',
    status: 'active',
    provenance: { origin: 'manual', actor: 'test' },
  },
  {
    id: 'obs-k-58',
    kind: 'observation',
    concept: CONCEPTS.potassium,
    value: quantity(5.8, 'mmol/L'),
    observedAt: '2024-03-01',
    recordedAt: '2024-03-01',
    status: 'active',
    provenance: { origin: 'manual', actor: 'test' },
  },
  {
    id: 'obs-egfr-28',
    kind: 'observation',
    concept: CONCEPTS.egfr,
    value: quantity(28, 'mL/min'),
    observedAt: '2023-06-14',
    recordedAt: '2023-06-14',
    status: 'active',
    provenance: { origin: 'manual', actor: 'test' },
  },
];

const correction: Mutation[] = [
  {
    op: 'add_fact',
    fact: {
      id: 'obs-egfr-55',
      kind: 'observation',
      concept: CONCEPTS.egfr,
      value: quantity(55, 'mL/min'),
      observedAt: '2024-02-20',
      recordedAt: '2024-03-10',
      status: 'active',
      provenance: { origin: 'manual', actor: 'test' },
    },
  },
  {
    op: 'supersede_fact',
    factId: 'obs-egfr-28',
    by: 'obs-egfr-55',
    reason: 'value came from a resolved acute episode',
  },
];

async function run() {
  const ctx: CaseContext = {
    store: new InMemoryReasoningStore(),
    engine: createEngine(),
    knowledge: KB,
  };
  await openCase(ctx, 'canonical', facts, {
    author: 'test',
    at: '2024-03-01T09:00:00Z',
    intent: 'open the case',
  });
  const applied = await applyCorrection(ctx, 'canonical', {
    intent: 'eGFR 28 came from a resolved acute episode; the latest reliable value is 55',
    author: 'test',
    at: '2024-03-10T09:00:00Z',
    mutations: correction,
  });
  return { ctx, ...applied };
}

const key = (nodes: readonly ReasoningNode[], k: string): ReasoningNode | undefined =>
  nodes.find((n) => n.conclusionKey === k);

describe('The Correction Demo', () => {
  it('1 · loads spironolactone + K 5.8 + eGFR 28', async () => {
    const { before } = await run();
    expect(before.facts.map((f) => f.id).sort()).toEqual([
      'med-spiro',
      'obs-egfr-28',
      'obs-k-58',
    ]);
  });

  it('2 · states the initial recommendation as medication_review, urgency HIGH', async () => {
    const { before } = await run();
    const action = key(before.state.nodes, 'action:medication_review');
    expect(action?.attributes['actionKey']).toBe('medication_review');
    expect(action?.attributes['urgency']).toBe('HIGH');
  });

  it('3 · exposes the premises, the rules, the knowledge and the evidence', async () => {
    const { ctx, before } = await run();
    const action = key(before.state.nodes, 'action:medication_review')!;
    const tree = explain(KB, before.state, action.id);
    const flatten = (t: typeof tree): (typeof tree)[] => [t, ...t.premises.flatMap(flatten)];
    const all = flatten(tree);

    expect(
      all.filter((t) => t.node.type === 'Observation').map((t) => t.node.sourceFactId).sort(),
    ).toEqual(['med-spiro', 'obs-egfr-28', 'obs-k-58']);
    expect(new Set(all.flatMap((t) => (t.ruleId ? [t.ruleId] : [])))).toContain('threshold.egfr');
    expect(all.flatMap((t) => t.knowledgeUsed.map((k) => k.id))).toContain('ka-renal-hyperk');
    expect(all.flatMap((t) => t.evidence.map((e) => e.id))).toContain('ev-syn-06');
    expect(ctx.knowledge.validation.clinicalValidity).toBe('unvalidated');
  });

  it('4 · records the correction with a mandatory human reason', async () => {
    const { commit, after } = await run();
    expect(commit.intent).toMatch(/acute episode/);
    const old = after.facts.find((f) => f.id === 'obs-egfr-28')!;
    expect(old.status).toBe('superseded');
    expect(old.supersededBy).toBe('obs-egfr-55');
    expect(old.statusReason).toBe('value came from a resolved acute episode');
  });

  it('5 · lists the affected dependencies and excludes hyperkalemia', async () => {
    const { ctx, before } = await run();
    const reached = ctx.engine
      .affectedBy(before.state, 'obs-egfr-28')
      .map((id) => before.state.nodes.find((n) => n.id === id)!.conclusionKey);

    expect(reached).toEqual(
      expect.arrayContaining([
        'renal_impairment',
        'contribution:hyperkalemia:renal_impairment',
        'hyperkalemia_concern',
        'action:medication_review',
      ]),
    );
    // Hyperkalemia rests on the potassium result alone. Reporting it as
    // affected would be the system crying wolf about its own reasoning.
    expect(reached).not.toContain('hyperkalemia');
    expect(reached).not.toContain('contribution:hyperkalemia:spironolactone');
  });

  it('6 · shows the new reasoning state with no ghost nodes', async () => {
    const { after } = await run();
    expect(after.state.nodes.some((n) => n.sourceFactId === 'obs-egfr-28')).toBe(false);
    expect(key(after.state.nodes, 'renal_impairment')?.attributes['severity']).toBe('moderate');
    // The superseded fact is still fully on the record — in layer 2.
    expect(after.facts.find((f) => f.id === 'obs-egfr-28')).toBeDefined();
  });

  it('7 · recomputes the recommendation to MODERATE', async () => {
    const { after } = await run();
    expect(key(after.state.nodes, 'action:medication_review')?.attributes['urgency']).toBe(
      'MODERATE',
    );
  });

  it('8 · produces a diff of superseded, added, retracted and changed', async () => {
    const { before, after, commit } = await run();
    const diff = diffStates(KB, before, after, commit.mutations);

    expect(diff.facts.superseded.map((s) => [s.fact.id, s.by.id])).toEqual([
      ['obs-egfr-28', 'obs-egfr-55'],
    ]);
    expect(diff.facts.added.map((f) => f.id)).toEqual(['obs-egfr-55']);
    expect(diff.nodes.retracted).toEqual([]);
    expect(diff.nodes.changed.map((c) => c.conclusionKey).sort()).toEqual([
      'action:medication_review',
      'contribution:hyperkalemia:renal_impairment',
      'hyperkalemia_concern',
      'renal_impairment',
    ]);
    expect(diff.recommendations.urgencyDelta).toEqual({ from: 'HIGH', to: 'MODERATE' });
    // Untouched conclusions do not appear in the diff at all.
    expect(diff.nodes.changed.map((c) => c.conclusionKey)).not.toContain('hyperkalemia');
  });

  it('9 · answers "why did this recommendation change?"', async () => {
    const { before, after, commit } = await run();
    const why = whyChanged(KB, before, after, commit.mutations, 'action:medication_review');
    expect(why.verdict).toBe('weakened');
  });

  it('10 · builds that answer from the mutations and the real dependencies', async () => {
    const { before, after, commit } = await run();
    const why = whyChanged(KB, before, after, commit.mutations, 'action:medication_review');

    const namedFacts = why.causedBy.flatMap((m) =>
      m.op === 'add_fact' ? [m.fact.id] : m.op === 'supersede_fact' ? [m.factId, m.by] : [m.factId],
    );
    expect(namedFacts).toContain('obs-egfr-28');
    expect(namedFacts).toContain('obs-egfr-55');
    // The potassium result did not move, so it is not part of the explanation.
    expect(namedFacts).not.toContain('obs-k-58');

    expect(why.rulesRefired).toContain('threshold.egfr');
    expect(why.knowledgeCited.map((k) => k.id)).toContain('ka-renal-hyperk');
    expect(why.evidenceCited.map((e) => e.id)).toEqual(
      expect.arrayContaining(['ev-syn-04', 'ev-syn-06']),
    );
    expect(why.premisesLost).not.toHaveLength(0);
    expect(why.premisesGained).not.toHaveLength(0);
  });
});

describe('the demo', () => {
  it('renders the whole scenario, carrying its validation notice', async () => {
    const output = await runCorrectionDemo();
    expect(output).toContain('Not clinically validated. Not for clinical use.');
    expect(output).toContain('urgency HIGH');
    expect(output).toContain('Recommendation urgency HIGH -> MODERATE');
    expect(output).toContain('obs-egfr-28 by obs-egfr-55');
    expect(output).toContain('verdict: weakened');
    expect(output).toContain('ev-syn-06');
  });

  it('is reproducible — no clock, no randomness', async () => {
    expect(await runCorrectionDemo()).toBe(await runCorrectionDemo());
  });
});

describe('any earlier version', () => {
  it('is recomputed from the log rather than stored', async () => {
    const { ctx } = await run();
    const v1 = await stateAt(ctx, 'canonical', 1);
    const v2 = await stateAt(ctx, 'canonical', 2);
    expect(key(v1.state.nodes, 'action:medication_review')?.attributes['urgency']).toBe('HIGH');
    expect(key(v2.state.nodes, 'action:medication_review')?.attributes['urgency']).toBe('MODERATE');
  });
});
