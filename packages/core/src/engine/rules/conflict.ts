import { sameConcept } from '../../domain/common.js';
import type { PatientFact } from '../../domain/facts.js';
import type { Rule, RuleOutput } from '../rule-kinds.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysApart(a: PatientFact, b: PatientFact): number {
  return Math.abs(Date.parse(a.observedAt) - Date.parse(b.observedAt)) / DAY_MS;
}

function numeric(fact: PatientFact): number | undefined {
  return fact.value?.kind === 'quantity' ? fact.value.num : undefined;
}

/**
 * Surfaces two active facts that cannot be read together.
 *
 * The engine never arbitrates. It cannot know which result is wrong, so both
 * keep contributing and the Conflict stays visible until a human supersedes or
 * invalidates one. Suppressing the downstream reasoning would be a silent
 * arbitration — the exact thing an inspectable reasoning state exists to
 * prevent.
 *
 * Results far enough apart in time are history, not a disagreement.
 */
export const conflictRule: Rule = {
  kind: 'conflict',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];

    for (const rule of ctx.knowledge.conflicts) {
      const candidates = ctx.facts.filter(
        (f) => sameConcept(f.concept, rule.analyte) && numeric(f) !== undefined,
      );

      for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
          const a = candidates[i]!;
          const b = candidates[j]!;
          const spread = Math.abs(numeric(a)! - numeric(b)!);
          if (spread <= rule.tolerance) continue;
          if (daysApart(a, b) > rule.withinDays) continue;

          const nodeA = ctx.observationNodeOf(a.id);
          const nodeB = ctx.observationNodeOf(b.id);
          if (nodeA === undefined || nodeB === undefined) continue;

          out.push({
            ruleId: `conflict.${rule.analyte.code}`,
            type: 'Conflict',
            conclusionKey: `conflict:${rule.analyte.code}`,
            label: `Two active ${rule.analyte.display} results disagree (${numeric(a)!} vs ${numeric(b)!})`,
            attributes: {
              analyte: rule.analyte.code,
              spread: Number(spread.toFixed(3)),
              tolerance: rule.tolerance,
            },
            premises: [
              { nodeId: nodeA.id, edgeType: 'contradicts' },
              { nodeId: nodeB.id, edgeType: 'contradicts' },
            ],
            knowledgeUsed: [rule.id],
          });
        }
      }
    }
    return out;
  },
};
