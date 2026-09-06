import { sameConcept } from '../../domain/common.js';
import type { ThresholdBand } from '../../domain/knowledge.js';
import type { PatientFact } from '../../domain/facts.js';
import type { Rule, RuleOutput } from '../rule-kinds.js';

function matches(band: ThresholdBand, fact: PatientFact): boolean {
  if (!sameConcept(band.analyte, fact.concept)) return false;
  const value = fact.value;
  if (value === undefined || value.kind !== 'quantity') return false;
  // A unit mismatch is not a near miss to be coerced: 5.8 mmol/L and 5.8 mg/dL
  // are different claims, and silently converting is how a demo becomes a bug.
  if (value.unit !== band.unit) return false;
  // `min` inclusive, `max` exclusive, so adjacent bands cannot both fire.
  if (band.min !== undefined && value.num < band.min) return false;
  if (band.max !== undefined && value.num >= band.max) return false;
  return true;
}

/**
 * Turns a measured value into a qualitative claim.
 *
 * A value matching no band concludes nothing at all. Silence is not a
 * conclusion: a system that always says something cannot be trusted when it
 * says something.
 */
export const thresholdRule: Rule = {
  kind: 'threshold',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];
    for (const fact of ctx.facts) {
      const observation = ctx.observationNodeOf(fact.id);
      if (observation === undefined) continue;
      for (const band of ctx.knowledge.bands) {
        if (!matches(band, fact)) continue;
        const value = fact.value;
        out.push({
          ruleId: `threshold.${band.analyte.code}`,
          type: 'Claim',
          conclusionKey: band.conclusion.code,
          label: `${band.conclusion.display} (${band.severity})`,
          attributes: {
            severity: band.severity,
            ...(value !== undefined && value.kind === 'quantity'
              ? { value: value.num, unit: value.unit }
              : {}),
          },
          premises: [{ nodeId: observation.id, edgeType: 'supports' }],
          knowledgeUsed: [band.id],
        });
      }
    }
    return out;
  },
};
