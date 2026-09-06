/**
 * The benchmark case format — the executable specification of Milestone 0.
 *
 * These files answer "if this rule set is given to the engine, does it apply
 * its consequences correctly?". They never answer "is this rule medically
 * correct?". `validationScope` and `clinicalValidity` are mandatory precisely
 * so that the distinction cannot be dropped by oversight; the loader rejects a
 * case that omits them.
 */
export type BenchmarkCategory =
  | 'baseline'
  | 'conflict'
  | 'missing-information'
  | 'correction'
  | 'supersession'
  | 'no-change'
  | 'multi-hop';

export interface CaseFact {
  readonly id: string;
  readonly kind: 'observation' | 'medication' | 'condition';
  readonly concept: string;
  readonly value?: { readonly num: number; readonly unit: string };
  readonly observedAt: string;
  readonly recordedAt?: string;
}

export type CaseMutation =
  | { readonly op: 'add_fact'; readonly fact: CaseFact }
  | {
      readonly op: 'supersede_fact';
      readonly factId: string;
      readonly by: string;
      readonly reason: string;
    }
  | { readonly op: 'invalidate_fact'; readonly factId: string; readonly reason: string };

export interface StateExpectation {
  /** conclusionKeys that must be present among the derived (non-Observation) nodes. */
  readonly activeConclusions?: readonly string[];
  readonly absentConclusions?: readonly string[];
  readonly attributes?: Readonly<
    Record<string, Readonly<Record<string, string | number>>>
  >;
  /** `null` asserts that no recommendation is produced. */
  readonly recommendation?: { readonly key: string; readonly urgency: string } | null;
  readonly questions?: readonly string[];
  readonly conflicts?: readonly string[];
  /** Fact ids that must no longer project an Observation node. */
  readonly absentFactsFromState?: readonly string[];
  /** Fact ids whose layer-2 status must be exactly this — invariant 3. */
  readonly factStatus?: Readonly<Record<string, 'active' | 'superseded' | 'invalidated'>>;
  /**
   * conclusionKeys whose node id must be byte-identical to the previous
   * version. Ids being deterministic (D3), an unchanged id proves the premise
   * set is unchanged — this is the heart of the `no-change` category.
   */
  readonly identicalNodeIds?: readonly string[];
  readonly affectedBy?: {
    readonly factId: string;
    readonly mustInclude?: readonly string[];
    readonly mustExclude?: readonly string[];
  };
}

export interface DiffExpectation {
  readonly added?: readonly string[];
  readonly retracted?: readonly string[];
  readonly unchanged?: readonly string[];
  readonly changed?: readonly {
    readonly key: string;
    readonly from?: Readonly<Record<string, string | number>>;
    readonly to?: Readonly<Record<string, string | number>>;
    readonly verdict?: 'strengthened' | 'weakened' | 'changed';
  }[];
  /**
   * The most important assertion of the corpus: it checks that the explanation
   * cites the structured entities actually responsible, rather than a
   * plausible story assembled after the fact.
   */
  readonly whyChangedMustCite?: {
    readonly target: string;
    readonly verdict?: string;
    readonly facts?: readonly string[];
    readonly rules?: readonly string[];
    readonly knowledge?: readonly string[];
    readonly evidence?: readonly string[];
  };
  readonly whyChangedMustNotCite?: {
    readonly target: string;
    readonly facts?: readonly string[];
  };
}

export interface BenchmarkCase {
  readonly id: string;
  readonly category: BenchmarkCategory;
  readonly validationScope: 'reasoning_mechanics_only';
  readonly clinicalValidity: 'unvalidated';
  readonly description: string;
  readonly facts: readonly CaseFact[];
  readonly expectInitial: StateExpectation;
  readonly correction?: {
    readonly intent: string;
    readonly mutations: readonly CaseMutation[];
  };
  readonly expectAfterState?: StateExpectation;
  readonly expectAfterDiff?: DiffExpectation;
}

/** The three assertion blocks a case can carry. A case without a correction has one. */
export type BlockName = 'initial' | 'after_state' | 'after_diff';

export function blocksOf(c: BenchmarkCase): BlockName[] {
  return c.correction === undefined
    ? ['initial']
    : ['initial', 'after_state', 'after_diff'];
}
