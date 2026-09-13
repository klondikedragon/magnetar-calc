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
- [ ] Resolve only tokens actually requested by an expression.
- [ ] Preserve stable IDs, relative-reference binding, `@n`, deletion
  invalidation, and import rebuilding semantics.
- [ ] Add scaling benchmarks that include enqueue time.

### 2. Dependency-aware worker batches

- [ ] Represent a chronological batch as jobs with resolved dependency IDs.
- [ ] Resolve dependencies produced earlier in the same batch inside the
  worker.
- [ ] Carry independent failures without silently evaluating dependants.
- [ ] Keep cancellation immediate by terminating the operation worker.
- [ ] Add pure worker-program tests for independent and dependent jobs.

### 3. Unify queue and notebook execution

- [ ] Use the same batch protocol for ordinary History and imported notebooks.
- [ ] Keep one worker alive for an import/export operation.
- [ ] Send only external values actually referenced by a batch.
- [ ] Commit results and progress in bounded chunks rather than per entry.
- [ ] Ensure imported answers remain untrusted and are always recomputed.

### 4. Verification

- [ ] Cover cancellation, errors, relative references, stable references,
  `@n`, file imports, examples, and repeated saves.
- [ ] Require near-linear scaling at 100, 1,000, and 10,000 entries with
  deliberately generous CI-safe timing ceilings.
- [ ] Measure both independent sequences and dependent recurrences in the
  browser.
- [ ] Run the complete Node 24 suite, oracle tests, production PWA build, and
  Cloudflare worker tests.
