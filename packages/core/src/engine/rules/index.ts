import type { Rule } from '../rule-kinds.js';
import { thresholdRule } from './threshold.js';
import { knowledgeLinkRule } from './knowledge-link.js';
import { aggregateRule } from './aggregate.js';
import { actionRule } from './action.js';
import { gapRule } from './gap.js';
import { conflictRule } from './conflict.js';

/**
 * The complete rule set. Six kinds, frozen.
 *
 * Order does not matter — the engine iterates to a fixed point — but it is
 * written in dependency order so the file reads like the reasoning it performs.
 */
export const RULES: readonly Rule[] = [
  thresholdRule,
  conflictRule,
  gapRule,
  knowledgeLinkRule,
  aggregateRule,
  actionRule,
];

export { thresholdRule, knowledgeLinkRule, aggregateRule, actionRule, gapRule, conflictRule };
