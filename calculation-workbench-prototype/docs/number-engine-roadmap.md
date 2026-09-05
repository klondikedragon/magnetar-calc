# Number-engine roadmap

Elephant Calc represents values by mathematical meaning before choosing a
display. A rendered power tower, arrow expression, or decimal approximation is
never the source of truth.

## Value contract

Every engine result has a stable `kind`, an engine identifier, a human-readable
label, and a certainty classification:

| Kind | Meaning | Certainty |
| --- | --- | --- |
| `exact-integer` | A JavaScript `BigInt`, serialized as a decimal string | Exact |
| `exact-rational` | Reduced `BigInt` numerator and positive denominator | Exact |
| `decimal.js` | A finite Decimal.js approximation | Rounded to its recorded working precision |
| `break-eternity` | A wide-range layered approximation | Magnitude-oriented approximation |
| `steinhaus-moser`, `hierarchy` | A defined symbolic construction | Symbolic exact; not numerically expanded |

Values must serialize without relying on JavaScript object identity or native
`BigInt` JSON support. Workers, local storage, notebook export, and imports use
the same serialized shape. Imported answers remain archival metadata: imported
expressions are always recomputed.

## Completed foundation

- [x] Establish independent SymPy/mpmath validation for exact and
  high-precision numeric overlap cases.
- [ ] Add exact integer values and route integer-safe arithmetic through them.
- [ ] Add normalized exact rational values and preserve exact division.
- [ ] Make precision, certainty, engine provenance, and serialization common
  result metadata.
- [ ] Use adaptive Decimal.js working precision with explicit retry and
  retained-precision reporting.

## Structural-value program

Structural values are intentionally a series of separate slices. They are not
an output-formatting feature.

1. **Structural foundation** — immutable semantic node grammar, canonical
   serialization, equality, provenance, and exact/estimated/opaque semantics.
2. **Power and logarithmic magnitude** — exact power nodes plus a recursive
   magnitude form with conservative comparison and digit-count rules.
3. **Tetration and Knuth arrows** — operands and arrow count are explicit;
   no arrow meaning is inferred from BreakEternity layers.
4. **Steinhaus–Moser** — migrate the current construction forms into the common
   structural grammar, retaining their defined visual forms.
5. **Composition and inspection** — structural results in ordinary expressions,
   history, copy/export, and digit-count queries without forced evaluation.
6. **Normalization** — only proven rewrite rules and canonicalization; no
   algebraic simplification is accepted solely because it looks plausible.

Each structural slice starts with a short design note defining its mathematical
meaning, input domains, exact reductions, serialization, rendering, and error
or estimate behavior. It ends with small-case oracle tests, property tests, and
round-trip serialization tests.

## Deferred work

### Certified interval / ball arithmetic

The eventual numerical certainty engine should represent a real value as a
midpoint with an error radius or interval. That supports claims such as
“20 certified digits” and makes cancellation visible. A browser implementation
will likely need a carefully selected WebAssembly numerical backend; it is not
safe to claim certification from Decimal.js alone.

### Recursive magnitude and digit counts

For values too large for a numeric exponent, digit count is itself a value:
`floor(log_base(abs(x))) + 1`. Structural values will return a structural or
estimated digit count rather than a false exact integer.

### Adaptive precision beyond the initial policy

The first policy can use requested digits plus guard digits and targeted retry.
Later work should estimate conditioning, detect cancellation, and either raise
working precision or report a bounded loss of trusted digits.

### Additional backends

MPFR/Arb-style correctly rounded or ball arithmetic is a future backend, not a
runtime requirement for the static website. SymPy and mpmath remain independent
test oracles rather than browser dependencies.
