import { describe, expect, it } from 'vitest';
import { loadCases, parseCase } from './benchmark/load-cases.js';
import { blocksOf } from '../src/index.js';

const VALID = `
id: t
category: baseline
validation_scope: reasoning_mechanics_only
clinical_validity: unvalidated
description: a case
facts:
  - {id: f1, kind: observation, concept: potassium, value: {num: 4.0, unit: mmol/L}, observed_at: '2024-01-01'}
expect_initial:
  active_conclusions: []
`;

function withOut(field: string): string {
  return VALID.split('\n')
    .filter((line) => !line.startsWith(field))
    .join('\n');
}

describe('the corpus', () => {
  const cases = loadCases();

  it('has 20 cases covering all seven categories', () => {
    expect(cases).toHaveLength(20);
    expect(new Set(cases.map((c) => c.category)).size).toBe(7);
  });

  it('yields 50 assertion blocks', () => {
    expect(cases.flatMap(blocksOf)).toHaveLength(50);
  });

  it('gives every case a description a non-developer can read', () => {
    for (const c of cases) expect(c.description.length).toBeGreaterThan(60);
  });

  it('states its validation scope on every case', () => {
    for (const c of cases) {
      expect(c.validationScope).toBe('reasoning_mechanics_only');
      expect(c.clinicalValidity).toBe('unvalidated');
    }
  });

  it('gives every supersession a human reason', () => {
    for (const c of cases) {
      for (const m of c.correction?.mutations ?? []) {
        if (m.op === 'supersede_fact' || m.op === 'invalidate_fact') {
          expect(m.reason.length).toBeGreaterThan(5);
        }
      }
    }
  });
});

describe('the schema validator', () => {
  it('accepts a well-formed case', () => {
    expect(parseCase('t.yaml', VALID).id).toBe('t');
  });

  it('rejects a case with no validation scope', () => {
    expect(() => parseCase('t.yaml', withOut('validation_scope'))).toThrow(
      /validation_scope/,
    );
  });

  it('rejects a case with no clinical validity marker', () => {
    expect(() => parseCase('t.yaml', withOut('clinical_validity'))).toThrow(
      /clinical_validity/,
    );
  });

  it('rejects a concept outside the closed vocabulary', () => {
    const invented = VALID.replace('concept: potassium', 'concept: unobtainium');
    expect(() => parseCase('t.yaml', invented)).toThrow(/closed vocabulary/);
  });

  it('rejects an unknown category', () => {
    expect(() => parseCase('t.yaml', VALID.replace('baseline', 'vibes'))).toThrow(
      /category/,
    );
  });

  it('rejects a supersession with no reason', () => {
    const noReason = `${VALID}
correction:
  intent: fix it
  mutations:
    - {op: supersede_fact, fact_id: f1, by: f2}
expect_after_state: {}
expect_after_diff: {}
`;
    expect(() => parseCase('t.yaml', noReason)).toThrow(/reason/);
  });

  it('rejects a correction with nothing asserted about its outcome', () => {
    const noExpectation = `${VALID}
correction:
  intent: fix it
  mutations:
    - {op: invalidate_fact, fact_id: f1, reason: wrong patient}
`;
    expect(() => parseCase('t.yaml', noExpectation)).toThrow(/expect_after_state/);
  });
});
