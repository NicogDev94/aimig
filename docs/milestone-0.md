# Milestone 0 — Deterministic Clinical Reasoning Core

## Status

This document freezes the implementation plan for Milestone 0.

The milestone validates the **reasoning mechanism**, not clinical correctness.

> Synthetic research rule set. Not clinically validated. Not for clinical use.

The architecture is intentionally conservative: deterministic derivation, explicit provenance, human-controlled supersession/invalidation, and no LLM in the canonical reasoning path.

---

## 0. Decision traceability

| # | Decision | Where it lands |
|---|---|---|
| 1 | PR0 security cleanup | PR0, outside functional roadmap |
| 2 | `retracted` removed from current state | D2bis; PR1 type removal; PR4 state scope; PR5 diff only |
| 3 | Primitive `Conflict` | PR1 enum; PR3 conflict rule; PR2 benchmark cases |
| 4 | Structured `EvidenceRef` | PR1 type; PR2 content; PR3/PR5 explain / whyChanged |
| 5 | Explicit validation scope | D9; PR1 `KnowledgeBase.validation`; PR2 fixtures; PR5/PR6 rendering |
| 6 | `invalid` vs `needs_review` | PR7 |
| 7 | No-change test reformulated causally | PR4 |
| 8 | Validation Gate moved after PR5 | §7; PR6 DoD |
| 9 | Preserve D1–D7 | unchanged |
| 10 | Final challenge | §1 below |

### Additional architectural cuts

These were chosen because they remove unused or duplicated concepts from M0.

#### E1 — Remove `Evidence` from `ReasoningNodeType`

No M0 rule produces an Evidence node. Evidence already flows through:

```ts
Derivation.knowledgeUsed: EvidenceRef[]
```

Adding a node kind that is never emitted would create a false architectural promise.

#### E2 — Remove `disputed` and `dispute_fact`

Dispute resolution is M1. In M0, disagreement is represented as a derived `Conflict` node rather than duplicated as mutable status on a fact.

Human conflict resolution in M0 happens through:

- supersession;
- invalidation.

#### E3 — Add a sixth rule kind: `conflict`

The existing five rule kinds cannot represent two active incompatible observations about the same analyte unless the conflict itself is modeled as a derivation.

Rule kinds are therefore frozen at six for M0:

1. `threshold`
2. `knowledge_link`
3. `aggregate`
4. `action`
5. `gap`
6. `conflict`

A seventh kind requires explicit architectural review.

#### E4 — No separate edge list in `ReasoningState`

Reasoning edges are already derivation premises:

```ts
Derivation.premises: Array<{
  nodeId: NodeId;
  edgeType: ReasoningEdgeType;
}>
```

The graph rendered by the UI is a pure projection of derivations.

#### E5 — Remove `supersedes` from `ReasoningEdgeType`

Supersession belongs to layer 2 (`PatientFact.supersededBy`), not to the derived reasoning graph.

---

# 1. Final architecture decisions

## D1 — Pure derivation

```text
ReasoningState(v) = derive(knowledge, factsAt(v))
```

The log stores assertions and mutations only.

No derived conclusion is persisted as canonical state.

This makes the canonical reasoning state reproducible from:

- knowledge;
- facts;
- commit/version.

## D2 — Full recomputation in M0

No incremental propagation engine.

The dependency graph exists for:

- `explain()`;
- `affectedBy()`;
- `whyChanged()`.

It does **not** control execution ordering.

## D2bis — Current state contains current-version nodes only

There is no status on a derived reasoning node.

`retracted` is a **diff category**, not a node lifecycle.

A superseded fact remains visible in layer 2 but no longer projects an Observation into the current ReasoningState.

Historical states are reproduced with `stateAt(...)`.

## D3 — Deterministic derived identity

```text
nodeId = hash(ruleId, conclusionKey, sortedPremiseIds)
```

Diff matching uses `conclusionKey`, not node id.

This is the highest-risk technical choice in the milestone and is tested before PR5 needs it.

## D4 — No graph database

`ReasoningStore` is persistence only.

```text
append commits
read case log
```

`stateAt()` is a free function composing store + engine.

M0 implementations:

1. in-memory;
2. JSON file.

Neo4j is not part of the new architecture.

## D5 — Knowledge is data

Six rule kinds, frozen for M0.

| Rule | Input → output |
|---|---|
| `threshold` | numeric value + bands → qualitative Claim |
| `knowledge_link` | active fact + knowledge relation → contribution |
| `aggregate` | contributions → Hypothesis with level |
| `action` | Hypothesis + action table → Action with urgency |
| `gap` | missing required input → Question |
| `conflict` | mutually incompatible active elements → Conflict |

Every rule returns:

- conclusion;
- premises;
- knowledge used.

The dependency graph is a by-product of firing rules.

## D6 — Supersession is explicit and human-controlled

The system may suggest that one fact supersedes another.

It never performs supersession automatically.

A supersession requires:

- explicit mutation;
- mandatory reason.

Facts are bi-temporal:

- `observedAt`;
- `recordedAt`.

## D7 — LLM outside the critical path

The complete M0 engine works without an LLM.

PR7 is optional for Milestone 0.

## D8 — Two primary packages

```text
packages/core   TypeScript pure domain / engine
packages/web    Vite research UI
benchmark/cases YAML executable specification
```

`packages/core` has zero runtime dependencies.

## D9 — Validation scope is data

`KnowledgeBase.validation` carries:

- validation scope;
- clinical validity status;
- warning text.

README, CLI and UI render this data rather than duplicating warning strings.

## D10 — Mechanism validation and clinical validation are separate

The benchmark answers:

> Given these rules, does the engine derive the expected consequences correctly?

It does **not** answer:

> Are these clinical rules medically correct?

No synthetic threshold is presented as clinically validated by AIMIG.

---

# 2. Milestone architecture

Three layers:

```text
Layer 1 — Knowledge
  rules, scales, concepts, evidence references

Layer 2 — Patient facts / case log
  append-only assertions and explicit corrections

Layer 3 — ReasoningState
  pure derived projection
```

The LLM, when present, may propose inputs.

It never owns the canonical reasoning state.

---

# 3. PR sequence

## PR0 — Security cleanup

### Goal

Neutralize exposed Neo4j credentials and remove obsolete public deployment surfaces.

### Scope

- revoke exposed Neo4j credentials;
- verify old credentials no longer work;
- disable/remove unused Azure Static Web Apps deployment;
- revoke related deployment token;
- remove or disable legacy Azure GitHub Actions workflow;
- quick scan of HEAD and known public artifacts for other real secrets.

### Explicitly out of scope

- Git history rewrite;
- secret-scanning infrastructure;
- broad security-policy work;
- application refactor.

### DoD

- exposed credential revoked and verified unusable;
- legacy deployment disabled or explicitly retained with justification;
- short verification note in PR.

PR0 is independent of PR1.

---

## PR1 — Foundation: workspace, domain model, invariants

### Goal

Freeze the vocabulary and contracts before engine behavior is implemented.

### Scope

- remove legacy `src/` application and Neo4j/vis/redux dependencies from HEAD;
- Yarn workspace;
- `packages/core`;
- empty `packages/web` Vite shell;
- TS strict;
- Vitest;
- domain types for all three layers;
- `ReasoningStore` interface;
- `ReasoningEngine` interface with placeholder methods;
- `InMemoryReasoningStore`;
- `checkInvariants(state, facts)`;
- CI: `yarn typecheck && yarn test`;
- README with architecture thesis and validation warning from `KnowledgeBase.validation`.

### Domain decisions frozen here

- no status on `ReasoningNode`;
- `Conflict` node exists;
- no `Evidence` reasoning node;
- `FactStatus = active | superseded | invalidated`;
- no `disputed` status;
- structured `EvidenceRef[]` on knowledge assertions;
- `OrdinalScale`;
- `CaseLog`;
- `ConceptRef`;
- `ReasoningDiff`;
- `ChangeExplanation`;
- dependency edges carried by derivation premises.

### Invariant tests

At minimum:

1. Observation has `sourceFactId` and no derivation.
2. Every non-Observation has a derivation with at least one premise.
3. Every premise references a node present in the state.
4. No current node references a non-active fact.
5. A superseded fact requires `supersededBy` and a non-empty reason.

### DoD

- typecheck green;
- unit tests green;
- `packages/core` has zero runtime dependencies;
- no business derivation logic implemented.

---

## PR2 — Knowledge base, benchmark corpus, harness

### Goal

Turn expected behavior into executable specification before implementing the engine.

### Scope

KnowledgeBase V0 contains approximately:

- 12 knowledge relations;
- 4 threshold/band tables;
- 5 action rules;
- ordinal scales;
- `KnowledgeBase.validation`.

Every `KnowledgeAssertion` has at least one structured `EvidenceRef`.

Synthetic evidence is clearly labelled, e.g.:

```text
publisher: AIMIG synthetic reference set
```

### Corpus

20 YAML cases, 50 assertion blocks.

| Category | Cases | Correction? | First green PR |
|---|---:|---:|---|
| baseline | 4 | no | PR3 |
| conflict detection | 1 | no | PR3 |
| conflict resolution | 2 | yes | PR4 |
| missing information | 2 | yes | PR4 |
| correction | 3 | yes | PR4 |
| supersession | 3 | yes | PR4 |
| no-change | 3 | yes | PR4 |
| multi-hop | 2 | yes | PR4 |
| **Total** | **20** | **15 corrected** | |

Every case includes:

- `validation_scope`;
- `clinical_validity`.

The schema validator rejects cases missing either field.

### Key assertion

`why_changed_must_cite` must resolve all the way to structured `EvidenceRef` values.

### CI behavior

- `yarn test` remains blocking;
- `yarn benchmark` reports score only in PR2 because engine methods are intentionally not implemented yet.

### DoD

- 20 valid cases;
- 50 assertion blocks;
- benchmark reports `0/50` for the correct reason;
- every case readable as documentation;
- every knowledge assertion has evidence.

---

## PR3 — Deterministic derivation engine + provenance

### Goal

Implement:

```text
derive(knowledge, facts) -> ReasoningState
```

and pass all 20 initial-state assertion blocks.

### Scope

- six-rule registry;
- forward chaining until fixed point;
- deterministic node ids;
- documented `conclusionKey` convention;
- dependency index as a derivation by-product;
- `explain(state, nodeId)` to `EvidenceRef`;
- `conflict` rule;
- `gap` rule;
- invariant validation after derive in tests.

### Conflict behavior

A `Conflict` node remains present while incompatible active premises remain.

No automatic resolution.

### Tests

- unit tests for every rule kind;
- incompatible values on same analyte;
- `contradicts` knowledge edge;
- deterministic repeated derive;
- forward-looking diff identity test: same `conclusionKey`, different `nodeId` when premises differ;
- termination with intentional rule cycle;
- repeated derive preserves unresolved Conflict.

### Acceptance

Benchmark: `20/50`.

### Rule-governance constraint

Do not create a seventh rule kind merely to make a fixture pass.

If the model appears insufficient, document and request a decision.

---

## PR4 — Corrections, supersession, dependencies, recomputation

### Goal

Make the state correctable and identify affected dependents.

### Scope

- `applyCommit(caseId, commit)`;
- mutation validation;
- `factsAt(version)`;
- full recomputation after commit;
- `affectedBy(state, factId)`;
- `stateAt(store, engine, caseId, version)`;
- `JsonFileReasoningStore`.

### Mutation rules

Reject:

- superseding an already superseded fact;
- references to nonexistent facts;
- empty supersession reason;
- incoherent mutations.

No automatic supersession from recency.

### No-change property

The test is causal, not algorithmic:

1. state is fully recomputed;
2. unrelated conclusion keeps the same deterministic `nodeId`;
3. later `whyChanged()` must not cite unrelated mutations;
4. later diff for that conclusion is empty.

PR4 can fully assert points 1–2; PR5 completes 3–4.

### Tests

- log replay;
- invalid mutation rejection;
- 3-hop `affectedBy`;
- superseded fact remains in layer 2 but disappears from current reasoning state;
- JSON reload reproduces identical state;
- conflict disappears only after a human mutation removes one conflicting active premise.

### Acceptance

Benchmark: `35/50`.

---

## PR5 — Versioning, diff, Why changed?, CLI demo

### Goal

Answer:

> Why did this recommendation change?

from real mutations and dependency/provenance structure.

This PR delivers the core milestone.

### Scope

- `diff(a, b): ReasoningDiff`;
- matching by `conclusionKey`;
- categories: `added`, `retracted`, `changed`;
- fact mutation section;
- `whyChanged(...) -> ChangeExplanation`;
- `weakened` / `strengthened` verdict via declared `OrdinalScale` only;
- `yarn demo` headless canonical scenario;
- warning rendered from `KnowledgeBase.validation`.

### `whyChanged` must cite

- responsible mutations;
- premises lost;
- premises gained;
- re-fired rules;
- knowledge assertions;
- structured `EvidenceRef`.

### `retracted`

Only the diff can contain a node from state A that is absent from state B.

Current ReasoningState never carries ghost/retracted nodes.

### Tests

- added vs changed vs retracted matching;
- no-effect commit;
- multi-hop diff;
- conflict resolution appears as a retracted Conflict node;
- all 15 `why_changed_must_cite` assertions;
- canonical acceptance scenario.

### Canonical acceptance expectations

- recommendation: `medication_review`;
- initial urgency: `HIGH`;
- after eGFR correction: `MODERATE`;
- hyperkalemia remains unaffected by eGFR-only mutation;
- `whyChanged` cites the two eGFR mutations and relevant evidence.

### DoD

- benchmark `50/50`;
- acceptance test green;
- `yarn demo` reproduces milestone output;
- `packages/core` still has zero runtime dependencies.

---

# 4. Validation Gate — between PR5 and PR6

PR5 merges on its own DoD.

The Validation Gate is an **investment gate for UI**, not a merge gate for the core.

## Protocol

Run `yarn demo` with 2–5 clinicians or medically relevant profiles.

Show:

1. initial data;
2. correction;
3. recomputation;
4. structured `Why changed?`.

Observe:

- whether structured explainability is actually useful;
- what users misunderstand;
- what spontaneous questions they ask;
- whether the modeled task matches real work.

## Outcomes

| Outcome | Signal | Next step |
|---|---|---|
| Go | structured explainability is useful | build PR6, informed by observations |
| Go modified | useful, but user questions differ from assumptions | rescope PR6 first |
| No-go | model does not match real workflow | revisit engine/corpus, not UI |

If no clinician is available, proceeding with PR6 requires an explicit recorded decision.

---

## PR6 — Research UI: The Correction Demo

### Goal

Make the milestone demonstrable without a terminal.

### Scope

#### Case view

- patient facts;
- active/superseded status;
- `observedAt` / `recordedAt`;
- supersession reason;
- current recommendation + urgency;
- Why panel from `explain()` through EvidenceRef;
- open Questions;
- unresolved Conflicts.

#### Correction view

Structured mutations only:

- add fact;
- supersede fact with mandatory reason;
- invalidate fact.

No free-form text is allowed directly into canonical state.

#### Diff view

Render:

- ReasoningDiff;
- Why changed? from ChangeExplanation.

#### Explore reasoning

Read-only subgraph for selected recommendation.

Hierarchical layout may be recovered from legacy history with `git show`.

The graph is secondary, not the home screen.

### Constraints

- no business logic in `packages/web`;
- no authentication;
- no design-system project;
- no LLM;
- no graph editing;
- warning from `KnowledgeBase.validation` visible on every view.

### Tests

- render test per view;
- Playwright end-to-end canonical scenario;
- guard preventing rule reimplementation in web;
- warning visible everywhere.

### DoD

All ten milestone steps can be completed with the browser UI.

---

## PR7 — Minimal LLM adapter (optional for M0)

### Goal

Prove the boundary:

> The LLM reads and proposes. The reasoning state governs.

### Scope

```ts
extractObservations(text): Promise<ProposedFact[]>
```

behind an `ObservationExtractor` interface.

Implementations:

- deterministic test stub;
- Claude-backed adapter behind feature flag.

### Triage

#### `invalid`

Examples:

- malformed JSON;
- invalid type;
- concept outside closed vocabulary;
- unknown/incompatible unit;
- required field missing.

Rejected as structurally unusable.

#### `needs_review`

Examples:

- extremely unusual value;
- conflict with existing observation;
- suspicious unit interpretation;
- unusual temporal information;
- potentially aberrant value.

Preserved and shown to a human.

#### `ok`

Structurally valid and no flags.

Still requires human confirmation.

### Safety property

Never silently correct, normalize away or discard an unusual observation solely because it appears improbable.

Every proposal has:

```text
provenance.origin = llm_proposal
```

It becomes a patient fact only after an explicit confirmation mutation with `confirmedBy`.

### Constraints

- no hypothesis proposal by LLM;
- no direct log writes;
- no natural-language explanation generation in M0;
- `packages/core` has no LLM SDK dependency.

---

# 5. Benchmark and validation strategy

## Mechanism benchmark

Synthetic corpus. Validates deterministic consequences of provided rules.

It does not validate medical truth.

### Required marking

At three levels:

1. every benchmark case: `validation_scope`, `clinical_validity`;
2. KnowledgeBase: validation metadata;
3. README / CLI / UI: rendered warning.

### Benchmark progression

| PR | Green blocks | Meaning |
|---|---:|---|
| PR2 | 0/50 | executable specification exists |
| PR3 | 20/50 | initial derivation correct |
| PR4 | 35/50 | corrected states correct |
| PR5 | 50/50 | diffs and causal citations correct |

`yarn test` is blocking from PR1.

`yarn benchmark` becomes a CI gate from PR3 at the expected score for that PR.

## Clinical validation

Out of scope for M0.

The first external clinical confrontation happens at the Validation Gate.

Expert review of the benchmark corpus is M1.

---

# 6. Milestone 0 global acceptance criteria

## Canonical scenario

1. Load spironolactone + K 5.8 + eGFR 28 from fixtures.
2. Initial recommendation: `medication_review`, urgency `HIGH`.
3. `explain()` shows 3 observations, rules, knowledge and EvidenceRef.
4. Add eGFR 55 and explicitly supersede eGFR 28 with reason.
5. List affected dependencies; hyperkalemia excluded.
6. Produce new reasoning state with no ghost nodes.
7. Recalculated recommendation urgency: `MODERATE`.
8. Diff shows Superseded / Added / Changed / Retracted concepts correctly.
9. `Why did this recommendation change?` is available.
10. Explanation is constructed from causedBy + premises lost/gained + rules + evidence.

## Invariants

| Invariant | Guarantee | PR |
|---|---|---|
| Observation ≠ Hypothesis | typing + `checkInvariants` | PR1 |
| Hypothesis ≠ patient fact | layer separation | PR1 |
| superseded fact remains historical | append-only layer 2 | PR1/PR4 |
| every conclusion linked to premises | derivation structure | PR3 |
| correction dependencies identifiable | `affectedBy` | PR4 |
| dependents re-evaluated | full recomputation | PR4 |
| versions comparable | `diff` + `stateAt` | PR5 |
| recommendation ≠ generated text | typed Action node | PR3 |
| canonical state independent from LLM | core runtime boundary | PR1→PR7 |
| state reconstructible without LLM history | JSON replay test | PR4 |

## Technical criteria

- benchmark `50/50` by PR5;
- `packages/core` has zero runtime dependencies;
- canonical demo runs headlessly;
- no business rule outside core;
- conflict never auto-resolved;
- supersession never inferred automatically.

---

# 7. Major risks

## R1 — Mechanism vs clinical validity confusion

The strongest risk is communicative, not technical.

The synthetic benchmark must never be presented as medical validation.

## R2 — Knowledge engineering creep

The six-rule ceiling is a review constraint.

A proposed seventh rule kind is a reason to revisit the model, not automatically extend it.

## R3 — `conclusionKey` semantics

Too narrow:

- everything becomes added/retracted.

Too broad:

- distinct conclusions collapse.

Mitigation begins in PR3 with anticipatory identity tests.

## R4 — Supersession reason is free text

Acceptable for M0; insufficient for mature dispute semantics.

Structured supersession/dispute taxonomy belongs to M1.

## R5 — No clinical validation

The first clinician may reject the modeled task entirely.

This is why the Validation Gate happens before UI investment.

## R6 — Scale is untested

M0 assumes tens of nodes.

Hundreds of observations may invalidate full recomputation and graph rendering assumptions.

Measure before optimizing.

## R7 — `needs_review` may become a dumping ground

If too many LLM proposals land in `needs_review`, human confirmation becomes reflexive and loses value.

Measure this immediately if PR7 ships.

---

# 8. Deferred to Milestone 1+

## M1 candidates

- natural-language rendering from `ChangeExplanation`;
- LLM hypothesis proposals with validation;
- dispute-resolution mechanism;
- structured supersession reasons;
- knowledge-layer versioning and propagation;
- SQLite `ReasoningStore`;
- multi-session support;
- assisted conflict-resolution UI;
- uncertainty / strength propagation;
- clinician review of benchmark cases;
- possible reintroduction of an Evidence reasoning primitive if a real patient-specific need appears.

## Explicitly beyond current scope

- FHIR / HL7 / EHR integration;
- SNOMED CT / LOINC / ICD integration;
- literature ingestion / DOI resolution;
- authentication / RBAC / multi-tenancy;
- MDR certification / regulatory infrastructure;
- billing / onboarding / dashboards / design system;
- production infrastructure / observability / performance optimization.

`ConceptRef.system` remains available so terminology systems can be added later without reworking the core model.

---

# 9. Review rule

If a proposal is not required by one of the ten canonical milestone steps, it is deferred by default.

The burden of proof belongs to whoever wants to add it.

The plan is considered implementation-ready from PR1 through PR5 without re-planning.

The Validation Gate is the explicit point where evidence from real users may legitimately change the shape of PR6.