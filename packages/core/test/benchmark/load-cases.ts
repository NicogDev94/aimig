import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type {
  BenchmarkCase,
  BenchmarkCategory,
  CaseFact,
  CaseMutation,
  DiffExpectation,
  StateExpectation,
} from '../../src/index.js';
import { conceptByCode } from '../../src/index.js';

export const CASES_DIR = fileURLToPath(
  new URL('../../../../benchmark/cases', import.meta.url),
);

const CATEGORIES: readonly BenchmarkCategory[] = [
  'baseline',
  'conflict',
  'missing-information',
  'correction',
  'supersession',
  'no-change',
  'multi-hop',
];

class CaseError extends Error {
  constructor(file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = 'CaseError';
  }
}

type Raw = Record<string, unknown>;

function obj(file: string, value: unknown, what: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaseError(file, `${what} must be a mapping`);
  }
  return value as Raw;
}

function str(file: string, value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CaseError(file, `${what} must be a non-empty string`);
  }
  return value;
}

function arr(file: string, value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new CaseError(file, `${what} must be a list`);
  return value;
}

function readFact(file: string, raw: Raw): CaseFact {
  const concept = str(file, raw['concept'], 'fact.concept');
  if (conceptByCode(concept) === undefined) {
    throw new CaseError(
      file,
      `fact.concept "${concept}" is outside the closed vocabulary; the benchmark may not invent concepts`,
    );
  }
  const kind = str(file, raw['kind'], 'fact.kind');
  if (kind !== 'observation' && kind !== 'medication' && kind !== 'condition') {
    throw new CaseError(file, `fact.kind "${kind}" is not a known kind`);
  }
  const observedAt = str(file, raw['observed_at'], 'fact.observed_at');
  const value = raw['value'];
  return {
    id: str(file, raw['id'], 'fact.id'),
    kind,
    concept,
    observedAt,
    // System time defaults to clinical time: a fixture states when something was
    // true of the patient; unless it says otherwise, that is also when we learned it.
    recordedAt: typeof raw['recorded_at'] === 'string' ? raw['recorded_at'] : observedAt,
    ...(value === undefined
      ? {}
      : {
          value: {
            num: Number(obj(file, value, 'fact.value')['num']),
            unit: str(file, obj(file, value, 'fact.value')['unit'], 'fact.value.unit'),
          },
        }),
  };
}

function readMutation(file: string, raw: Raw): CaseMutation {
  const op = str(file, raw['op'], 'mutation.op');
  switch (op) {
    case 'add_fact':
      return { op, fact: readFact(file, obj(file, raw['fact'], 'mutation.fact')) };
    case 'supersede_fact':
      return {
        op,
        factId: str(file, raw['fact_id'], 'mutation.fact_id'),
        by: str(file, raw['by'], 'mutation.by'),
        // Supersession is always a human judgement (D6), so the reason is not
        // optional — the schema refuses a correction that does not say why.
        reason: str(file, raw['reason'], 'mutation.reason'),
      };
    case 'invalidate_fact':
      return {
        op,
        factId: str(file, raw['fact_id'], 'mutation.fact_id'),
        reason: str(file, raw['reason'], 'mutation.reason'),
      };
    default:
      throw new CaseError(file, `mutation.op "${op}" is not a known operation`);
  }
}

function readStateExpectation(file: string, raw: Raw): StateExpectation {
  const affected = raw['affected_by'];
  const affectedBy: StateExpectation['affectedBy'] | undefined =
    affected === undefined
      ? undefined
      : {
          factId: str(file, obj(file, affected, 'affected_by')['fact_id'], 'fact_id'),
          ...pick('mustInclude', obj(file, affected, 'affected_by')['must_include']),
          ...pick('mustExclude', obj(file, affected, 'affected_by')['must_exclude']),
        };
  return {
    ...pick('activeConclusions', raw['active_conclusions']),
    ...pick('absentConclusions', raw['absent_conclusions']),
    ...pick('attributes', raw['attributes']),
    ...('recommendation' in raw ? { recommendation: raw['recommendation'] as never } : {}),
    ...pick('questions', raw['questions']),
    ...pick('conflicts', raw['conflicts']),
    ...pick('absentFactsFromState', raw['absent_facts_from_state']),
    ...pick('factStatus', raw['fact_status']),
    ...pick('identicalNodeIds', raw['identical_node_ids']),
    ...(affectedBy === undefined ? {} : { affectedBy }),
  };
}

function readDiffExpectation(file: string, raw: Raw): DiffExpectation {
  const cite = raw['why_changed_must_cite'];
  const notCite = raw['why_changed_must_not_cite'];
  const whyChangedMustCite: DiffExpectation['whyChangedMustCite'] | undefined =
    cite === undefined
      ? undefined
      : {
          target: str(file, obj(file, cite, 'why_changed_must_cite')['target'], 'target'),
          ...pick('verdict', obj(file, cite, '')['verdict']),
          ...pick('facts', obj(file, cite, '')['facts']),
          ...pick('rules', obj(file, cite, '')['rules']),
          ...pick('knowledge', obj(file, cite, '')['knowledge']),
          ...pick('evidence', obj(file, cite, '')['evidence']),
        };
  const whyChangedMustNotCite: DiffExpectation['whyChangedMustNotCite'] | undefined =
    notCite === undefined
      ? undefined
      : {
          target: str(file, obj(file, notCite, 'why_changed_must_not_cite')['target'], 'target'),
          ...pick('facts', obj(file, notCite, '')['facts']),
        };
  return {
    ...pick('added', raw['added']),
    ...pick('retracted', raw['retracted']),
    ...pick('unchanged', raw['unchanged']),
    ...pick('changed', raw['changed']),
    ...(whyChangedMustCite === undefined ? {} : { whyChangedMustCite }),
    ...(whyChangedMustNotCite === undefined ? {} : { whyChangedMustNotCite }),
  };
}

function pick<K extends string>(key: K, value: unknown): Partial<Record<K, never>> {
  return (value === undefined ? {} : { [key]: value }) as Partial<Record<K, never>>;
}

export function parseCase(file: string, source: string): BenchmarkCase {
  const raw = obj(file, parse(source), 'case');

  const category = str(file, raw['category'], 'category') as BenchmarkCategory;
  if (!CATEGORIES.includes(category)) {
    throw new CaseError(file, `category "${category}" is not a benchmark category`);
  }

  // D10 — the mechanics/clinical-validity distinction cannot be dropped by
  // oversight, so a case that omits it is rejected rather than defaulted.
  if (raw['validation_scope'] !== 'reasoning_mechanics_only') {
    throw new CaseError(file, 'validation_scope must be "reasoning_mechanics_only"');
  }
  if (raw['clinical_validity'] !== 'unvalidated') {
    throw new CaseError(file, 'clinical_validity must be "unvalidated"');
  }

  const correction = raw['correction'];
  const parsedCorrection =
    correction === undefined
      ? undefined
      : {
          intent: str(file, obj(file, correction, 'correction')['intent'], 'intent'),
          mutations: arr(
            file,
            obj(file, correction, 'correction')['mutations'],
            'correction.mutations',
          ).map((m) => readMutation(file, obj(file, m, 'mutation'))),
        };

  if (parsedCorrection !== undefined && raw['expect_after_state'] === undefined) {
    throw new CaseError(file, 'a case with a correction must declare expect_after_state');
  }
  if (parsedCorrection !== undefined && raw['expect_after_diff'] === undefined) {
    throw new CaseError(file, 'a case with a correction must declare expect_after_diff');
  }
  if (parsedCorrection === undefined && raw['expect_after_state'] !== undefined) {
    throw new CaseError(file, 'expect_after_state without a correction has nothing to assert');
  }

  return {
    id: str(file, raw['id'], 'id'),
    category,
    validationScope: 'reasoning_mechanics_only',
    clinicalValidity: 'unvalidated',
    description: str(file, raw['description'], 'description'),
    facts: arr(file, raw['facts'], 'facts').map((f) => readFact(file, obj(file, f, 'fact'))),
    expectInitial: readStateExpectation(
      file,
      obj(file, raw['expect_initial'], 'expect_initial'),
    ),
    ...(parsedCorrection === undefined ? {} : { correction: parsedCorrection }),
    ...(raw['expect_after_state'] === undefined
      ? {}
      : {
          expectAfterState: readStateExpectation(
            file,
            obj(file, raw['expect_after_state'], 'expect_after_state'),
          ),
        }),
    ...(raw['expect_after_diff'] === undefined
      ? {}
      : {
          expectAfterDiff: readDiffExpectation(
            file,
            obj(file, raw['expect_after_diff'], 'expect_after_diff'),
          ),
        }),
  };
}

export function loadCases(dir: string = CASES_DIR): BenchmarkCase[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => parseCase(f, readFileSync(join(dir, f), 'utf8')));
}
