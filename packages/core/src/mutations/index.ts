import type { NodeId, Version } from '../domain/common.js';
import type { PatientFact } from '../domain/facts.js';
import type { CaseLog, Commit, Mutation } from '../domain/log.js';

export class MutationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MutationValidationError';
  }
}

function require(condition: boolean, message: string): asserts condition {
  if (!condition) throw new MutationValidationError(message);
}

/**
 * Applies one mutation to the fact set.
 *
 * Nothing is ever removed. A correction changes a fact's status and records the
 * human reason next to it; the fact itself stays on the record, which is where
 * invariant 3 lives. The reasoning layer stops projecting it, and that is a
 * separate concern entirely.
 */
function apply(facts: readonly PatientFact[], mutation: Mutation): PatientFact[] {
  const find = (id: NodeId): PatientFact | undefined => facts.find((f) => f.id === id);

  switch (mutation.op) {
    case 'add_fact': {
      require(
        find(mutation.fact.id) === undefined,
        `cannot add fact "${mutation.fact.id}": a fact with that id already exists`,
      );
      require(
        mutation.fact.status === 'active',
        `a fact enters the record active; "${mutation.fact.id}" arrived as "${mutation.fact.status}"`,
      );
      return [...facts, mutation.fact];
    }

    case 'supersede_fact': {
      const target = find(mutation.factId);
      require(target !== undefined, `cannot supersede unknown fact "${mutation.factId}"`);
      require(
        target.status === 'active',
        `fact "${mutation.factId}" is already "${target.status}" and cannot be superseded again`,
      );
      require(
        mutation.factId !== mutation.by,
        `fact "${mutation.factId}" cannot supersede itself`,
      );
      const replacement = find(mutation.by);
      require(
        replacement !== undefined,
        `cannot supersede "${mutation.factId}" by unknown fact "${mutation.by}"; add it first, in the same commit if need be`,
      );
      // Supersession is a human judgement (D6), never inferred from observedAt.
      // The reason is the judgement, so it is not optional.
      require(
        mutation.reason.trim() !== '',
        `superseding "${mutation.factId}" requires a reason`,
      );
      return facts.map((f) =>
        f.id === mutation.factId
          ? { ...f, status: 'superseded' as const, supersededBy: mutation.by, statusReason: mutation.reason }
          : f,
      );
    }

    case 'invalidate_fact': {
      const target = find(mutation.factId);
      require(target !== undefined, `cannot invalidate unknown fact "${mutation.factId}"`);
      require(
        target.status === 'active',
        `fact "${mutation.factId}" is already "${target.status}"`,
      );
      require(
        mutation.reason.trim() !== '',
        `invalidating "${mutation.factId}" requires a reason`,
      );
      return facts.map((f) =>
        f.id === mutation.factId
          ? { ...f, status: 'invalidated' as const, statusReason: mutation.reason }
          : f,
      );
    }
  }
}

/**
 * Folds mutations onto a fact set, in order.
 *
 * Order matters inside a commit: the canonical correction adds the replacement
 * eGFR and then supersedes the old one by it, which only validates if the two
 * are applied in sequence.
 */
export function applyMutations(
  facts: readonly PatientFact[],
  mutations: readonly Mutation[],
): PatientFact[] {
  return mutations.reduce<PatientFact[]>((acc, m) => apply(acc, m), [...facts]);
}

/**
 * Replays the canonical log up to a version.
 *
 * This is the whole persistence model: the log holds assertions, and every
 * version of the truth is a fold over it. Nothing else needs storing.
 */
export function factsAt(log: CaseLog, version: Version): PatientFact[] {
  const commits = log.commits.filter((c) => c.version <= version);
  return commits.reduce<PatientFact[]>(
    (facts, commit) => applyMutations(facts, commit.mutations),
    [],
  );
}

/** Validates a commit against the state it will be applied to. Throws, or returns. */
export function validateCommit(log: CaseLog, commit: Commit): void {
  const expected = log.commits.length + 1;
  require(
    commit.version === expected,
    `commit version ${commit.version} does not follow this case (expected ${expected})`,
  );
  require(commit.intent.trim() !== '', 'a commit must say what it is for');
  require(commit.mutations.length > 0, 'a commit with no mutation changes nothing');
  applyMutations(factsAt(log, commit.version - 1), commit.mutations);
}
