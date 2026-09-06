import { describe, expect, it } from 'vitest';
import { formatReport, runBenchmark } from './benchmark/harness.js';

/**
 * The milestone ratchet.
 *
 * 20 cases yield 50 assertion blocks: every case has an `initial` block, and
 * the 15 carrying a correction also have `after_state` and `after_diff`.
 *
 *   PR2  0/50   the specification exists and is executable
 *   PR3  20/50  every initial derivation is correct
 *   PR4  35/50  every correction produces the right state
 *   PR5  50/50  every diff and every citation is correct
 *
 * Each PR raises the floor. It can never silently go back down.
 */
const BENCHMARK_FLOOR = 0;

describe('benchmark', () => {
  it('has 20 cases and 50 assertion blocks', () => {
    const report = runBenchmark();
    expect(report.cases).toBe(20);
    expect(report.total).toBe(50);
  });

  it(`scores at least ${BENCHMARK_FLOOR}/50`, () => {
    const report = runBenchmark();
    if (report.passed < BENCHMARK_FLOOR) {
      throw new Error(
        `benchmark regressed to ${report.passed}/${report.total}, floor is ${BENCHMARK_FLOOR}\n${formatReport(report)}`,
      );
    }
    expect(report.passed).toBeGreaterThanOrEqual(BENCHMARK_FLOOR);
  });
});
