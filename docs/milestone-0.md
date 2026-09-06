# AIMIG — Milestone 0: The Correction Demo

**Status: frozen.** This document is the reference for PR0 → PR7. Changes to it
are decisions, not edits.

## Objective

Demonstrate end to end that a clinical reasoning state can be corrected and
that the system can explain the consequences:

1. a simple clinical case is represented as a structured reasoning state;
2. the system produces explicit reasoning linking observations, knowledge,
   hypotheses and actions;
3. an observation is corrected, replaced or marked obsolete;
4. AIMIG identifies every dependent conclusion;
5. invalid branches are recomputed;
6. the recommendation evolves if it must;
7. the system can say precisely what changed, what was invalidated, why the
   recommendation changed, and which premises now support it.

### Canonical scenario

```
Initial            spironolactone · potassium 5.8 mmol/L · eGFR 28
                   eGFR 28 -> renal impairment -> increases hyperkalemia risk
                   spironolactone -> increases hyperkalemia risk
                   potassium 5.8 -> hyperkalemia
                   => HIGH concern, urgent medication review

Correction         eGFR 28 was from an old acute episode.
                   Latest reliable eGFR = 55.

Expected           superseded: eGFR 28          added: eGFR 55
                   weakened:   severe renal impairment
                               renal contribution to hyperkalemia risk
                   changed:    recommendation urgency HIGH -> MODERATE
```

`Why did the recommendation change?` must be answered from the reasoning state
and its history — never from a justification an LLM invents after the fact.

---

## Architecture decisions

### D1 — Reasoning is a pure function, not stored state

```
ReasoningState(v) = derive(knowledge, factsAt(v))
```

The canonical log holds **assertions only**: add a fact, supersede, invalidate.
No conclusion is persisted; hypotheses, claims and actions are recomputed on
read.

*Why*: it makes invariants 4, 9 and 10 true by construction rather than by
discipline. A conclusion cannot exist without its premises, because it exists
only as the output of a derivation. And the state is reproducible from the log
alone — no conversation history, no cache, no LLM.

### D2 — Full recompute, not incremental propagation

On a state of a few dozen nodes a full `derive` costs microseconds, while
incremental invalidation is a classic source of bugs (partial invalidation,
recomputation order, orphaned nodes) for no observable gain.

The dependency graph is still essential — it just does not drive the
computation. "Which conclusions depended on this eGFR?" is a query over the
previous state's dependency graph. Separating the two yields the behaviour the
milestone requires at a fraction of the complexity.

### D2bis — The current state contains only the nodes of its version

Derived nodes carry **no status** and no ghosts are kept. `retracted` is a
category of `ReasoningDiff`, not a state of a node.

*Why it is safe*: derivation is reproducible (D1), so any earlier version can
be recomputed on demand. Nothing is lost, so nothing needs to be dragged along.
History lives in layer 2 (append-only) and in diffs — never in layer 3.

*Corollary*: a superseded fact no longer projects an `Observation` node. It
stays fully visible in layer 2 with its status and reason — that is where
invariant 3 is satisfied, and what the UI displays.

### D3 — Deterministic derived identity

```
nodeId        = ruleId # conclusionKey # sorted(premiseIds)
conclusionKey = stable identity of *what* is concluded
```

Diffs pair nodes by `conclusionKey`. Without stable identity a full recompute
renumbers everything and every version reads as a complete replacement.

A readable composite is used rather than a hash: collision-free by
construction, no crypto dependency (so core still runs in a browser), and when
two nodes differ you can read why straight off the id.

**This remains technical risk #1**: a badly designed `conclusionKey` makes
diffs unreadable. Tested from PR3, two PRs before the diff exists.

### D4 — No graph database

`ReasoningStore` is pure persistence (append / read commits). `stateAt()` is a
free function composing store and engine. M0 implementations: in-memory, then
JSON file.

*Why not Neo4j*: the state fits in memory; versioning and diffing are trivial
over an immutable log and painful over a mutable graph; the hardest query is a
transitive closure over an in-memory DAG.

### D5 — Knowledge as data; six rule kinds, frozen

| Kind | Input → output |
|---|---|
| `threshold` | numeric value + bands → qualitative claim |
| `knowledge_link` | active fact + knowledge edge → risk contribution |
| `aggregate` | n contributions → hypothesis with a level |
| `action` | hypothesis + action table → recommendation with urgency |
| `gap` | required input with no active fact → `Question` |
| `conflict` | active elements that cannot be read together → `Conflict` |

Every rule **returns its premises**; the dependency graph is a by-product of
firing and cannot drift from what happened.

Adding a benchmark case must add *data rows*, not code. **A seventh kind is not
added on the engine's own initiative**: document why the model is insufficient
and ask for a decision.

### D6 — Supersession is always an explicit human act

The system may *suggest* that a newer fact supersedes an older one; it never
decides. A reason is mandatory. Facts are bi-temporal (`observedAt` /
`recordedAt`) because the canonical scenario turns entirely on that
distinction.

### D7 — The LLM is off the critical path

The Correction Demo needs no LLM. The boundary "the LLM proposes, the state
governs" is guaranteed by the mutation API and the invariant checker, which
hold for any producer — so building the adapter early proves nothing extra.

### D8 — Two packages, one compile-time boundary

```
packages/core     TypeScript, zero runtime dependencies
packages/web      React + Vite (PR6)
benchmark/cases   YAML data
```

A package boundary makes "the engine depends on neither the UI nor the LLM" a
fact verified by the build instead of a convention that erodes.

### D9 — The validation scope is data, not a hard-coded string

`KnowledgeBase.validation` carries the scope, the clinical-validity status and
the notice. README, CLI and UI **render that field**.

*Why*: a warning hard-coded in three places diverges at the first refactor, and
this is precisely the warning that must never disappear by accident. Carried by
the knowledge base, the rule set cannot be shown without its status.

### D10 — Mechanism validation and clinical validation are disjoint

The benchmark answers *"if this rule is given to the engine, does it correctly
apply its consequences?"*. It never answers *"is this rule medically correct?"*.

---

## PR sequence

```
PR0 — Security cleanup (legacy)                    outside the functional roadmap
PR1 — Foundation: workspace, domain model, invariants
PR2 — Knowledge base + benchmark corpus + harness
PR3 — Deterministic derivation engine
PR4 — Corrections: supersession, invalidation, propagation
PR5 — Versioning, diff, Why-changed, CLI demo      ★ point of proof
──── VALIDATION GATE ────
PR6 — Research UI
PR7 — Minimal LLM adapter                          optional for M0
```

```
PR0 ─ independent
PR1 → PR2 → PR3 → PR4 → PR5 ─┬─ [GATE] → PR6
                             └─ PR7 (parallel, optional)
```

The chain is deliberate: each PR turns a strict subset of the benchmark green,
which gives a non-negotiable measure of progress.

**PR5 is the tipping point.** The milestone is provable on the command line
there. PR6 is presentation; PR7 is optional. If the schedule slips, the project
stays demonstrable.

---

## Scope cuts (decided, not oversights)

| Cut | Why |
|---|---|
| `Evidence` reasoning node type | nothing emits it; evidence reaches explanations via `Derivation.knowledgeUsed → EvidenceRef[]` |
| `disputed` fact status, `dispute_fact` | conflict is *derived* (`Conflict` node); storing it on the fact would duplicate derived state into layer 2 and break D1. Dispute resolution is M1 |
| `supersedes` reasoning edge | supersession is layer 2, already `PatientFact.supersededBy` |
| separate `edges` array on the state | the edges *are* the derivations; `Derivation.premises` carries the edge type |
| `Goal` node type | no benchmark case needs it |
| `excludes`, `decreases_likelihood` edges | no benchmark case needs them |

`conflict` was **added** as a sixth rule kind: the `Conflict` primitive needs a
producer, and no existing kind can emit it (a knowledge edge cannot express
"two potassium values disagree"). The cap is now six, frozen.

---

## Benchmark / validation strategy

**20 cases, 50 assertion blocks.** Each case has an `initial` block; the 15
cases carrying a correction also have `after_state` and `after_diff`.

| Category | Cases | Correction | Green from |
|---|---|---|---|
| baseline | 4 | no | PR3 |
| conflict — detection | 1 | no | PR3 |
| conflict — resolution | 2 | yes | PR4 |
| missing-information | 2 | yes | PR4 |
| correction | 3 | yes | PR4 |
| supersession | 3 | yes | PR4 |
| no-change | 3 | yes | PR4 |
| multi-hop | 2 | yes | PR4 |

| PR | Blocks green | Proves |
|---|---|---|
| PR2 | 0/50 | the spec exists and is executable |
| PR3 | 20/50 | every initial derivation is correct |
| PR4 | 35/50 | every correction produces the right state |
| PR5 | **50/50** | every diff and every citation is correct |

`yarn test` (unit) gates from PR1. `yarn benchmark` is a reported score in PR2,
then a gate at the expected level from PR3.

Every case carries `validation_scope: reasoning_mechanics_only` and
`clinical_validity: unvalidated`; the schema validator rejects a case without
them, so the warning cannot be omitted by oversight.

### The `no-change` property

Recompute stays **full**. The property under test is causal, not algorithmic: a
mutation with no causal dependency path to a conclusion must neither change it
nor appear as a cause of its change.

1. the state is fully recomputed;
2. the unrelated conclusion is **structurally identical** — asserted on
   `nodeId`, not only on attributes: ids being deterministic (D3), an unchanged
   id proves the premise set is unchanged;
3. `whyChanged()` does not cite the irrelevant mutation;
4. the diff for that conclusion is empty.

---

## Validation Gate (between PR5 and PR6)

**Not** a merge criterion for PR5. An **investment gate** before building a UI.

1. run `yarn demo` with 2–5 clinicians or relevant medical profiles;
2. show them the data change, the recomputation, then `Why changed?`;
3. observe whether structured explainability answers a real need;
4. record misunderstandings, frustrations, and above all **spontaneous
   questions** — those define PR6's views;
5. then decide to build PR6, re-scope it, or go back to the engine.

| Outcome | Signal | Next |
|---|---|---|
| Go | structured explainability is recognised as useful | PR6 as scoped, adjusted by the spontaneous questions |
| Go, modified | useful, but the questions asked are not the ones anticipated | re-scope PR6 before starting |
| No-go | the task model does not match the real work | back to the engine or the corpus, not the UI |

**If no clinician is available**, PR6 stays planned but is **not automatically
justified**. Launching it without validation must be an explicit, recorded
decision. This is where the project is most likely to fall back into its 2023
failure mode: building the tool before proving the use.

---

## Milestone 0 acceptance

| # | Criterion |
|---|---|
| 1 | load `spironolactone + K 5.8 + eGFR 28` from the fixtures |
| 2 | initial recommendation `medication_review`, urgency `HIGH` |
| 3 | premises visible via `explain()`: 3 observations, rules, knowledge, evidence |
| 4 | correct: add eGFR 55, supersede eGFR 28 with a mandatory reason |
| 5 | affected dependencies listed; `hyperkalemia` **excluded** |
| 6 | new reasoning state, no ghost nodes |
| 7 | recommendation recomputed to urgency `MODERATE` |
| 8 | diff `Superseded / Added / Changed / Retracted` |
| 9 | `Why did this recommendation change?` available |
| 10 | answer built from `causedBy` + `premisesLost/Gained` + rules + evidence |

### Invariants and how each is guaranteed

| Invariant | Guarantee | PR |
|---|---|---|
| 1 · Observation ≠ Hypothesis | typing + `checkInvariants` | PR1 |
| 2 · Hypothesis ≠ patient fact | layer 2 / 3 separation | PR1 |
| 3 · superseded stays on the record | append-only log, **layer 2** | PR1/PR4 |
| 4 · conclusion linked to premises | structural: `derive` is a function | D1 |
| 5 · correction → dependencies identifiable | `affectedBy` | PR4 |
| 6 · dependents re-evaluated | full recompute | PR4 |
| 7 · two versions comparable | `diff` + `stateAt` | PR5 |
| 8 · recommendation ≠ generated text | `Action` is a typed derived node | PR3 |
| 9 · canonical state independent of the LLM | core has no runtime dependency, checked in CI | PR1→PR7 |
| 10 · reconstructible without LLM history | reproducibility test from JSON | PR4 |

**Technical**: benchmark 50/50; `@aimig/core` with no runtime dependency;
`yarn demo` reproduces the scenario headless with the notice on top; no
business rule outside `packages/core`; a conflict is never auto-resolved; a
supersession is never inferred.

---

## Major risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | mechanism mistaken for clinical validity | D9/D10 make it structural; the rest is discourse discipline |
| R2 | knowledge engineering creeps back in | six-kind cap, enrichment by data; a seventh kind requires a decision |
| R3 | `conclusionKey` design | early pairing test in PR3; surfaces in PR5 if wrong |
| R4 | supersession reasons are unstructured free text | accepted for M0; taxonomy is M1 |
| R5 | no clinical validation | exactly what the Validation Gate is for |
| R6 | scale untested | assumed for M0; measure before depending on it |
| R7 | `needs_review` becomes a dumping ground | measure the rate on PR7's vignettes |

---

## Deferred

**Milestone 1** — natural-language rendering of `ChangeExplanation`; LLM
hypothesis proposal; dispute resolution and a supersession-reason taxonomy;
knowledge versioning and propagation of a knowledge change; SQLite persistence;
conflict-resolution UI; using `strength` in aggregation; clinician review of
the corpus; possible return of an `Evidence` node.

**No horizon** — FHIR/HL7/EHR integration; SNOMED CT / LOINC / ICD-10 (the
`ConceptRef.system` field is already there to absorb it); literature ingestion;
authentication, accounts, RBAC, multi-tenant; MDR certification and regulatory
audit; dashboards, onboarding, billing, design system; production
infrastructure and observability.

**Review rule**: anything not required by the 10 acceptance criteria is
deferred by default; the burden of proof is on whoever wants it in.
