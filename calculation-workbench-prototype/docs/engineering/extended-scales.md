# Extended scientific scales

## Scope

An extended-scale value stores a normalized finite significand and an arbitrary
size **exact integer** decimal scale:

`sign × significand × 10^scale`

The scale is a JavaScript `BigInt`; the significand is a bounded Decimal.js
value. This is a semantic value, not a formatting trick. It is used only after
Decimal.js's supported normalized exponent range of `±9 × 10^15` is exceeded.

The first slice supports exact powers of ten with enormous exact-integer
exponents, and addition, subtraction, multiplication, division, and selected
integer powers involving those values. It intentionally does not claim to
evaluate an arbitrary base raised to an enormous exponent: for example,
`6^(10^100)` remains a structural power because its decimal scale requires a
high-precision logarithmic calculation with a nontrivial error analysis.

## Certainty rules

- `10^E`, with exact integer `E` outside Decimal.js range, is an **exact**
  extended-scale value: `1 × 10^E`.
- A finite exact integer combined with that value may remain representable, but
  this initial engine only labels a result exact when it can retain the
  significand and scale without Decimal rounding.
- For addition/subtraction, an addend more than working precision plus a guard
  window below the other scale is omitted from retained digits. The result is
  labelled **rounded**, and the omitted scale is recorded for inspection.
- No leading digit, digit count, or base conversion is claimed merely from a
  rounded significand. An exact decimal digit count is exposed only for an
  exact integer significand at a nonnegative exact scale.

## Evidence

The implementation has direct boundary, arithmetic-window, formatting, and
serialization tests in `tests/extended-scale.test.mjs`. It uses the same
normalized scientific notation and logarithm identities documented by the
[NIST Digital Library of Mathematical Functions, §4.8(i)](https://dlmf.nist.gov/4.8.i).
The reference supports the mathematical identities; the tests validate this
implementation's restricted value contract.

## Deferred work

The next distinct slice is a logarithmic-magnitude representation where the
scale itself can be a rounded or structural value. That will require explicit
error propagation, comparisons, and a separate proof/validation plan before it
can report leading digits or precise digit counts.
