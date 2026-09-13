# Interaction and sequence performance

## Status

In progress. This plan removes interaction work that scales with result size,
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

- [ ] Memoize active result formatting, inspection, digit counts, and tooltip
  derivation by value and view settings.
- [ ] Reuse already-derived representations rather than calling the formatter
  twice in one render.
- [ ] Audit memory and visible History rows for equivalent duplication without
  introducing stale display state.
- [ ] Add a render-cost or pure-presentation benchmark that demonstrates that
  unrelated interaction state does not reformat a large unchanged value.

### 4. Make calculator focus mobile-safe

- [ ] Focus the active textarea synchronously inside trusted calculator-button
  activation; restore its selection after the controlled value update.
- [ ] Keep modal-opening controls and ordinary navigation controls on their own
  appropriate focus targets.
- [ ] Give the expression editing row a comfortable touch target that invokes
  native focus only after the user taps it.
- [ ] Add `touch-action: manipulation` and explicit prefixed/unprefixed
  non-selection rules to app controls while preserving selectable outputs.
- [ ] Add appropriate mobile text-entry hints without forcing a numeric-only
  keyboard or focusing on startup.

### 5. Consolidate and optimize sequence evaluation

- [ ] Define one authoritative implementation path used by exact and fallback
  engines.
- [ ] Use direct algorithms where they dominate caching: fast doubling for
  Fibonacci/Lucas, a direct integer formula for Jacobsthal, O(1) triangular,
  and O(log n) Stern.
- [ ] Use bounded incremental caches where sequential reuse is valuable:
  Catalan, partition, Bell, harmonic, prime/nth-prime, Yellowstone, and Recaman.
- [ ] Give every retained cache an explicit term and estimated-memory policy.
- [ ] Review Yellowstone candidate selection separately; its retained prefix
  prevents recomputation but its candidate scan still needs scaling evidence.
- [ ] Add oracle prefixes, recurrence/property tests, cache-boundary tests, and
  repeated-sequential-call benchmarks.

### 6. Integrated verification

- [ ] Run the complete Node 24 test suite, oracle tests, History benchmark,
  production build, and Cloudflare/Sites checks.
- [ ] Verify local button input, caret placement, keyboard navigation, large
  exact display, History queue completion, and PWA update deferral.
- [ ] Inspect production-browser console output and record any iPad Safari
  checks that still require a physical-device pass.
- [ ] Update this plan with measured before/after results and residual risks.

## Commit checkpoints

1. PWA update coordination.
2. Linear large-number formatting — push-ready checkpoint.
3. Presentation memoization.
4. Mobile-safe expression focus.
5. Sequence engine consolidation and caching, split further if necessary.
6. Verification/documentation cleanup.

## Residual design questions

- Yellowstone may need an indexed candidate structure rather than a generic
  append-only cache to scale beyond its present 10,000-term boundary.
- Exact harmonic, Bell, and partition caches can retain very large BigInts;
  their policies must be based on estimated retained bytes, not term count
  alone.
- A future component boundary around the result, palette, and History would
  further isolate renders, but the measured hot paths should be removed before
  undertaking that larger UI refactor.
