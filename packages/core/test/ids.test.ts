import { describe, expect, it } from 'vitest';
import {
  derivedNodeId,
  factIdOfObservationNode,
  isObservationNodeId,
  observationNodeId,
} from '../src/index.js';
import { supports } from './helpers.js';

describe('derived identity', () => {
  it('is stable regardless of premise order', () => {
    const a = derivedNodeId('r', 'c', [supports('p2'), supports('p1')]);
    const b = derivedNodeId('r', 'c', [supports('p1'), supports('p2')]);
    expect(a).toBe(b);
  });

  it('differs when the premises differ', () => {
    const a = derivedNodeId('r', 'c', [supports('p1')]);
    const b = derivedNodeId('r', 'c', [supports('p2')]);
    expect(a).not.toBe(b);
  });

  it('differs when the rule differs', () => {
    expect(derivedNodeId('r1', 'c', [supports('p')])).not.toBe(
      derivedNodeId('r2', 'c', [supports('p')]),
    );
  });

  it('is readable, so a diff can be understood by eye', () => {
    expect(derivedNodeId('threshold.egfr', 'renal_impairment', [supports('obs#f1')])).toBe(
      'threshold.egfr#renal_impairment#obs#f1',
    );
  });
});

describe('observation identity', () => {
  it('round-trips a fact id', () => {
    const id = observationNodeId('obs-egfr-28');
    expect(isObservationNodeId(id)).toBe(true);
    expect(factIdOfObservationNode(id)).toBe('obs-egfr-28');
  });

  it('does not claim derived ids', () => {
    expect(isObservationNodeId('threshold.egfr#renal_impairment#obs#f1')).toBe(false);
  });
});
