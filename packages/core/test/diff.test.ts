import { describe, expect, it } from 'vitest';
import {
  AIMIG_KB_V0 as KB,
  CONCEPTS,
  applyMutations,
  derive,
  diffStates,
  quantity,
  whyChanged,
  type KnowledgeBase,
  type Mutation,
  type PatientFact,
} from '../src/index.js';

function fact(
  id: string,
  concept: keyof typeof CONCEPTS,
  value?: [number, string],
  observedAt = '2024-03-01',
): PatientFact {
  return {
    id,
    kind: value === undefined ? 'medication' : 'observation',
    concept: CONCEPTS[concept],
    ...(value === undefined ? {} : { value: quantity(value[0], value[1]) }),
    observedAt,
    recordedAt: observedAt,
    status: 'active',
    provenance: { origin: 'fixture', actor: 'test' },
  };
}

function change(facts: PatientFact[], mutations: Mutation[], kb: KnowledgeBase = KB) {
  const nextFacts = applyMutations(facts, mutations);
  const before = { state: derive(kb, facts, 1), facts };
  const after = { state: derive(kb, nextFacts, 2), facts: nextFacts };
  return {
    before,
    after,
    diff: diffStates(kb, before, after, mutations),
    why: (key: string) => whyChanged(kb, before, after, mutations, key),
  };
}

const SPIRO_K = [fact('med-spiro', 'spironolactone'), fact('obs-k-58', 'potassium', [5.8, 'mmol/L'])];

describe('pairing by conclusion key', () => {
  it('reports a change rather than a replacement when the premises move', () => {
    const { diff } = change(
      [fact('e', 'egfr', [28, 'mL/min'])],
      [
        { op: 'add_fact', fact: fact('e2', 'egfr', [55, 'mL/min']) },
        { op: 'supersede_fact', factId: 'e', by: 'e2', reason: 'resolved acute episode' },
      ],
    );
    expect(diff.nodes.changed.map((c) => c.conclusionKey)).toContain('renal_impairment');
    expect(diff.nodes.added.map((n) => n.conclusionKey)).not.toContain('renal_impairment');
    expect(diff.nodes.retracted.map((n) => n.conclusionKey)).not.toContain('renal_impairment');
  });

  it('reports a retraction when the conclusion no longer holds', () => {
    const { diff } = change(
      [fact('e', 'egfr', [28, 'mL/min'])],
      [
        { op: 'add_fact', fact: fact('e2', 'egfr', [85, 'mL/min']) },
        { op: 'supersede_fact', factId: 'e', by: 'e2', reason: 'recovered' },
      ],
    );
    expect(diff.nodes.retracted.map((n) => n.conclusionKey)).toContain('renal_impairment');
  });

  it('reports an addition when a conclusion appears', () => {
    const { diff } = change(
      [fact('m', 'spironolactone')],
      [{ op: 'add_fact', fact: fact('k', 'potassium', [5.8, 'mmol/L']) }],
    );
    expect(diff.nodes.added.map((n) => n.conclusionKey)).toContain('hyperkalemia');
  });

  it('says nothing about a node whose id is unchanged', () => {
    const { diff } = change(SPIRO_K, [
      { op: 'add_fact', fact: fact('w', 'weight', [80, 'kg']) },
    ]);
    expect(diff.nodes.added).toEqual([]);
    expect(diff.nodes.retracted).toEqual([]);
    expect(diff.nodes.changed).toEqual([]);
  });
});

describe('the verdict', () => {
  it('reads a direction off a declared ordinal scale', () => {
    const { diff } = change(
      [fact('k', 'potassium', [6.2, 'mmol/L'])],
      [
        { op: 'add_fact', fact: fact('k2', 'potassium', [5.2, 'mmol/L']) },
        { op: 'supersede_fact', factId: 'k', by: 'k2', reason: 'transcription error' },
      ],
    );
    expect(diff.nodes.changed.find((c) => c.conclusionKey === 'hyperkalemia')?.verdict).toBe(
      'weakened',
    );
  });

  it('falls back to "changed" when no attribute has a declared scale', () => {
    // Only `score` moves here, and score is deliberately not ordinal-scaled.
    const { diff } = change(
      [...SPIRO_K, fact('r', 'ramipril')],
      [{ op: 'invalidate_fact', factId: 'r', reason: 'wrong patient' }],
    );
    expect(diff.nodes.changed.find((c) => c.conclusionKey === 'hyperkalemia_concern')?.verdict).toBe(
      'changed',
    );
  });

  it('never invents an ordering it was not given', () => {
    const noScales: KnowledgeBase = { ...KB, ordinalScales: [] };
    const { diff } = change(
      [fact('k', 'potassium', [6.2, 'mmol/L'])],
      [
        { op: 'add_fact', fact: fact('k2', 'potassium', [5.2, 'mmol/L']) },
        { op: 'supersede_fact', factId: 'k', by: 'k2', reason: 'transcription error' },
      ],
      noScales,
    );
    expect(diff.nodes.changed.every((c) => c.verdict === 'changed')).toBe(true);
  });
});

describe('why changed', () => {
  it('cites the mutation that moved the conclusion', () => {
    const { why } = change(SPIRO_K, [
      { op: 'invalidate_fact', factId: 'obs-k-58', reason: 'laboratory error' },
    ]);
    expect(why('hyperkalemia_concern').causedBy).toHaveLength(1);
  });

  it('cites a supersession together with its replacement', () => {
    // "eGFR 28 was superseded by eGFR 55" is one explanation, not two — and the
    // replacement here concludes nothing at all, yet still explains the change.
    const { why } = change(
      [fact('e', 'egfr', [28, 'mL/min'])],
      [
        { op: 'add_fact', fact: fact('e2', 'egfr', [85, 'mL/min']) },
        { op: 'supersede_fact', factId: 'e', by: 'e2', reason: 'recovered' },
      ],
    );
    const named = why('renal_impairment').causedBy.flatMap((m) =>
      m.op === 'supersede_fact' ? [m.factId, m.by] : [],
    );
    expect(named).toEqual(['e', 'e2']);
  });

  it('does not cite a mutation with no dependency path to the conclusion', () => {
    const both = [
      ...SPIRO_K,
      fact('w', 'warfarin'),
      fact('a', 'amiodarone'),
      fact('i', 'inr', [3.5, 'ratio']),
    ];
    const { why } = change(both, [
      { op: 'invalidate_fact', factId: 'obs-k-58', reason: 'laboratory error' },
    ]);
    // The filter is causal, not chronological: the correction is recent, but it
    // is not part of why the bleeding conclusion holds.
    expect(why('bleeding_concern').causedBy).toEqual([]);
    expect(why('bleeding_concern').verdict).toBe('unchanged');
  });

  it('cites only the part of the reasoning that actually moved', () => {
    const { why } = change(
      [...SPIRO_K, fact('e', 'egfr', [28, 'mL/min'])],
      [
        { op: 'add_fact', fact: fact('e2', 'egfr', [55, 'mL/min']) },
        { op: 'supersede_fact', factId: 'e', by: 'e2', reason: 'resolved acute episode' },
      ],
    );
    const cited = why('hyperkalemia_concern').knowledgeCited.map((k) => k.id);
    expect(cited).toContain('ka-renal-hyperk');
    // The spironolactone edge held before and still holds, so it explains
    // nothing about the change.
    expect(cited).not.toContain('ka-spiro-hyperk');
  });

  it('reports an unknown conclusion as unchanged rather than throwing', () => {
    const { why } = change(SPIRO_K, [
      { op: 'add_fact', fact: fact('w', 'weight', [80, 'kg']) },
    ]);
    expect(why('nothing_like_this').verdict).toBe('unchanged');
  });
});

describe('the facts section', () => {
  it('separates additions, supersessions and invalidations', () => {
    const { diff } = change(SPIRO_K, [
      { op: 'add_fact', fact: fact('k2', 'potassium', [4.2, 'mmol/L'], '2024-03-02') },
      { op: 'supersede_fact', factId: 'obs-k-58', by: 'k2', reason: 'haemolysed sample' },
      { op: 'invalidate_fact', factId: 'med-spiro', reason: 'wrong patient' },
    ]);
    expect(diff.facts.added.map((f) => f.id)).toEqual(['k2']);
    expect(diff.facts.superseded.map((s) => s.reason)).toEqual(['haemolysed sample']);
    expect(diff.facts.invalidated.map((i) => i.reason)).toEqual(['wrong patient']);
  });
});
