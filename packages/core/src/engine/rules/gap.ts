import type { Rule, RuleOutput } from '../rule-kinds.js';

/**
 * States a missing input as a question.
 *
 * When a rule needs a value that has no active fact, the engine says so instead
 * of reasoning as though the value were normal. Absence of data is not evidence
 * of absence, and a silent gap is the most dangerous kind.
 */
export const gapRule: Rule = {
  kind: 'gap',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];
    for (const assertion of ctx.knowledge.assertions) {
      if (assertion.predicate !== 'requires_monitoring_of') continue;

      const holders = ctx.facts.filter((f) => f.concept.code === assertion.subject.code);
      if (holders.length === 0) continue;

      const measured = ctx.facts.some((f) => f.concept.code === assertion.object.code);
      if (measured) continue;

      const premises = holders.flatMap((f) => {
        const node = ctx.observationNodeOf(f.id);
        return node === undefined ? [] : [{ nodeId: node.id, edgeType: 'requires' as const }];
      });
      if (premises.length === 0) continue;

      out.push({
        ruleId: `gap.${assertion.object.code}`,
        type: 'Question',
        conclusionKey: `question:${assertion.object.code}`,
        label: `${assertion.object.display} is required to reason about ${assertion.subject.display} but has not been measured`,
        attributes: { analyte: assertion.object.code, required_by: assertion.subject.code },
        premises,
        knowledgeUsed: [assertion.id],
      });
    }
    return out;
  },
};
