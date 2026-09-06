import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AIMIG_KB_V0 as KB,
  CONCEPTS,
  InMemoryReasoningStore,
  MutationValidationError,
  applyCorrection,
  applyMutations,
  createEngine,
  currentState,
  derive,
  factsAt,
  openCase,
  quantity,
  stateAt,
  type CaseContext,
  type CaseLog,
  type Mutation,
  type PatientFact,
  type ReasoningStore,
} from '../src/index.js';
import { JsonFileReasoningStore } from '../src/node/index.js';

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

const CANONICAL = [
  fact('med-spiro', 'spironolactone', undefined, '2024-01-10'),
  fact('obs-k-58', 'potassium', [5.8, 'mmol/L']),
  fact('obs-egfr-28', 'egfr', [28, 'mL/min'], '2023-06-14'),
];

const CORRECTION: Mutation[] = [
  { op: 'add_fact', fact: fact('obs-egfr-55', 'egfr', [55, 'mL/min'], '2024-02-20') },
  {
    op: 'supersede_fact',
    factId: 'obs-egfr-28',
    by: 'obs-egfr-55',
    reason: 'value came from a resolved acute episode',
  },
];

function context(store: ReasoningStore = new InMemoryReasoningStore()): CaseContext {
  return { store, engine: createEngine(), knowledge: KB };
}

// ── validation ───────────────────────────────────────────────────────────────

describe('mutation validation', () => {
  const base = [fact('f1', 'potassium', [5.8, 'mmol/L'])];
  const fails = (m: Mutation, pattern: RegExp): void => {
    expect(() => applyMutations(base, [m])).toThrow(MutationValidationError);
    expect(() => applyMutations(base, [m])).toThrow(pattern);
  };

  it('refuses to add a fact whose id is taken', () => {
    fails({ op: 'add_fact', fact: fact('f1', 'potassium', [4.0, 'mmol/L']) }, /already exists/);
  });

  it('refuses to supersede an unknown fact', () => {
    fails({ op: 'supersede_fact', factId: 'ghost', by: 'f1', reason: 'x' }, /unknown fact/);
  });

  it('refuses to supersede by an unknown fact', () => {
    fails({ op: 'supersede_fact', factId: 'f1', by: 'ghost', reason: 'x' }, /unknown fact/);
  });

  it('refuses a supersession with no reason — the judgement is the point', () => {
    fails({ op: 'supersede_fact', factId: 'f1', by: 'f1', reason: '   ' }, /itself|reason/);
  });

  it('refuses an invalidation with no reason', () => {
    fails({ op: 'invalidate_fact', factId: 'f1', reason: '  ' }, /requires a reason/);
  });

  it('refuses to supersede the same fact twice', () => {
    const once = applyMutations(base, [
      { op: 'add_fact', fact: fact('f2', 'potassium', [4.0, 'mmol/L']) },
      { op: 'supersede_fact', factId: 'f1', by: 'f2', reason: 'repeat draw' },
    ]);
    expect(() =>
      applyMutations(once, [{ op: 'supersede_fact', factId: 'f1', by: 'f2', reason: 'again' }]),
    ).toThrow(/already "superseded"/);
  });

  it('applies mutations in order, so a replacement can be added and used at once', () => {
    const after = applyMutations(CANONICAL, CORRECTION);
    expect(after.find((f) => f.id === 'obs-egfr-28')?.status).toBe('superseded');
    expect(after.find((f) => f.id === 'obs-egfr-55')?.status).toBe('active');
  });
});

// ── invariant 3 ──────────────────────────────────────────────────────────────

describe('superseded information stays on the record', () => {
  const after = applyMutations(CANONICAL, CORRECTION);
  const old = after.find((f) => f.id === 'obs-egfr-28')!;

  it('keeps the fact, its status, what replaced it and why', () => {
    expect(old.status).toBe('superseded');
    expect(old.supersededBy).toBe('obs-egfr-55');
    expect(old.statusReason).toBe('value came from a resolved acute episode');
  });

  it('removes nothing from the patient layer', () => {
    expect(after).toHaveLength(CANONICAL.length + 1);
  });

  it('stops projecting it into the reasoning layer', () => {
    // History lives in layer 2. Layer 3 holds only what currently holds.
    const state = derive(KB, after);
    expect(state.nodes.some((n) => n.sourceFactId === 'obs-egfr-28')).toBe(false);
  });
});

// ── the log is the whole persistence model ───────────────────────────────────

describe('replaying the log', () => {
  const log: CaseLog = {
    caseId: 'c',
    commits: [
      {
        version: 1,
        at: '2024-03-01T10:00:00Z',
        author: 'test',
        intent: 'open the case',
        knowledgeVersion: KB.version,
        mutations: CANONICAL.map((f) => ({ op: 'add_fact' as const, fact: f })),
      },
      {
        version: 2,
        at: '2024-03-10T10:00:00Z',
        author: 'test',
        intent: 'correct the eGFR',
        knowledgeVersion: KB.version,
        mutations: CORRECTION,
      },
    ],
  };

  it('reconstructs any earlier version', () => {
    expect(factsAt(log, 1).find((f) => f.id === 'obs-egfr-28')?.status).toBe('active');
    expect(factsAt(log, 2).find((f) => f.id === 'obs-egfr-28')?.status).toBe('superseded');
  });

  it('reconstructs an earlier reasoning state with no stored conclusions', () => {
    const v1 = derive(KB, factsAt(log, 1), 1);
    const key = (k: string) => v1.nodes.find((n) => n.conclusionKey === k);
    expect(key('hyperkalemia_concern')?.attributes['level']).toBe('HIGH');
  });

  it('is reproducible across a JSON round trip — invariant 10', () => {
    const reloaded = JSON.parse(JSON.stringify(log)) as CaseLog;
    expect(JSON.stringify(derive(KB, factsAt(reloaded, 2), 2))).toBe(
      JSON.stringify(derive(KB, factsAt(log, 2), 2)),
    );
  });
});

// ── the case service ─────────────────────────────────────────────────────────

describe('applying a correction', () => {
  const open = async (ctx: CaseContext): Promise<void> => {
    await openCase(ctx, 'canonical', CANONICAL, {
      author: 'test',
      at: '2024-03-01T10:00:00Z',
      intent: 'open the case',
    });
  };

  it('recomputes the recommendation', async () => {
    const ctx = context();
    await open(ctx);
    const { before, after } = await applyCorrection(ctx, 'canonical', {
      intent: 'eGFR 28 came from a resolved acute episode',
      author: 'test',
      at: '2024-03-10T10:00:00Z',
      mutations: CORRECTION,
    });

    const urgency = (v: typeof before): unknown =>
      v.state.nodes.find((n) => n.type === 'Action')?.attributes['urgency'];
    expect(urgency(before)).toBe('HIGH');
    expect(urgency(after)).toBe('MODERATE');
  });

  it('leaves the earlier version reachable', async () => {
    const ctx = context();
    await open(ctx);
    await applyCorrection(ctx, 'canonical', {
      intent: 'correct the eGFR',
      author: 'test',
      at: '2024-03-10T10:00:00Z',
      mutations: CORRECTION,
    });
    const v1 = await stateAt(ctx, 'canonical', 1);
    const v2 = await currentState(ctx, 'canonical');
    expect(v1.state.nodes.find((n) => n.conclusionKey === 'renal_impairment')?.attributes['severity']).toBe('severe');
    expect(v2.state.nodes.find((n) => n.conclusionKey === 'renal_impairment')?.attributes['severity']).toBe('moderate');
  });

  it('refuses a commit that says nothing about its purpose', async () => {
    const ctx = context();
    await open(ctx);
    await expect(
      applyCorrection(ctx, 'canonical', {
        intent: '  ',
        author: 'test',
        at: '2024-03-10T10:00:00Z',
        mutations: CORRECTION,
      }),
    ).rejects.toThrow(/what it is for/);
  });

  it('refuses a commit that changes nothing', async () => {
    const ctx = context();
    await open(ctx);
    await expect(
      applyCorrection(ctx, 'canonical', {
        intent: 'nothing',
        author: 'test',
        at: '2024-03-10T10:00:00Z',
        mutations: [],
      }),
    ).rejects.toThrow(/changes nothing/);
  });
});

// ── stores agree ─────────────────────────────────────────────────────────────

describe('both stores', () => {
  it('produce the same reasoning from the same log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aimig-'));
    const contexts = [context(), context(new JsonFileReasoningStore(dir))];
    const states = [];

    for (const ctx of contexts) {
      await openCase(ctx, 'canonical', CANONICAL, {
        author: 'test',
        at: '2024-03-01T10:00:00Z',
        intent: 'open',
      });
      const { after } = await applyCorrection(ctx, 'canonical', {
        intent: 'correct the eGFR',
        author: 'test',
        at: '2024-03-10T10:00:00Z',
        mutations: CORRECTION,
      });
      states.push(JSON.stringify(after.state));
    }
    expect(states[0]).toBe(states[1]);
  });

  it('reject an out-of-sequence commit identically', async () => {
    const store = new InMemoryReasoningStore();
    await store.create('c');
    await expect(
      store.append('c', {
        version: 7,
        at: 'now',
        author: 'test',
        intent: 'jump ahead',
        knowledgeVersion: KB.version,
        mutations: [{ op: 'add_fact', fact: fact('f', 'potassium', [4, 'mmol/L']) }],
      }),
    ).rejects.toThrow(/does not follow/);
  });
});

// ── the no-change property, stated causally ──────────────────────────────────

describe('an unrelated correction', () => {
  const both = [
    ...CANONICAL,
    fact('med-warfarin', 'warfarin', undefined, '2024-01-05'),
    fact('med-amiodarone', 'amiodarone', undefined, '2024-02-01'),
    fact('obs-inr-35', 'inr', [3.5, 'ratio']),
  ];

  it('leaves the untouched branch structurally identical, id for id', () => {
    // Recomputation is total. What is under test is causal, not algorithmic:
    // ids being deterministic, an unchanged id proves the premise set is
    // unchanged — a far stronger statement than equal attributes.
    const before = derive(KB, both);
    const after = derive(
      KB,
      applyMutations(both, [
        { op: 'add_fact', fact: fact('obs-k-42', 'potassium', [4.2, 'mmol/L'], '2024-03-02') },
        { op: 'supersede_fact', factId: 'obs-k-58', by: 'obs-k-42', reason: 'haemolysed sample' },
      ]),
    );
    const id = (s: typeof before, k: string): string | undefined =>
      s.nodes.find((n) => n.conclusionKey === k)?.id;

    for (const key of ['bleeding_concern', 'over_anticoagulation', 'action:anticoagulation_review']) {
      expect(id(after, key)).toBe(id(before, key));
    }
    expect(id(after, 'hyperkalemia')).toBeUndefined();
  });

  it('is not reported as affecting it', () => {
    const before = derive(KB, both);
    const engine = createEngine();
    const reached = engine
      .affectedBy(before, 'obs-k-58')
      .map((n) => before.nodes.find((x) => x.id === n)?.conclusionKey);
    expect(reached).toContain('hyperkalemia_concern');
    expect(reached).not.toContain('bleeding_concern');
  });
});
