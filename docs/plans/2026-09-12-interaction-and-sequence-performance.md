# Interaction and sequence performance

## Status

Implementation complete; physical iPad verification remains. This plan
removes interaction work that scales with result size,
hardens mobile editing, and gives each sequence implementation an explicit
direct-or-cached performance strategy. Large-number capability and exactness
must be preserved throughout.

## Confirmed findings

- The PWA update coordinator records every pointer and keyboard interaction in
  React state. That rerenders the entire calculator even when no update exists.
- Calculator buttons restore textarea focus in `requestAnimationFrame`. Mobile
  browsers may reject that delayed focus because it is no longer inside the
  trusted user gesture.
- Decimal digit grouping uses a repeated look-ahead regular expression whose
  runtime grows approximately quadratically with digit count. The same pattern
  is duplicated across normal display, copy/export, and digit-count formatting.
- Active-result formatting is repeated during a render and repeated again when
  unrelated state changes.
- Sequence implementations are duplicated between the exact and fallback
  engines. Yellowstone and Recaman retain incremental module caches; Stern is
  already direct O(log n), while several other sequences restart from term zero
  or rebuild a dynamic-programming table for every call.

## Non-negotiable behavior

- Do not reduce the supported exact expansion range or hide precision loss.
- Full values remain available to display, inspect, copy, serialize, and export
  according to the existing view and precision contracts.
- PWA updates may activate only after persisted state is flushed and no modal,
  calculation, History queue, import, or export operation is active.
- The app must not focus the expression or open a software keyboard on startup.
- Keyboard focus, screen-reader names, and native button semantics must remain
  intact.

## Slices

### 1. Decouple PWA updates from ordinary rendering

- [x] Replace the React-state interaction timestamp with refs and a dedicated
  waiting-update timer.
- [x] Do no per-interaction React update unless an update is actually pending.
- [x] Model update blockers from authoritative state rather than assuming a ref
  mutation will cause a render.
- [x] Do not treat the inline inspector as a modal.
- [x] Recover cleanly when update activation rejects.
- [x] Extend policy/coordinator tests for idle delay, blocker transitions,
  repeated interaction, cleanup, and activation failure.

### 2. Make digit grouping linear

- [x] Replace every repeated-look-ahead grouping expression with one shared
  linear-time implementation.
- [x] Cover signs, short leading groups, fractions, and already-separated
  integer/fraction paths.
- [x] Add correctness tests and a scaling benchmark at representative large
  sizes, including 6,002 and 100,000 digits.
- [x] Commit this slice separately and report the commit hash as the first
  push-ready checkpoint.

### 3. Avoid repeated presentation work

- [x] Memoize active result formatting, inspection, digit counts, and tooltip
  derivation by value and view settings.
- [x] Reuse already-derived representations rather than calling the formatter
  twice in one render.
- [x] Audit memory and visible History rows for equivalent duplication without
  introducing stale display state.
- [x] Add a render-cost or pure-presentation benchmark that demonstrates that
  unrelated interaction state does not reformat a large unchanged value.

### 4. Make calculator focus mobile-safe

- [x] Focus the active textarea synchronously inside trusted calculator-button
  activation; restore its selection after the controlled value update.
- [x] Keep modal-opening controls and ordinary navigation controls on their own
  appropriate focus targets.
- [x] Give the expression editing row a comfortable touch target that invokes
  native focus only after the user taps it.
- [x] Add `touch-action: manipulation` and explicit prefixed/unprefixed
  non-selection rules to app controls while preserving selectable outputs.
- [x] Add appropriate mobile text-entry hints without forcing a numeric-only
  keyboard or focusing on startup.

### 5. Consolidate and optimize sequence evaluation

- [x] Define one authoritative implementation path used by exact and fallback
  engines.
- [x] Use direct algorithms where they dominate caching: fast doubling for
  Fibonacci/Lucas, a direct integer formula for Jacobsthal, O(1) triangular,
  and O(log n) Stern.
- [x] Use bounded incremental caches where sequential reuse is valuable:
  Catalan, partition, Bell, harmonic, prime/nth-prime, Yellowstone, and Recaman.
- [x] Give every retained cache an explicit term and estimated-memory policy.
- [x] Review Yellowstone candidate selection separately; its retained prefix
  prevents recomputation but its candidate scan still needs scaling evidence.
- [x] Add oracle prefixes, recurrence/property tests, cache-boundary tests, and
  repeated-sequential-call benchmarks.

### 6. Integrated verification

- [x] Run the complete Node 24 test suite, oracle tests, History benchmark,
  production build, and Cloudflare/Sites checks.
- [x] Verify local button input, caret placement, keyboard navigation, large
  exact display, History queue completion, and PWA update deferral.
- [x] Inspect production-browser console output and record any iPad Safari
  checks that still require a physical-device pass.
- [x] Update this plan with measured before/after results and residual risks.

## Verification results

- Node 24.20.0: 187 tests passed, including the SymPy/mpmath oracles and PWA
  update-state coverage.
- Digit grouping: 6,002 digits improved from about 170 ms to 0.28 ms;
  100,000 digits improved from over 30 seconds to about 12.5 ms.
- Repeating one unchanged 6,002-digit presentation 100 times improved from
  about 23.7 ms to 0.22 ms through value-identity caching.
- Non-UX History scheduling resolved 1,000 Yellowstone entries in about
  101 ms. The sequence library generated the first 1,000 Yellowstone terms
  cold in about 17 ms and served 1,000 rounds of cached endpoints in 0.68 ms.
- The production PWA and Sites bundle built successfully; all four SPA/static
  route tests passed. The large chunk warning and Workbox's upstream
  `inlineDynamicImports` deprecation warning remain non-failing build notes.
- Browser verification placed a keypad digit at an interior caret, produced
  the expected expression, and left the textarea focused. A 6,002-digit exact
  Mersenne result rendered with its exact digit count. Local and deployed
  browser consoles contained no warnings or errors.
- A physical iPad pass is still required to confirm that WebKit opens the
  software keyboard after a calculator-button focus transfer; desktop browser
  automation cannot reproduce the operating system keyboard itself.

## Commit checkpoints

1. PWA update coordination.
2. Linear large-number formatting — push-ready checkpoint.
3. Presentation memoization.
4. Mobile-safe expression focus.
5. Sequence engine consolidation and caching, split further if necessary.
6. Verification/documentation cleanup.

## Residual design questions

- Yellowstone's current candidate scan built 1,000 terms in about 17 ms and
  all 10,000 supported terms in about 1.38 s on the development machine. An
  indexed candidate structure is therefore deferred until the supported range
  grows or slower-device evidence justifies it.
- Exact harmonic, Bell, and partition caches now share both a 2,000-term bound
  and a 32 MiB estimated retained-memory boundary.
- A future component boundary around the result, palette, and History would
  further isolate renders, but the measured hot paths should be removed before
  undertaking that larger UI refactor.
