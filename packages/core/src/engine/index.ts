import { NotImplementedError, type ReasoningEngine } from '../contracts.js';

/**
 * The deterministic engine.
 *
 * Implemented in PR3 (derivation) and PR4 (dependencies). The factory exists
 * now so that the benchmark harness of PR2 can be written against a stable
 * import and never has to be rewritten.
 */
export function createEngine(): ReasoningEngine {
  return {
    derive() {
      throw new NotImplementedError('derive');
    },
    explain() {
      throw new NotImplementedError('explain');
    },
    affectedBy() {
      throw new NotImplementedError('affectedBy');
    },
  };
}
