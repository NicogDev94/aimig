import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ReasoningStore } from '../contracts.js';
import type { Version } from '../domain/common.js';
import type { CaseLog, Commit } from '../domain/log.js';
import { validateCommit } from '../mutations/index.js';

/**
 * One JSON file per case.
 *
 * Node-only, which is why it lives outside the browser-safe main entry point
 * and is imported as `@aimig/core/node`. SQLite belongs here the day
 * multi-session persistence is real; the interface exists so that day is
 * uneventful, not because several backends are planned.
 */
export class JsonFileReasoningStore implements ReasoningStore {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  #path(caseId: string): string {
    return join(this.#dir, `${caseId}.json`);
  }

  async has(caseId: string): Promise<boolean> {
    return existsSync(this.#path(caseId));
  }

  async create(caseId: string): Promise<CaseLog> {
    if (await this.has(caseId)) return this.load(caseId);
    const log: CaseLog = { caseId, commits: [] };
    this.#write(log);
    return log;
  }

  async load(caseId: string): Promise<CaseLog> {
    const path = this.#path(caseId);
    if (!existsSync(path)) throw new Error(`unknown case "${caseId}"`);
    return JSON.parse(readFileSync(path, 'utf8')) as CaseLog;
  }

  async append(caseId: string, commit: Commit): Promise<Version> {
    const log = await this.load(caseId);
    validateCommit(log, commit);
    this.#write({ caseId, commits: [...log.commits, commit] });
    return commit.version;
  }

  #write(log: CaseLog): void {
    mkdirSync(dirname(this.#path(log.caseId)), { recursive: true });
    writeFileSync(this.#path(log.caseId), `${JSON.stringify(log, null, 2)}\n`, 'utf8');
  }
}
