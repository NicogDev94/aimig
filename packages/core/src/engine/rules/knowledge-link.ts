import { sameConcept } from '../../domain/common.js';
import type { Severity, Strength } from '../../domain/knowledge.js';
import type { ReasoningNode } from '../../domain/reasoning.js';
import type { Rule, RuleContext, RuleOutput } from '../rule-kinds.js';

function severityOf(node: ReasoningNode): Severity | undefined {
  const value = node.attributes['severity'];
  return value === 'mild' || value === 'moderate' || value === 'severe'
    ? value
    : undefined;
}

/**
 * Weight of one contribution.
 *
 * A medication either is or is not being taken, so its weight is the strength
 * of the knowledge edge. A claim comes in degrees, so a strong edge from a mild
 * claim must not carry a strong contribution — the weaker of the two governs.
 * That is what makes the canonical scenario weaken rather than collapse when
 * severe renal impairment becomes moderate.
 */
function weightOf(
  strength: Strength,
  severity: Severity | undefined,
  points: { strengthPoints: Record<Strength, number>; severityPoints: Record<Severity, number> },
): number {
  const byStrength = points.strengthPoints[strength];
  if (severity === undefined) return byStrength;
  return Math.min(byStrength, points.severityPoints[severity]);
}

function subjectNodes(ctx: RuleContext, subjectCode: string): ReasoningNode[] {
  // A subject is either something the patient takes (a fact) or something the
  // engine has already concluded (a claim).
  const fromFacts = ctx.facts
    .filter((f) => f.concept.code === subjectCode)
    .flatMap((f) => {
      const node = ctx.observationNodeOf(f.id);
      return node === undefined ? [] : [node];
    });
  return [...fromFacts, ...ctx.nodesWithKey(subjectCode)];
}

/** Walks `increases_risk_of` edges to produce weighted contributions. */
export const knowledgeLinkRule: Rule = {
  kind: 'knowledge_link',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];
    const scoring = ctx.knowledge.scoring;

    for (const assertion of ctx.knowledge.assertions) {
      if (assertion.predicate !== 'increases_risk_of') continue;

      for (const source of subjectNodes(ctx, assertion.subject.code)) {
        // A contribution from a fact the patient no longer has, or from a claim
        // that no longer holds, simply never fires — there is nothing to retract.
        const severity = severityOf(source);
        const weight = weightOf(assertion.strength, severity, scoring);
        out.push({
          ruleId: 'knowledge_link',
          type: 'Claim',
          conclusionKey: `contribution:${assertion.object.code}:${assertion.subject.code}`,
          label: `${assertion.subject.display} increases the risk of ${assertion.object.display}`,
          attributes: {
            weight,
            strength: assertion.strength,
            target: assertion.object.code,
            subject: assertion.subject.code,
            ...(severity === undefined ? {} : { severity }),
          },
          premises: [{ nodeId: source.id, edgeType: 'increases_likelihood' }],
          knowledgeUsed: [assertion.id],
        });
      }
    }
    return out;
  },
};

export { sameConcept };
