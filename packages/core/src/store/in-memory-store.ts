import type { ReasoningStore } from '../contracts.js';
import type { CaseLog, Commit, Version } from '../domain/index.js';

/** Volatile store. Used by tests and by the benchmark harness. */
export class InMemoryReasoningStore implements ReasoningStore {
  readonly #logs = new Map<string, CaseLog>();

  async has(caseId: string): Promise<boolean> {
    return this.#logs.has(caseId);
  }

  async create(caseId: string): Promise<CaseLog> {
    const existing = this.#logs.get(caseId);
    if (existing) return existing;
    const log: CaseLog = { caseId, commits: [] };
    this.#logs.set(caseId, log);
    return log;
  }

  async load(caseId: string): Promise<CaseLog> {
    const log = this.#logs.get(caseId);
    if (!log) throw new Error(`unknown case "${caseId}"`);
    return log;
  }

  async append(caseId: string, commit: Commit): Promise<Version> {
    const log = await this.load(caseId);
    const expected = log.commits.length + 1;
    if (commit.version !== expected) {
      throw new Error(
        `commit version ${commit.version} does not follow case "${caseId}" (expected ${expected})`,
      );
    }
    this.#logs.set(caseId, { caseId, commits: [...log.commits, commit] });
    return commit.version;
  }
}
