# Structural powers: initial design note

## Purpose

This slice keeps a large power meaningful when expanding its decimal or binary
digits is impractical. It is a semantic value feature, not a way to make a
wide-range floating-point approximation look exact.

## Supported value grammar

`structural-power(base, exponent)` is created only when:

- `base` is an exact positive integer greater than one; and
- `exponent` is an exact positive integer or another `structural-power`.

The value means ordinary exponentiation over the positive integers. Its
canonical rendering uses explicit parentheses where required by nesting. Exact
subexpressions may be reduced before they become operands; for example, the
semantic value behind `2^(2^(2^63))` has the exact integer `2^63` as its
innermost exponent.

The evaluator tries exact integers/rationals first. If the exact evaluator
declines expansion because of its explicit size boundary, it may construct this
value. It does not construct a structural value for unsupported negative,
zero, fractional, complex, or otherwise ambiguous powers.

## Result quality and serialization

The result is `symbolic-exact` with representation `power form` and retained
digits `not expanded`. `base` and `exponent` are recursively serialized using
the exact-value or structural-value schema, so workers, local storage, History,
and notebook export preserve the construction rather than a rendered string.

## Initial derived facts

Each fact records a rule ID, condition, certainty, source links, and a plain
language explanation for the Provenance panel.

- In matching base `b`, `b^E` has exactly `E + 1` digits: one leading `1`
  followed by `E` zeros.
- In any display base `b > 1`, the unexpanded exact digit-count formula for a
  nonzero integer is `floor(log_b(abs(n))) + 1`.
- For the narrow pattern `a^(b^x)` with positive exact integer `a`, `b`, and
  `x`, the calculator estimates
  `log10(log10(n)) = x log10(b) + log10(log10(a))`. It labels the resulting
  decimal digit-count order as an **estimate**, because the logarithms are
  finite-precision Decimal calculations.
- If the base is not divisible by `5`, any positive power of it has exactly
  zero trailing decimal zeros.

The last two facts are not used to claim leading digits, a fully expanded digit
count, or decimal suffixes. Those future claims require separately justified
precision and modular-arithmetic rules.

## Evidence and validation

- [NIST DLMF §4.8: logarithm and power identities](https://dlmf.nist.gov/4.8)
  supports the power/product logarithm transformations.
- [NIST DLMF §4.2(ii): logarithms to a general base](https://dlmf.nist.gov/4.2.ii)
  supports base conversion for logarithms.
- [Wolfram MathWorld: Number Length](https://mathworld.wolfram.com/NumberLength.html)
  states the positional integer digit-count formula.

The test suite verifies canonical construction, selection before the
wide-range engine, serialization/history round trips, the matching-base digit
identity, and the known repeated-log estimate for `2^(2^(2^63))`. These tests
validate this implementation's application of the rules; the linked sources
support the mathematics itself.

## Deferred follow-ons

General structural arithmetic, recursive digit-count values, leading-prefix
certification, CRT-based suffix extraction, interval/ball precision, and
arbitrary nested structural logarithms are separate slices. Each needs a
design note and independent oracle or adversarial-review plan before it is
presented as a calculator fact.
