import type { Rule, RuleOutput } from '../rule-kinds.js';

/**
 * Turns a hypothesis into a recommendation.
 *
 * The recommendation is a typed derived node with premises, not a generated
 * sentence — invariant 8. Its text is a label on a structure, and the structure
 * is what `Why?` walks.
 */
export const actionRule: Rule = {
  kind: 'action',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];
    for (const rule of ctx.knowledge.actions) {
      for (const hypothesis of ctx.nodesWithKey(rule.whenConclusion)) {
        if (hypothesis.attributes['level'] !== rule.whenLevel) continue;
        out.push({
          ruleId: 'action',
          type: 'Action',
          conclusionKey: `action:${rule.actionKey}`,
          label: rule.actionLabel,
          attributes: {
            actionKey: rule.actionKey,
            urgency: rule.urgency,
          },
          premises: [{ nodeId: hypothesis.id, edgeType: 'recommends' }],
          knowledgeUsed: [rule.id],
        });
      }
    }
    return out;
  },
};
