# AIMIG

**Assisted Intelligence in Medicine using Interactive Graphs**

> Clinical reasoning should have an explicit shared state that both humans and
> computational systems can inspect and modify.

---

> ## ⚠️ Synthetic research rule set. Not clinically validated. Not for clinical use.
>
> AIMIG is a research prototype. Its rule set is synthetic and exists to test
> whether the reasoning **mechanism** works — not whether its clinical content
> is correct. No threshold in this repository is endorsed by AIMIG as medical
> guidance. From PR2 onward this notice is carried as data on the knowledge
> base itself (`KnowledgeBase.validation`) and rendered from there, so that the
> rule set can never be displayed without its status.

---

## What AIMIG is

A **Clinical Reasoning State** that is explicit, inspectable, versioned and
correctable. When a piece of patient information is corrected, AIMIG identifies
every conclusion that depended on it, recomputes, and can explain exactly what
changed and why — reconstructed from structured mutations and real
dependencies, not narrated after the fact.

AIMIG is **not** a medical chatbot, **not** a knowledge graph, **not** a Neo4j
editor, and **not** a system where an LLM owns the canonical state.

> The LLM reads and proposes. The reasoning state governs.

## Three layers, kept separate

| Layer | Holds | Changes how |
|---|---|---|
| **1 · Medical Knowledge** | general truths, with structured evidence | frozen in Milestone 0 |
| **2 · Patient / Context** | bi-temporal facts about one patient | append-only log of explicit mutations |
| **3 · Clinical Reasoning** | hypotheses, claims, actions, questions, conflicts | **recomputed**, never stored |

The third layer is a pure function of the first two:

```
ReasoningState(v) = derive(knowledge, factsAt(v))
```

Nothing in layer 3 is persisted. That is what makes the state reproducible from
the log alone — with no conversation history, no cache, and no LLM.

## Repository layout

```
packages/core     the reasoning engine — TypeScript, zero runtime dependencies
packages/web      Research UI (PR6, gated — see docs/milestone-0.md §7)
benchmark/cases   the executable specification (PR2)
docs/             the frozen Milestone 0 plan
```

`@aimig/core` carries **no runtime dependency**, and that is enforced by the
build rather than by convention: it is how "the canonical state is independent
of the LLM and of the storage" stays a fact instead of an intention.

## Getting started

```bash
yarn install
yarn typecheck
yarn test
```

## Milestone 0 — The Correction Demo

The full plan, its architecture decisions and its PR sequence live in
[`docs/milestone-0.md`](docs/milestone-0.md).

The scenario the milestone must demonstrate end to end:

```
Patient: spironolactone, potassium 5.8 mmol/L, eGFR 28
  -> HIGH concern, urgent medication review

Correction: eGFR 28 came from a resolved acute episode; latest reliable is 55

  -> superseded: eGFR 28          -> added: eGFR 55
  -> weakened:  renal impairment  -> weakened: hyperkalemia risk
  -> recommendation urgency HIGH -> MODERATE
  -> "Why did this change?" answered from the mutations and the dependencies
```

## Security

The 2023 prototype published database credentials in a public bundle. See
[`SECURITY.md`](SECURITY.md) — revocation is the repository owner's action.
