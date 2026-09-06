# Trustworthy calculator engineering

Elephant Calc is designed for mathematics that ranges from ordinary exact
integers to structural descriptions of values that cannot be expanded. Its
interface should be expressive, but its claims must remain honest, inspectable,
and reproducible.

## Core rule: meaning before rendering

A value's semantic representation is authoritative. Decimal text, scientific
notation, a power tower, a Knuth-arrow expression, and a Steinhaus–Moser shape
are renderings, not the value model. Never infer semantic facts from a rendered
string or a BreakEternity layer.

Every result and derived fact must state the strongest status it can justify:

| Status | Meaning |
| --- | --- |
| Exact | The result is represented without numerical rounding in its declared domain. |
| Derived exact | A fact follows exactly from an exact representation and a valid rule. |
| Rounded | A finite numerical result rounded at recorded working precision. |
| Estimate | A useful approximation without a certified error bound. |
| Bound | A one- or two-sided claim whose direction is explicit. |
| Structural | An exact symbolic construction that has intentionally not been numerically expanded. |

Formatting must not silently strengthen or weaken these classifications.

## Value and engine discipline

- Prefer exact integers and normalized exact rationals before approximate
  engines whenever the operation and result remain representable.
- Retain the selected engine, working precision, fallback decisions, and known
  loss-of-precision state with the result.
- Treat Decimal.js as a controlled finite-precision decimal engine, not a proof
  of correctly rounded or certified digits. Treat BreakEternity as
  magnitude-oriented approximation, never as proof that its layers encode a
  particular Knuth-arrow expression.
- Preserve explicit structural input (powers, tetration, arrows, shapes, and
  hierarchy terms) when expansion would discard meaning or exceed a safe budget.
- Imported answers are archival. Recompute expressions on import rather than
  trusting imported numeric metadata.

## Derived facts need a rule, conditions, and evidence

Facts such as digit counts, logarithms, leading digits, suffixes, divisibility,
or primality must be modelled as claims derived from a named rule. Each rule
needs a stable ID and records:

1. Its mathematical statement and supported input domain.
2. Preconditions, including sign, integrality, base constraints, and required
   numerical precision.
3. Its result category and what makes that category valid.
4. The direct inputs and engine values used in this application of the rule.
5. Evidence: test IDs, independent oracle checks where available, and cited
   mathematical sources.

If a precondition cannot be established, omit the fact or label it with the
weaker status it earns. Never turn a heuristic, probability, or incomplete
calculation into an exact claim for convenience.

For example, a base-`b` digit count can use
`floor(log_b(abs(n))) + 1` only for a nonzero integer `n` and `b > 1`. Its
implementation must account explicitly for the zero case and for precision near
an integer logarithm. A suffix is exact only when it comes from a valid modular
calculation; leading digits are only trustworthy when the fractional logarithm
has enough resolved precision to distinguish the claimed prefix.

## Provenance is a product capability

The compact inspector should communicate the result and its quality without
forcing readers through a proof. A dedicated Provenance view will expose the
claims behind it in a readable chain: result status, rule, substituted values,
assumptions, engine decisions, validation evidence, and links to sources.

References support the mathematics; they do not validate our code. Evidence
for implementation correctness must include at least one of:

- overlap comparison with an independent trusted oracle;
- exact small-case fixtures derived by hand or from a trusted source;
- property or metamorphic tests;
- an independently implemented check, such as a modular verification; or
- a documented reason that an oracle cannot cover the structural case.

The provenance data model should be serializable and use stable rule/source IDs
so history exports remain meaningful across releases. Do not store only prose
or a rendered display string.

## Test and review strategy

Every numerical or structural feature is a vertical slice:

1. Write a short design note: semantics, domains, reductions, error behavior,
   serialization, display, and evidence plan.
2. Add parser and evaluator tests for normal forms, nesting, boundary values,
   and rejected domains.
3. Add independent oracle tests for the overlap range. SymPy and mpmath are
   local validation tools only; they are never browser runtime dependencies.
4. Add property tests and round-trip serialization tests when an exhaustive
   oracle is unavailable.
5. Record the residual uncertainty and references in the rule's provenance.
6. Request a focused adversarial review for risky logic that lacks a direct
   input/output oracle. The review should try to falsify assumptions rather
   than merely confirm the intended examples.

Adversarial test sets should include zero, one, minus one, negative bases,
negative or non-integral exponents, right-associative nested powers, values near
digit-count boundaries, non-coprime modular inputs, cancellation, and engine
fallback boundaries.

## Performance and cancellation

The browser must remain responsive. Expensive evaluation belongs in a
cancellable worker with a bounded work/time budget. A request that is cancelled,
timed out, or structurally preserved must report that truthfully; it must not
leave a partial result presented as complete. Expensive derived facts, including
primality testing, are part of the same result lifecycle so their visible status
does not flicker or contradict the final answer.

## Change checklist

Before merging an engine, parser, structural-value, or derived-fact change,
confirm:

- semantic representation is separate from display;
- certainty and provenance survive worker transfer, local storage, history,
  export/import, copy, and inspector rendering;
- fallback and non-computable cases are explicitly represented;
- all rule preconditions are enforced or visibly qualified;
- relevant oracle/property/edge-case tests pass; and
- new citations are primary or otherwise authoritative sources, linked directly
  from the provenance record.

Ideas that require a new engine capability rather than a display patch belong in
the [number-engine roadmap](../number-engine-roadmap.md) with their uncertainty
and validation plan.
