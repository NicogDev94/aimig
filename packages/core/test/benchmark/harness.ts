import {
  actionsOf,
  applyMutations,
  createEngine,
  checkInvariants,
  diffStates,
  whyChanged,
  AIMIG_KB_V0,
  conceptByCode,
  type BenchmarkCase,
  type BlockName,
  type CaseFact,
  type CaseMutation,
  type ChangeExplanation,
  type DiffExpectation,
  type KnowledgeBase,
  type Mutation,
  type PatientFact,
  type ReasoningDiff,
  type ReasoningNode,
  type ReasoningState,
  type StateExpectation,
} from '../../src/index.js';
import { blocksOf } from '../../src/index.js';
import { loadCases } from './load-cases.js';

export interface BlockResult {
  readonly caseId: string;
  readonly category: string;
  readonly block: BlockName;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

export interface BenchmarkReport {
  readonly total: number;
  readonly passed: number;
  readonly cases: number;
  readonly blocks: readonly BlockResult[];
}

function toFact(f: CaseFact): PatientFact {
  const concept = conceptByCode(f.concept);
  if (concept === undefined) throw new Error(`unknown concept "${f.concept}"`);
  return {
    id: f.id,
    kind: f.kind,
    concept,
    ...(f.value === undefined
      ? {}
      : { value: { kind: 'quantity' as const, num: f.value.num, unit: f.value.unit } }),
    observedAt: f.observedAt,
    recordedAt: f.recordedAt ?? f.observedAt,
    status: 'active',
    provenance: { origin: 'fixture', actor: 'benchmark' },
  };
}

function toMutation(m: CaseMutation): Mutation {
  return m.op === 'add_fact' ? { op: 'add_fact', fact: toFact(m.fact) } : m;
}

// ── assertions ───────────────────────────────────────────────────────────────

const derived = (s: ReasoningState): ReasoningNode[] =>
  s.nodes.filter((n) => n.type !== 'Observation');

const byKey = (s: ReasoningState): Map<string, ReasoningNode> =>
  new Map(derived(s).map((n) => [n.conclusionKey, n]));

function assertState(
  expectation: StateExpectation,
  state: ReasoningState,
  facts: readonly PatientFact[],
  engine: ReturnType<typeof createEngine>,
  previous?: ReasoningState,
): string[] {
  const out: string[] = [];
  const nodes = byKey(state);

  for (const key of expectation.activeConclusions ?? []) {
    if (!nodes.has(key)) out.push(`expected conclusion "${key}" to be present`);
  }
  for (const key of expectation.absentConclusions ?? []) {
    if (nodes.has(key)) out.push(`expected conclusion "${key}" to be absent`);
  }
  if (expectation.activeConclusions?.length === 0 && derived(state).length > 0) {
    out.push(
      `expected no conclusion at all, got ${derived(state)
        .map((n) => n.conclusionKey)
        .join(', ')}`,
    );
  }

  for (const [key, attrs] of Object.entries(expectation.attributes ?? {})) {
    const node = nodes.get(key);
    if (node === undefined) {
      out.push(`expected conclusion "${key}" to exist so its attributes can be checked`);
      continue;
    }
    for (const [attr, want] of Object.entries(attrs)) {
      const got = node.attributes[attr];
      if (got !== want) out.push(`${key}.${attr}: expected ${want}, got ${String(got)}`);
    }
  }

  if (expectation.recommendation !== undefined) {
    const actions = actionsOf(state);
    if (expectation.recommendation === null) {
      if (actions.length > 0) {
        out.push(
          `expected no recommendation, got ${actions.map((a) => a.conclusionKey).join(', ')}`,
        );
      }
    } else {
      const want = expectation.recommendation;
      const found = actions.find((a) => a.attributes['actionKey'] === want.key);
      if (found === undefined) {
        out.push(`expected recommendation "${want.key}", got ${actions.length} action(s)`);
      } else if (found.attributes['urgency'] !== want.urgency) {
        out.push(
          `recommendation urgency: expected ${want.urgency}, got ${String(found.attributes['urgency'])}`,
        );
      }
    }
  }

  if (expectation.questions !== undefined) {
    const got = derived(state)
      .filter((n) => n.type === 'Question')
      .map((n) => n.conclusionKey)
      .sort();
    const want = [...expectation.questions].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      out.push(`questions: expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }

  if (expectation.conflicts !== undefined) {
    const got = derived(state)
      .filter((n) => n.type === 'Conflict')
      .map((n) => n.conclusionKey)
      .sort();
    const want = [...expectation.conflicts].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      out.push(`conflicts: expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }

  for (const factId of expectation.absentFactsFromState ?? []) {
    if (state.nodes.some((n) => n.sourceFactId === factId)) {
      out.push(`fact "${factId}" must no longer project into the reasoning state`);
    }
  }

  for (const [factId, want] of Object.entries(expectation.factStatus ?? {})) {
    const fact = facts.find((f) => f.id === factId);
    if (fact === undefined) out.push(`fact "${factId}" is missing from the patient layer`);
    else if (fact.status !== want) {
      out.push(`fact "${factId}": expected status ${want}, got ${fact.status}`);
    } else if (fact.status !== 'active' && !fact.statusReason) {
      out.push(`fact "${factId}" is ${fact.status} without a recorded reason`);
    }
  }

  if (expectation.identicalNodeIds !== undefined) {
    if (previous === undefined) {
      out.push('identical_node_ids needs a previous version to compare against');
    } else {
      const before = byKey(previous);
      for (const key of expectation.identicalNodeIds) {
        const a = before.get(key);
        const b = nodes.get(key);
        if (a === undefined || b === undefined) {
          out.push(`"${key}" must exist in both versions to be structurally identical`);
        } else if (a.id !== b.id) {
          out.push(`"${key}" changed identity:\n    before ${a.id}\n    after  ${b.id}`);
        }
      }
    }
  }

  const affected = expectation.affectedBy;
  if (affected !== undefined) {
    const source = previous ?? state;
    const reached = new Set(
      engine
        .affectedBy(source, affected.factId)
        .map((id) => source.nodes.find((n) => n.id === id)?.conclusionKey ?? id),
    );
    for (const key of affected.mustInclude ?? []) {
      if (!reached.has(key)) out.push(`affectedBy(${affected.factId}) must include "${key}"`);
    }
    for (const key of affected.mustExclude ?? []) {
      if (reached.has(key)) out.push(`affectedBy(${affected.factId}) must not include "${key}"`);
    }
  }

  for (const violation of checkInvariants(state, facts)) {
    out.push(`invariant ${violation.invariant}: ${violation.message}`);
  }

  return out;
}

function assertDiff(
  expectation: DiffExpectation,
  diff: ReasoningDiff,
  explain: (target: string) => ChangeExplanation,
): string[] {
  const out: string[] = [];
  const keys = (nodes: readonly ReasoningNode[]): string[] =>
    nodes.map((n) => n.conclusionKey);

  const addedKeys = keys(diff.nodes.added);
  const retractedKeys = keys(diff.nodes.retracted);
  const changedKeys = diff.nodes.changed.map((c) => c.conclusionKey);

  const exactly = (label: string, want: readonly string[], got: readonly string[]): void => {
    const a = [...want].sort();
    const b = [...got].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push(`diff.${label}: expected [${a.join(', ')}], got [${b.join(', ')}]`);
    }
  };

  if (expectation.added !== undefined) exactly('added', expectation.added, addedKeys);
  if (expectation.retracted !== undefined) {
    exactly('retracted', expectation.retracted, retractedKeys);
  }
  if (expectation.changed !== undefined) {
    exactly(
      'changed',
      expectation.changed.map((c) => c.key),
      changedKeys,
    );
    for (const want of expectation.changed) {
      const got = diff.nodes.changed.find((c) => c.conclusionKey === want.key);
      if (got === undefined) continue;
      if (want.verdict !== undefined && got.verdict !== want.verdict) {
        out.push(`diff.changed[${want.key}].verdict: expected ${want.verdict}, got ${got.verdict}`);
      }
      for (const [attr, value] of Object.entries(want.from ?? {})) {
        if (got.before.attributes[attr] !== value) {
          out.push(
            `diff.changed[${want.key}].before.${attr}: expected ${value}, got ${String(got.before.attributes[attr])}`,
          );
        }
      }
      for (const [attr, value] of Object.entries(want.to ?? {})) {
        if (got.after.attributes[attr] !== value) {
          out.push(
            `diff.changed[${want.key}].after.${attr}: expected ${value}, got ${String(got.after.attributes[attr])}`,
          );
        }
      }
    }
  }

  // "unchanged" means structurally identical: same conclusion, same node id.
  for (const key of expectation.unchanged ?? []) {
    if (addedKeys.includes(key) || retractedKeys.includes(key) || changedKeys.includes(key)) {
      out.push(`"${key}" was expected to be untouched but appears in the diff`);
    }
  }

  const cite = expectation.whyChangedMustCite;
  if (cite !== undefined) {
    const why = explain(cite.target);
    if (cite.verdict !== undefined && why.verdict !== cite.verdict) {
      out.push(`whyChanged(${cite.target}).verdict: expected ${cite.verdict}, got ${why.verdict}`);
    }
    const citedFacts = new Set(
      why.causedBy.flatMap((m) => (m.op === 'add_fact' ? [m.fact.id] : [m.factId])),
    );
    for (const id of cite.facts ?? []) {
      if (!citedFacts.has(id)) out.push(`whyChanged(${cite.target}) must cite fact "${id}"`);
    }
    for (const rule of cite.rules ?? []) {
      if (!why.rulesRefired.includes(rule)) {
        out.push(`whyChanged(${cite.target}) must cite rule "${rule}"`);
      }
    }
    const citedKnowledge = new Set(why.knowledgeCited.map((k) => k.id));
    for (const id of cite.knowledge ?? []) {
      if (!citedKnowledge.has(id)) {
        out.push(`whyChanged(${cite.target}) must cite knowledge "${id}"`);
      }
    }
    const citedEvidence = new Set(why.evidenceCited.map((e) => e.id));
    for (const id of cite.evidence ?? []) {
      if (!citedEvidence.has(id)) {
        out.push(`whyChanged(${cite.target}) must cite evidence "${id}"`);
      }
    }
  }

  const notCite = expectation.whyChangedMustNotCite;
  if (notCite !== undefined) {
    const why = explain(notCite.target);
    const citedFacts = new Set(
      why.causedBy.flatMap((m) => (m.op === 'add_fact' ? [m.fact.id] : [m.factId])),
    );
    for (const id of notCite.facts ?? []) {
      if (citedFacts.has(id)) {
        out.push(
          `whyChanged(${notCite.target}) cites "${id}", which has no dependency path to it`,
        );
      }
    }
  }

  return out;
}

// ── runner ───────────────────────────────────────────────────────────────────

function runCase(c: BenchmarkCase, kb: KnowledgeBase): BlockResult[] {
  const engine = createEngine();
  const results: BlockResult[] = [];
  const record = (block: BlockName, failures: string[]): void => {
    results.push({
      caseId: c.id,
      category: c.category,
      block,
      passed: failures.length === 0,
      failures,
    });
  };
  const fail = (block: BlockName, error: unknown): void => {
    record(block, [error instanceof Error ? error.message : String(error)]);
  };

  const blocks = blocksOf(c);
  const facts0 = c.facts.map(toFact);

  let state0: ReasoningState | undefined;
  try {
    state0 = engine.derive(kb, facts0, 0);
    record('initial', assertState(c.expectInitial, state0, facts0, engine));
  } catch (error) {
    fail('initial', error);
  }

  if (!blocks.includes('after_state')) return results;

  const mutations = (c.correction?.mutations ?? []).map(toMutation);
  let facts1: PatientFact[] | undefined;
  let state1: ReasoningState | undefined;

  try {
    facts1 = applyMutations(facts0, mutations);
    state1 = engine.derive(kb, facts1, 1);
    record(
      'after_state',
      state0 === undefined
        ? ['the initial state could not be derived']
        : assertState(c.expectAfterState ?? {}, state1, facts1, engine, state0),
    );
  } catch (error) {
    fail('after_state', error);
  }

  try {
    if (state0 === undefined || state1 === undefined || facts1 === undefined) {
      throw new Error('an earlier block failed, so the diff cannot be computed');
    }
    const before = { state: state0, facts: facts0 };
    const after = { state: state1, facts: facts1 };
    const diff = diffStates(kb, before, after, mutations);
    record(
      'after_diff',
      assertDiff(c.expectAfterDiff ?? {}, diff, (target) =>
        whyChanged(kb, before, after, mutations, target),
      ),
    );
  } catch (error) {
    fail('after_diff', error);
  }

  return results;
}

export function runBenchmark(
  cases: readonly BenchmarkCase[] = loadCases(),
  kb: KnowledgeBase = AIMIG_KB_V0,
): BenchmarkReport {
  const blocks = cases.flatMap((c) => runCase(c, kb));
  return {
    total: blocks.length,
    passed: blocks.filter((b) => b.passed).length,
    cases: cases.length,
    blocks,
  };
}

export function formatReport(report: BenchmarkReport): string {
  const lines: string[] = [
    '',
    `  ${AIMIG_KB_V0.validation.notice}`,
    '',
    `  benchmark: ${report.passed}/${report.total} assertion blocks across ${report.cases} cases`,
    '',
  ];
  for (const block of report.blocks) {
    lines.push(`  ${block.passed ? 'PASS' : 'FAIL'}  ${block.caseId} [${block.block}]`);
    for (const failure of block.failures) lines.push(`          ${failure}`);
  }
  lines.push('');
  return lines.join('\n');
}
