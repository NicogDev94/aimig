import type {
  EvidenceRef,
  KnowledgeAssertion,
  KnowledgeBase,
} from '../domain/knowledge.js';

/**
 * Resolves knowledge ids back to what they cite.
 *
 * `Derivation.knowledgeUsed` stores ids so that a reasoning state stays a small
 * value object. Explanations need the objects — and, more importantly, the
 * evidence behind them, which is what makes an answer checkable by a human
 * rather than merely plausible.
 */
export class KnowledgeIndex {
  readonly #assertions: ReadonlyMap<string, KnowledgeAssertion>;
  readonly #evidence: ReadonlyMap<string, readonly EvidenceRef[]>;

  constructor(kb: KnowledgeBase) {
    this.#assertions = new Map(kb.assertions.map((a) => [a.id, a]));
    // Bands, action rules and aggregation scales are not assertions, but they
    // carry evidence too — a threshold is a claim about the world just as much
    // as a risk edge is.
    this.#evidence = new Map<string, readonly EvidenceRef[]>([
      ...kb.assertions.map((a) => [a.id, a.evidence] as const),
      ...kb.bands.map((b) => [b.id, b.evidence] as const),
      ...kb.actions.map((a) => [a.id, a.evidence] as const),
      ...kb.aggregations.map((a) => [a.id, a.evidence] as const),
    ]);
  }

  assertions(ids: readonly string[]): KnowledgeAssertion[] {
    return ids.flatMap((id) => {
      const found = this.#assertions.get(id);
      return found === undefined ? [] : [found];
    });
  }

  evidence(ids: readonly string[]): EvidenceRef[] {
    const seen = new Map<string, EvidenceRef>();
    for (const id of ids) {
      for (const ref of this.#evidence.get(id) ?? []) seen.set(ref.id, ref);
    }
    return [...seen.values()];
  }
}
