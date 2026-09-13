import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { appendHistoryEntries, nextHistoryBatch } from "../src/historyLedger.js";

const entryCount = 10_000;
const batchSize = 512;

test("bulk History construction and scheduling remain near-linear", () => {
  const entries = Array.from({ length: entryCount }, (_, index) => ({ id: index + 1, expression: "yellowstone(@n)" }));
  const started = performance.now();
  let history = appendHistoryEntries([], entries);
  const enqueueMs = performance.now() - started;
  let batches = 0;
  let scheduled = 0;
  while (scheduled < entryCount) {
    const batch = nextHistoryBatch(history, batchSize);
    assert.equal(batch.kind, "ready");
    const ids = new Set(batch.jobs.map(({ entry }) => entry.id));
    history = history.map((entry) => ids.has(entry.id) ? { ...entry, state: "completed", value: String(entry.ordinal) } : entry);
    scheduled += batch.jobs.length;
    batches += 1;
  }
  const elapsedMs = performance.now() - started;
  assert.equal(scheduled, entryCount);
  assert.equal(batches, Math.ceil(entryCount / batchSize));
  assert.ok(enqueueMs < 1_000, `10,000-entry enqueue took ${enqueueMs.toFixed(1)} ms`);
  assert.ok(elapsedMs < 3_000, `10,000-entry scheduling took ${elapsedMs.toFixed(1)} ms`);
});

test("a dependency chain stays inside bounded worker batches", () => {
  const history = appendHistoryEntries([], [
    { id: 1, expression: "1" },
    ...Array.from({ length: 999 }, (_, index) => ({ id: index + 2, expression: "@history(-1) + 1" })),
  ]);
  const batch = nextHistoryBatch(history, batchSize);
  assert.equal(batch.kind, "ready");
  assert.equal(batch.jobs.length, batchSize);
  assert.deepEqual(batch.externalValues, []);
});
