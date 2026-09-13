# History execution performance

## Goal

Make ordinary History saves, repeated saves, example imports, and JSON notebook
imports share one dependency-aware execution path whose work scales linearly
with the number of entries and referenced values.

## Measured baseline

- Raw Yellowstone terms 1–1,000: about 17 ms.
- Pure History execution, 1,000 entries: about 96 ms.
- Pure History execution, 10,000 entries: about 10.38 s.
- Bulk enqueue, 10,000 entries: about 3.84 s.
- Browser `@n` batch, 1,000 entries: about 650 ms.
- Browser dependent chain, 100 entries: about 1.85 s.
- Browser Fibonacci example import, 100 entries: about 7.46 s.

## Confirmed causes

- Notebook/example recomputation creates and destroys one module worker per
  entry.
- Notebook/example recomputation serializes every preceding History value for
  every entry, even when the expression requests only one or two values.
- Repeated insertion calls a whole-History append analysis once per entry.
- Scheduler dependency lookup repeatedly rebuilds whole-History maps and
  arrays.
- Dependency chains cross the worker/React boundary once per term.
- Import progress updates render the whole application once per term.

These paths predate the Node, Vite, and PWA upgrade. The newer development
toolchain may affect worker startup cost, but it did not introduce the
worker-per-entry architecture.

## Implementation slices

### 1. Linear ledger construction and lookup

- [x] Add a one-pass bulk append operation.
- [x] Build dependency lookup indexes once per scheduling pass.
- [x] Resolve only tokens actually requested by an expression.
- [x] Preserve stable IDs, relative-reference binding, `@n`, deletion
  invalidation, and import rebuilding semantics.
- [ ] Add scaling benchmarks that include enqueue time.

### 2. Dependency-aware worker batches

- [x] Represent a chronological batch as jobs with resolved dependency IDs.
- [x] Resolve dependencies produced earlier in the same batch inside the
  worker.
- [x] Carry independent failures without silently evaluating dependants.
- [x] Keep cancellation immediate by terminating the operation worker.
- [x] Add pure worker-program tests for independent and dependent jobs.

### 3. Unify queue and notebook execution

- [x] Use the same batch protocol for ordinary History and imported notebooks.
- [x] Keep one worker alive for an import/export operation.
- [x] Send only external values actually referenced by a batch.
- [x] Commit results and progress in bounded chunks rather than per entry.
- [x] Ensure imported answers remain untrusted and are always recomputed.

### 4. Verification

- [x] Cover cancellation, errors, relative references, stable references,
  `@n`, file imports, examples, and repeated saves.
- [x] Require near-linear scaling at 100, 1,000, and 10,000 entries with
  deliberately generous CI-safe timing ceilings.
- [x] Measure both independent sequences and dependent recurrences in the
  browser.
- [x] Run the complete Node 24 suite, oracle tests, production PWA build, and
  Cloudflare worker tests.

## Verification results

- 10,000-entry bulk enqueue improved from about 3.84 s to 15–29 ms.
- 10,000-entry non-UX History execution improved from about 10.38 s to
  1.93–1.95 s, including Yellowstone calculation, in 20 bounded batches.
- The 100-entry Fibonacci example import improved from about 7.46 s to
  543 ms in the development browser.
- A normal 100-entry dependent recurrence improved from about 1.85 s to
  287 ms in the development browser.
- The 1,000-entry Yellowstone example imported and recalculated in about
  312 ms in the development browser.
- The timing regression test constructs and schedules 10,000 entries in about
  71 ms on the development machine, with deliberately generous CI ceilings.
- The complete Node 24 test suite, SymPy/mpmath oracles, and Cloudflare route
  tests pass. Production PWA build verification is recorded with the final
  commit.

## Residual work

- Rendering or inspecting a newly inserted 10,000-row History can still create
  browser-main-thread pressure even though ledger construction and calculation
  are bounded. Profile React/Virtuoso mounting separately if real-device
  evidence shows this remains visible after the execution fixes.
