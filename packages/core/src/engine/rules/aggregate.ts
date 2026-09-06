import type { Severity } from '../../domain/knowledge.js';
import type { Premise, ReasoningNode } from '../../domain/reasoning.js';
import type { Rule, RuleOutput } from '../rule-kinds.js';

const SEVERITIES: readonly Severity[] = ['mild', 'moderate', 'severe'];

function strongest(nodes: readonly ReasoningNode[]): ReasoningNode | undefined {
  // Two active observations of the same analyte can both produce a claim — that
  // is the conflict case. The aggregate must not count it twice, and taking the
  // strongest is the choice that does not quietly reassure.
  return nodes.reduce<ReasoningNode | undefined>((best, node) => {
    if (best === undefined) return node;
    const a = SEVERITIES.indexOf(node.attributes['severity'] as Severity);
    const b = SEVERITIES.indexOf(best.attributes['severity'] as Severity);
    return a > b ? node : best;
  }, undefined);
}

/**
 * Sums contributions into a level.
 *
 * The scale is arbitrary and lives in the knowledge base as data. It exists to
 * make propagation observable, not because it is clinically defensible — see
 * `KnowledgeBase.validation`.
 */
export const aggregateRule: Rule = {
  kind: 'aggregate',
  fire(ctx): RuleOutput[] {
    const out: RuleOutput[] = [];
    const { severityPoints } = ctx.knowledge.scoring;

    for (const scale of ctx.knowledge.aggregations) {
      const prefix = `contribution:${scale.target}:`;
      const contributions = ctx.nodes.filter((n) => n.conclusionKey.startsWith(prefix));

      // The target concept being asserted outright is the strongest possible
      // indicator of concern about it, so it counts alongside the risk factors.
      const direct = strongest(ctx.nodesWithKey(scale.target));
      const directSeverity = direct?.attributes['severity'] as Severity | undefined;

      const score =
        contributions.reduce((sum, n) => sum + Number(n.attributes['weight'] ?? 0), 0) +
        (directSeverity === undefined ? 0 : severityPoints[directSeverity]);

      const level = [...scale.levels]
        .filter((l) => score >= l.minScore)
        .sort((a, b) => b.minScore - a.minScore)[0];

      // Below the lowest threshold there is no concern to state.
      if (level === undefined) continue;

      const premises: Premise[] = [
        ...contributions.map(
          (n): Premise => ({ nodeId: n.id, edgeType: 'increases_likelihood' }),
        ),
        ...(direct === undefined
          ? []
          : [{ nodeId: direct.id, edgeType: 'supports' } as Premise]),
      ];
      if (premises.length === 0) continue;

      out.push({
        ruleId: `aggregate.${scale.target}`,
        type: 'Hypothesis',
        conclusionKey: scale.conclusionKey,
        label: `${scale.label} (${level.level})`,
        attributes: { level: level.level, score, target: scale.target },
        premises,
        knowledgeUsed: [scale.id],
      });
    }
    return out;
  },
};
