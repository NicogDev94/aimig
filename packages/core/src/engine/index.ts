import type { ReasoningEngine } from '../contracts.js';
import { derive } from './derive.js';
import { explain } from './explain.js';
import { affectedBy } from './dependencies.js';

export { derive } from './derive.js';
export { explain } from './explain.js';
export { affectedBy, dependents } from './dependencies.js';
export { KnowledgeIndex } from './knowledge-index.js';
export * from './rule-kinds.js';
export { RULES } from './rules/index.js';

/**
 * The deterministic engine: no LLM, no I/O, no clock.
 *
 * A factory rather than a singleton so a test can hold two engines without
 * sharing anything — there is no state to share today, and keeping it that way
 * is the point.
 */
export function createEngine(): ReasoningEngine {
  return {
    derive: (knowledge, facts, version) => derive(knowledge, facts, version),
    explain: (knowledge, state, nodeId) => explain(knowledge, state, nodeId),
    affectedBy: (state, factId) => affectedBy(state, factId),
  };
}
