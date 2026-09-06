import { describe, expect, it } from 'vitest';
import {
  AIMIG_KB_V0 as KB,
  CONCEPTS,
  affectedBy,
  checkInvariants,
  createEngine,
  derive,
  explain,
  observationNodeId,
  quantity,
  type KnowledgeBase,
  type PatientFact,
  type ReasoningNode,
  type ReasoningState,
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

const keys = (s: ReasoningState): string[] =>
  s.nodes.filter((n) => n.type !== 'Observation').map((n) => n.conclusionKey);

const node = (s: ReasoningState, key: string): ReasoningNode | undefined =>
  s.nodes.find((n) => n.conclusionKey === key);

// ── threshold ────────────────────────────────────────────────────────────────

describe('threshold', () => {
  it('maps a value onto the band that contains it', () => {
    const s = derive(KB, [fact('f', 'egfr', [28, 'mL/min'])]);
    expect(node(s, 'renal_impairment')?.attributes['severity']).toBe('severe');
  });

  it('uses inclusive min and exclusive max, so adjacent bands cannot both fire', () => {
    const s = derive(KB, [fact('f', 'egfr', [30, 'mL/min'])]);
    expect(s.nodes.filter((n) => n.conclusionKey === 'renal_impairment')).toHaveLength(1);
    expect(node(s, 'renal_impairment')?.attributes['severity']).toBe('moderate');
  });

  it('concludes nothing when no band matches — silence is not a conclusion', () => {
    const s = derive(KB, [fact('f', 'egfr', [85, 'mL/min'])]);
    expect(keys(s)).toEqual([]);
  });

  it('refuses to fire on a mismatched unit rather than coercing it', () => {
    const s = derive(KB, [fact('f', 'potassium', [5.8, 'mg/dL'])]);
    expect(keys(s)).toEqual([]);
  });
});

// ── knowledge_link ───────────────────────────────────────────────────────────

describe('knowledge_link', () => {
  it('weights a medication contribution by the strength of the edge', () => {
    const s = derive(KB, [fact('m', 'spironolactone')]);
    expect(node(s, 'contribution:hyperkalemia:spironolactone')?.attributes['weight']).toBe(3);
  });

  it('lets the weaker of strength and severity govern a claim contribution', () => {
    const severe = derive(KB, [fact('f', 'egfr', [28, 'mL/min'])]);
    const moderate = derive(KB, [fact('f', 'egfr', [55, 'mL/min'])]);
    const key = 'contribution:hyperkalemia:renal_impairment';
    expect(node(severe, key)?.attributes['weight']).toBe(3);
    // A strong edge from a moderate claim must not carry a strong contribution.
    // This is what makes the canonical scenario weaken rather than collapse.
    expect(node(moderate, key)?.attributes['weight']).toBe(2);
  });
});

// ── aggregate + action ───────────────────────────────────────────────────────

describe('aggregate', () => {
  it('sums contributions and the directly asserted target', () => {
    const s = derive(KB, [
      fact('m', 'spironolactone'),
      fact('k', 'potassium', [5.8, 'mmol/L']),
      fact('e', 'egfr', [28, 'mL/min']),
    ]);
    // spironolactone 3 + renal(severe) 3 + hyperkalemia(moderate) 2
    expect(node(s, 'hyperkalemia_concern')?.attributes['score']).toBe(8);
    expect(node(s, 'hyperkalemia_concern')?.attributes['level']).toBe('HIGH');
  });

  it('counts a duplicated claim once, taking the stronger', () => {
    const s = derive(KB, [
      fact('m', 'spironolactone'),
      fact('k1', 'potassium', [5.8, 'mmol/L']),
      fact('k2', 'potassium', [6.5, 'mmol/L']),
    ]);
    // 3 + severe(3), not 3 + moderate(2) + severe(3)
    expect(node(s, 'hyperkalemia_concern')?.attributes['score']).toBe(6);
  });

  it('states no concern below the lowest threshold', () => {
    const s = derive(KB, [fact('k', 'potassium', [4.0, 'mmol/L'])]);
    expect(node(s, 'hyperkalemia_concern')).toBeUndefined();
  });
});

describe('action', () => {
  it('is a typed derived node with premises, not a generated sentence', () => {
    const s = derive(KB, [fact('m', 'spironolactone')]);
    const action = node(s, 'action:monitor_potassium');
    expect(action?.type).toBe('Action');
    expect(action?.derivation?.premises).toHaveLength(1);
    expect(action?.attributes['urgency']).toBe('LOW');
  });
});

// ── gap ──────────────────────────────────────────────────────────────────────

describe('gap', () => {
  it('states a missing required input as a question', () => {
    const s = derive(KB, [fact('m', 'spironolactone')]);
    expect(node(s, 'question:potassium')?.type).toBe('Question');
  });

  it('asks nothing once the value exists', () => {
    const s = derive(KB, [fact('m', 'spironolactone'), fact('k', 'potassium', [4.2, 'mmol/L'])]);
    expect(node(s, 'question:potassium')).toBeUndefined();
  });
});

// ── conflict ─────────────────────────────────────────────────────────────────

describe('conflict', () => {
  const conflicting = [
    fact('k1', 'potassium', [5.8, 'mmol/L']),
    fact('k2', 'potassium', [4.1, 'mmol/L']),
  ];

  it('surfaces two active results that cannot be read together', () => {
    expect(node(derive(KB, conflicting), 'conflict:potassium')?.type).toBe('Conflict');
  });

  it('never arbitrates: both results keep contributing', () => {
    const s = derive(KB, conflicting);
    // The engine cannot know which is wrong, so suppressing the downstream
    // reasoning would be a silent arbitration.
    expect(node(s, 'hyperkalemia')).toBeDefined();
  });

  it('persists across repeated derivation until a human removes a premise', () => {
    const once = derive(KB, conflicting);
    const twice = derive(KB, conflicting);
    expect(node(once, 'conflict:potassium')?.id).toBe(node(twice, 'conflict:potassium')?.id);
  });

  it('treats results far enough apart in time as history, not disagreement', () => {
    const s = derive(KB, [
      fact('k1', 'potassium', [5.8, 'mmol/L'], '2024-03-01'),
      fact('k2', 'potassium', [4.1, 'mmol/L'], '2023-01-01'),
    ]);
    expect(node(s, 'conflict:potassium')).toBeUndefined();
  });

  it('ignores a spread within analytical tolerance', () => {
    const s = derive(KB, [
      fact('k1', 'potassium', [5.8, 'mmol/L']),
      fact('k2', 'potassium', [5.9, 'mmol/L']),
    ]);
    expect(node(s, 'conflict:potassium')).toBeUndefined();
  });
});

// ── determinism (D3) ─────────────────────────────────────────────────────────

describe('determinism', () => {
  const facts = [
    fact('m', 'spironolactone'),
    fact('k', 'potassium', [5.8, 'mmol/L']),
    fact('e', 'egfr', [28, 'mL/min']),
  ];

  it('produces byte-identical states from identical inputs', () => {
    expect(JSON.stringify(derive(KB, facts))).toBe(JSON.stringify(derive(KB, facts)));
  });

  it('does not depend on the order the facts arrive in', () => {
    const forwards = derive(KB, facts);
    const backwards = derive(KB, [...facts].reverse());
    expect(JSON.stringify(forwards.nodes.map((n) => n.id))).toBe(
      JSON.stringify(backwards.nodes.map((n) => n.id)),
    );
  });

  /**
   * Written two PRs before the diff exists, because a badly designed
   * conclusionKey only shows up in PR5 — as unreadable diffs — and by then the
   * fix is here.
   */
  it('keeps the conclusion key stable while the node id moves with the premises', () => {
    const severe = derive(KB, [fact('e', 'egfr', [28, 'mL/min'])]);
    const moderate = derive(KB, [fact('e2', 'egfr', [55, 'mL/min'])]);

    const a = node(severe, 'renal_impairment');
    const b = node(moderate, 'renal_impairment');

    // Same thing concluded — so a diff can pair them and report a change...
    expect(a?.conclusionKey).toBe(b?.conclusionKey);
    // ...reached from different premises — so it is not the same node.
    expect(a?.id).not.toBe(b?.id);
  });

  it('leaves an untouched branch structurally identical, not merely equal', () => {
    const withK = [fact('w', 'warfarin'), fact('i', 'inr', [3.5, 'ratio']), fact('k', 'potassium', [5.8, 'mmol/L'])];
    const withoutK = [fact('w', 'warfarin'), fact('i', 'inr', [3.5, 'ratio'])];
    expect(node(derive(KB, withK), 'bleeding_concern')?.id).toBe(
      node(derive(KB, withoutK), 'bleeding_concern')?.id,
    );
  });
});

// ── fixed point ──────────────────────────────────────────────────────────────

describe('the fixed point', () => {
  it('terminates on a knowledge base containing a cycle', () => {
    const cyclic: KnowledgeBase = {
      ...KB,
      assertions: [
        ...KB.assertions,
        {
          id: 'ka-cycle-a',
          subject: CONCEPTS.hyperkalemia,
          predicate: 'increases_risk_of',
          object: CONCEPTS.renal_impairment,
          strength: 'moderate',
          evidence: [{ id: 'ev-cycle', title: 'synthetic cycle' }],
        },
      ],
    };
    expect(() =>
      derive(cyclic, [fact('k', 'potassium', [6.2, 'mmol/L'])]),
    ).not.toThrow();
  });

  it('keeps no partial aggregate from an earlier pass', () => {
    const s = derive(KB, [
      fact('m', 'spironolactone'),
      fact('r', 'ramipril'),
      fact('k', 'potassium', [5.8, 'mmol/L']),
    ]);
    expect(s.nodes.filter((n) => n.conclusionKey === 'hyperkalemia_concern')).toHaveLength(1);
  });
});

// ── explain ──────────────────────────────────────────────────────────────────

describe('explain', () => {
  const facts = [
    fact('med-spiro', 'spironolactone'),
    fact('obs-k-58', 'potassium', [5.8, 'mmol/L']),
    fact('obs-egfr-28', 'egfr', [28, 'mL/min']),
  ];
  const state = derive(KB, facts);
  const action = node(state, 'action:medication_review')!;
  const tree = explain(KB, state, action.id);

  const flatten = (t: typeof tree): (typeof tree)[] => [t, ...t.premises.flatMap(flatten)];

  it('bottoms out at the observations the recommendation actually rests on', () => {
    const observed = flatten(tree)
      .filter((t) => t.node.type === 'Observation')
      .map((t) => t.node.sourceFactId)
      .sort();
    expect(observed).toEqual(['med-spiro', 'obs-egfr-28', 'obs-k-58']);
  });

  it('names the rules that fired', () => {
    const rules = new Set(flatten(tree).flatMap((t) => (t.ruleId ? [t.ruleId] : [])));
    expect(rules).toContain('threshold.egfr');
    expect(rules).toContain('knowledge_link');
    expect(rules).toContain('action');
  });

  it('resolves knowledge all the way down to citable evidence', () => {
    const evidence = new Set(flatten(tree).flatMap((t) => t.evidence.map((e) => e.id)));
    expect(evidence).toContain('ev-syn-04'); // renal impairment -> hyperkalemia
    expect(evidence).toContain('ev-syn-06'); // eGFR staging band
    expect([...evidence].every((id) => id.startsWith('ev-'))).toBe(true);
  });

  it('refuses to explain a node that is not in the state', () => {
    expect(() => explain(KB, state, 'nope')).toThrow(/not in this state/);
  });
});

// ── affectedBy ───────────────────────────────────────────────────────────────

describe('affectedBy', () => {
  const facts = [
    fact('med-spiro', 'spironolactone'),
    fact('obs-k-58', 'potassium', [5.8, 'mmol/L']),
    fact('obs-egfr-28', 'egfr', [28, 'mL/min']),
  ];
  const state = derive(KB, facts);
  const reached = (factId: string): string[] =>
    affectedBy(state, factId).map((id) => state.nodes.find((n) => n.id === id)!.conclusionKey);

  it('reaches conclusions several edges away', () => {
    expect(reached('obs-egfr-28')).toEqual(
      expect.arrayContaining([
        'renal_impairment',
        'contribution:hyperkalemia:renal_impairment',
        'hyperkalemia_concern',
        'action:medication_review',
      ]),
    );
  });

  it('does not reach a conclusion with no dependency path to the fact', () => {
    expect(reached('obs-egfr-28')).not.toContain('hyperkalemia');
  });

  it('excludes the observation itself', () => {
    expect(affectedBy(state, 'obs-egfr-28')).not.toContain(observationNodeId('obs-egfr-28'));
  });
});

// ── invariants hold over the whole corpus ────────────────────────────────────

describe('every derived state', () => {
  it('satisfies the invariants', () => {
    const engine = createEngine();
    const scenarios: PatientFact[][] = [
      [],
      [fact('k', 'potassium', [4.0, 'mmol/L'])],
      [fact('m', 'spironolactone')],
      [fact('m', 'spironolactone'), fact('k1', 'potassium', [5.8, 'mmol/L']), fact('k2', 'potassium', [4.1, 'mmol/L'])],
      [fact('w', 'warfarin'), fact('a', 'amiodarone'), fact('i', 'inr', [4.5, 'ratio'])],
    ];
    for (const facts of scenarios) {
      expect(checkInvariants(engine.derive(KB, facts, 0), facts)).toEqual([]);
    }
  });
});
