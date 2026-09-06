import {
  AIMIG_KB_V0,
  CONCEPTS,
} from '../knowledge/index.js';
import { InMemoryReasoningStore } from '../store/in-memory-store.js';
import { createEngine } from '../engine/index.js';
import { applyCorrection, openCase, type CaseContext, type VersionView } from '../case-service.js';
import { diffStates, whyChanged } from '../diff/index.js';
import { explain } from '../engine/explain.js';
import type { DerivationTree } from '../domain/diff.js';
import type { Mutation } from '../domain/log.js';
import type { PatientFact } from '../domain/facts.js';
import type { ReasoningNode } from '../domain/reasoning.js';
import { quantity } from '../domain/facts.js';

const AUTHOR = 'demo';

function observation(
  id: string,
  concept: keyof typeof CONCEPTS,
  num: number,
  unit: string,
  observedAt: string,
): PatientFact {
  return {
    id,
    kind: 'observation',
    concept: CONCEPTS[concept],
    value: quantity(num, unit),
    observedAt,
    recordedAt: observedAt,
    status: 'active',
    provenance: { origin: 'manual', actor: AUTHOR },
  };
}

const INITIAL_FACTS: PatientFact[] = [
  {
    id: 'med-spiro',
    kind: 'medication',
    concept: CONCEPTS.spironolactone,
    observedAt: '2024-01-10',
    recordedAt: '2024-01-10',
    status: 'active',
    provenance: { origin: 'manual', actor: AUTHOR },
  },
  observation('obs-k-58', 'potassium', 5.8, 'mmol/L', '2024-03-01'),
  observation('obs-egfr-28', 'egfr', 28, 'mL/min', '2023-06-14'),
];

const CORRECTION: Mutation[] = [
  { op: 'add_fact', fact: observation('obs-egfr-55', 'egfr', 55, 'mL/min', '2024-02-20') },
  {
    op: 'supersede_fact',
    factId: 'obs-egfr-28',
    by: 'obs-egfr-55',
    reason: 'value came from a resolved acute episode',
  },
];

// ── rendering ────────────────────────────────────────────────────────────────

const RULE = (title: string): string => `\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}\n`;

function describeFact(fact: PatientFact): string {
  const value = fact.value?.kind === 'quantity' ? ` ${fact.value.num} ${fact.value.unit}` : '';
  const status = fact.status === 'active' ? '' : `  [${fact.status}: ${fact.statusReason ?? ''}]`;
  return `    ${(fact.concept.display + value).padEnd(34)} observed ${fact.observedAt}${status}`;
}

function describeNode(node: ReasoningNode): string {
  const shown = ['severity', 'level', 'score', 'weight', 'urgency']
    .flatMap((k) => (node.attributes[k] === undefined ? [] : [`${k} ${String(node.attributes[k])}`]))
    .join(', ');
  return `    ${node.type.padEnd(11)} ${node.label}${shown === '' ? '' : `  (${shown})`}`;
}

function describeTree(tree: DerivationTree, depth = 0): string[] {
  const indent = '    '.repeat(depth + 1);
  const rule = tree.ruleId === undefined ? '' : `  [${tree.ruleId}]`;
  const evidence =
    tree.evidence.length === 0 ? '' : `  cites ${tree.evidence.map((e) => e.id).join(', ')}`;
  return [
    `${indent}${depth === 0 ? '' : '<- '}${tree.node.label}${rule}${evidence}`,
    ...tree.premises.flatMap((p) => describeTree(p, depth + 1)),
  ];
}

function describeMutation(mutation: Mutation): string {
  switch (mutation.op) {
    case 'add_fact':
      return `    + add ${mutation.fact.id}`;
    case 'supersede_fact':
      return `    ~ supersede ${mutation.factId} by ${mutation.by} — ${mutation.reason}`;
    case 'invalidate_fact':
      return `    x invalidate ${mutation.factId} — ${mutation.reason}`;
  }
}

function section(view: VersionView, title: string): string[] {
  const lines = [RULE(title), '  Patient facts'];
  lines.push(...view.facts.map(describeFact));
  lines.push('', '  Reasoning');
  lines.push(
    ...view.state.nodes
      .filter((n) => n.type !== 'Observation' && n.type !== 'Action')
      .map(describeNode),
  );
  const actions = view.state.nodes.filter((n) => n.type === 'Action');
  lines.push('', '  Recommendation');
  lines.push(
    ...(actions.length === 0
      ? ['    (none)']
      : actions.map((a) => `    ${a.label.padEnd(34)} urgency ${String(a.attributes['urgency'])}`)),
  );
  return lines;
}

/**
 * The Correction Demo, headless.
 *
 * Everything the milestone must show, with no UI in the way — which is the
 * point: if the value of an explicit reasoning state is not legible here, no
 * interface will rescue it.
 */
export async function runCorrectionDemo(): Promise<string> {
  const knowledge = AIMIG_KB_V0;
  const ctx: CaseContext = {
    store: new InMemoryReasoningStore(),
    engine: createEngine(),
    knowledge,
  };
  const caseId = 'canonical';

  await openCase(ctx, caseId, INITIAL_FACTS, {
    author: AUTHOR,
    at: '2024-03-01T09:00:00Z',
    intent: 'open the case with the recorded facts',
  });

  const { before, after, commit } = await applyCorrection(ctx, caseId, {
    intent: 'eGFR 28 came from a resolved acute episode; the latest reliable value is 55',
    author: AUTHOR,
    at: '2024-03-10T09:00:00Z',
    mutations: CORRECTION,
  });

  const out: string[] = [
    '',
    `  ${knowledge.validation.notice}`,
    '',
    '  AIMIG — The Correction Demo',
    `  case "${caseId}", knowledge ${knowledge.version}`,
  ];

  out.push(...section(before, `v${before.version} · initial state`));

  const recommendation = before.state.nodes.find((n) => n.type === 'Action')!;
  out.push(RULE('why this recommendation?'));
  out.push(...describeTree(explain(knowledge, before.state, recommendation.id)));

  out.push(RULE('correction'));
  out.push(`    intent: ${commit.intent}`);
  out.push(...CORRECTION.map(describeMutation));

  out.push(RULE('conclusions that depended on the corrected fact'));
  const affected = ctx.engine.affectedBy(before.state, 'obs-egfr-28');
  out.push(
    ...affected.map((id) => `    ${before.state.nodes.find((n) => n.id === id)!.conclusionKey}`),
  );
  const untouched = before.state.nodes
    .filter((n) => n.type !== 'Observation' && !affected.includes(n.id))
    .map((n) => n.conclusionKey);
  out.push('', '  not affected');
  out.push(...untouched.map((k) => `    ${k}`));

  out.push(...section(after, `v${after.version} · recomputed`));

  const diff = diffStates(knowledge, before, after, commit.mutations);
  out.push(RULE('diff'));
  out.push('  Superseded');
  out.push(
    ...(diff.facts.superseded.length === 0
      ? ['    (none)']
      : diff.facts.superseded.map((s) => `    ${s.fact.id} by ${s.by.id} — ${s.reason}`)),
  );
  out.push('  Added');
  out.push(
    ...(diff.facts.added.length === 0 ? ['    (none)'] : diff.facts.added.map((f) => `    ${f.id}`)),
  );
  out.push('  Retracted');
  out.push(
    ...(diff.nodes.retracted.length === 0
      ? ['    (none)']
      : diff.nodes.retracted.map((n) => `    ${n.conclusionKey}`)),
  );
  out.push('  Changed');
  out.push(
    ...diff.nodes.changed.map((c) => {
      const deltas = Object.entries(c.attributeDeltas)
        .map(([k, d]) => `${k} ${String(d.from)} -> ${String(d.to)}`)
        .join(', ');
      return `    ${c.conclusionKey.padEnd(46)} ${deltas || '(same values, different premises)'}  [${c.verdict}]`;
    }),
  );
  if (diff.recommendations.urgencyDelta !== undefined) {
    out.push(
      '',
      `  Recommendation urgency ${diff.recommendations.urgencyDelta.from} -> ${diff.recommendations.urgencyDelta.to}`,
    );
  }

  out.push(RULE('why did this recommendation change?'));
  const why = whyChanged(knowledge, before, after, commit.mutations, 'action:medication_review');
  out.push(`    verdict: ${why.verdict}`);
  out.push('    caused by');
  out.push(...why.causedBy.map(describeMutation));
  out.push('    premises lost');
  out.push(...why.premisesLost.flatMap((t) => describeTree(t, 1)));
  out.push('    premises gained');
  out.push(...why.premisesGained.flatMap((t) => describeTree(t, 1)));
  out.push(`    rules refired: ${why.rulesRefired.join(', ')}`);
  out.push(
    `    knowledge cited: ${why.knowledgeCited.map((k) => `${k.id} (${k.evidence[0]?.title ?? ''})`).join('; ')}`,
  );
  out.push(`    evidence: ${why.evidenceCited.map((e) => `${e.id} — ${e.title}`).join('; ')}`);

  out.push(
    '',
    `  ${knowledge.validation.notice}`,
    '',
  );
  return out.join('\n');
}
