# The benchmark is the specification

These 20 cases are the executable specification of Milestone 0. They are data,
not code, and they are meant to be read.

> ## ⚠️ Synthetic research rule set. Not clinically validated. Not for clinical use.

## What these cases test — and what they do not

They answer:

> **If this rule set is given to the engine, does it correctly apply its
> consequences?**

They never answer:

> Is this rule medically correct?

Every case therefore carries `validation_scope: reasoning_mechanics_only` and
`clinical_validity: unvalidated`, and the loader **rejects** a case that omits
them. Thresholds such as `eGFR 28 -> severe` exist to make propagation
observable; none of them is endorsed by AIMIG as medical guidance. Clinical
validation is external work, outside Milestone 0.

## Scoring

20 cases yield **50 assertion blocks**: every case has an `initial` block, and
the 15 carrying a correction also have `after_state` and `after_diff`.

| PR | Floor | What it proves |
|---|---|---|
| PR2 | 0/50 | the specification exists and is executable |
| PR3 | 20/50 | every initial derivation is correct |
| PR4 | 35/50 | every correction produces the right state |
| PR5 | 50/50 | every diff and every citation is correct |

`yarn benchmark` prints the full report and never fails. The gate is
`benchmark-floor.test.ts` in the normal suite: each PR raises the floor, and it
can never silently go back down.

## Categories

| Category | Cases | Asks |
|---|---|---|
| `baseline` | 4 | does the engine derive the right thing from scratch? |
| `conflict` | 3 | is an unresolvable disagreement surfaced, never arbitrated? |
| `missing-information` | 2 | is absent data stated as a question, not assumed normal? |
| `correction` | 3 | does a corrected value propagate? |
| `supersession` | 3 | does replaced information stay on the record? |
| `no-change` | 3 | is an unrelated conclusion left structurally identical? |
| `multi-hop` | 2 | does a correction reach conclusions several edges away? |

The canonical case of the milestone is
[`supersession-01-hyperkalemia-egfr.yaml`](cases/supersession-01-hyperkalemia-egfr.yaml).

## The two chains

The knowledge base carries two **independent** chains — hyperkalemia and
bleeding. That independence is what makes the `no-change` category meaningful:
correcting a potassium value must leave the bleeding conclusion structurally
identical, down to its node id.

## How a score is computed

Contributions are additive, and the scale is arbitrary by design:

```
medication contribution      = strengthPoints[assertion.strength]
claim contribution           = min(strengthPoints[strength], severityPoints[severity])
direct presence of the target = severityPoints[severity]

level = the highest level whose minScore the total reaches
```

`strengthPoints`: weak 1, moderate 2, strong 3.
`severityPoints`: mild 1, moderate 2, severe 3.

All of it lives in `packages/core/src/knowledge/aimig-v0.ts` as data, so that
enriching the benchmark adds rows rather than code.

## Writing a case

Assert on `conclusionKey` and attributes — **never on a derived node id**, which
is an implementation detail of the premises. The one exception is
`identical_node_ids`, where comparing ids across two versions is the point: ids
being deterministic, an unchanged id proves the premise set is unchanged.
