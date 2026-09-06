import { describe, it } from 'vitest';
import { formatReport, runBenchmark } from './benchmark/harness.js';

/**
 * `yarn benchmark` — prints the full report and never fails.
 *
 * The gate is `benchmark-floor.test.ts`, which is part of the normal suite.
 * Separating the two keeps CI meaningful at every point of the milestone: the
 * score is always visible, and the ratchet is a number that can only go up.
 */
describe('benchmark report', () => {
  it('runs every case', () => {
    // eslint-disable-next-line no-console
    console.log(formatReport(runBenchmark()));
  });
});
