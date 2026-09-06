import type { ReasoningEngine, ReasoningStore } from './contracts.js';
import type { Version } from './domain/common.js';
import type { PatientFact } from './domain/facts.js';
import type { KnowledgeBase } from './domain/knowledge.js';
import type { CaseLog, Commit, Mutation } from './domain/log.js';
import { latestVersion } from './domain/log.js';
import type { ReasoningState } from './domain/reasoning.js';
import { factsAt, validateCommit } from './mutations/index.js';

/**
 * Composition of a store and an engine.
 *
 * Deliberately a set of free functions rather than a class: there is no state
 * to hold. The store persists assertions, the engine derives conclusions, and
 * nothing in between needs to remember anything.
 */
export interface CaseContext {
  readonly store: ReasoningStore;
  readonly engine: ReasoningEngine;
  readonly knowledge: KnowledgeBase;
}

export interface VersionView {
  readonly version: Version;
  readonly facts: readonly PatientFact[];
  readonly state: ReasoningState;
}

/** The facts and the reasoning as they stood at a version. */
export async function stateAt(
  ctx: CaseContext,
  caseId: string,
  version: Version,
): Promise<VersionView> {
  const log = await ctx.store.load(caseId);
  const facts = factsAt(log, version);
  return { version, facts, state: ctx.engine.derive(ctx.knowledge, facts, version) };
}

export async function currentState(
  ctx: CaseContext,
  caseId: string,
): Promise<VersionView> {
  const log = await ctx.store.load(caseId);
  return stateAt(ctx, caseId, latestVersion(log));
}

/**
 * Records a correction and recomputes.
 *
 * The recomputation is total (D2). Only the log is written; the reasoning is
 * never stored, so there is nothing that could fall out of step with it.
 */
export async function applyCorrection(
  ctx: CaseContext,
  caseId: string,
  correction: {
    readonly intent: string;
    readonly author: string;
    readonly at: string;
    readonly mutations: readonly Mutation[];
  },
): Promise<{ readonly before: VersionView; readonly after: VersionView; readonly commit: Commit }> {
  const log = await ctx.store.load(caseId);
  const before = await stateAt(ctx, caseId, latestVersion(log));

  const commit: Commit = {
    version: log.commits.length + 1,
    at: correction.at,
    author: correction.author,
    intent: correction.intent,
    knowledgeVersion: ctx.knowledge.version,
    mutations: correction.mutations,
  };

  validateCommit(log, commit);
  await ctx.store.append(caseId, commit);

  return { before, after: await stateAt(ctx, caseId, commit.version), commit };
}

/** Seeds a new case with its starting facts as commit 1. */
export async function openCase(
  ctx: CaseContext,
  caseId: string,
  facts: readonly PatientFact[],
  meta: { readonly author: string; readonly at: string; readonly intent: string },
): Promise<CaseLog> {
  await ctx.store.create(caseId);
  await ctx.store.append(caseId, {
    version: 1,
    at: meta.at,
    author: meta.author,
    intent: meta.intent,
    knowledgeVersion: ctx.knowledge.version,
    mutations: facts.map((fact) => ({ op: 'add_fact' as const, fact })),
  });
  return ctx.store.load(caseId);
}
