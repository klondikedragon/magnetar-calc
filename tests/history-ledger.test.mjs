import assert from "node:assert/strict";
import test from "node:test";
import { appendHistoryEntries, appendHistoryEntry, invalidateAfterHistoryDeletion, nextHistoryBatch, nextHistoryWork, recoverOrphanedHistoryWork, transitionHistoryEntry, workerReferencesForEntry } from "../src/historyLedger.js";

const complete = (id, expression, value) => ({ id, expression, value, state: "completed", ordinal: id, references: [], usesSequencePosition: false, error: null });

test("mints an ID immediately and resolves only an entry's needed worker references", () => {
  const history = [complete(2, "2", "2"), complete(1, "1", "1")];
  const next = appendHistoryEntry(history, { id: 3, expression: "@history(-1) + @n" });
  assert.equal(next[0].id, 3);
  assert.equal(next[0].state, "queued");
  assert.deepEqual(workerReferencesForEntry(next, next[0]).references, [["@history(-1)", "2"], ["@n", "3"]]);
});

test("bulk append preserves single-append dependency semantics", () => {
  const entries = [
    { id: 1, expression: "1" },
    { id: 2, expression: "@history(-1) + @n" },
    { id: 3, expression: "@history(1) + @history(-1)" },
  ];
  let incremental = [];
  for (const entry of entries) incremental = appendHistoryEntry(incremental, entry);
  assert.deepEqual(appendHistoryEntries([], entries), incremental);
});

test("deletion dirties dynamic sequence entries and their dependants", () => {
  const history = [
    complete(4, "@history(3) + 1", "5"),
    { ...complete(3, "@n", "3"), ordinal: 3, references: [{ token: "@n", targetId: null }], usesSequencePosition: true },
    complete(2, "2", "2"),
    complete(1, "1", "1"),
  ];
  const next = invalidateAfterHistoryDeletion(history, 2);
  assert.equal(next.find((entry) => entry.id === 3).state, "dirty");
  assert.equal(next.find((entry) => entry.id === 4).state, "dirty");
});

test("schedules only the oldest ready entry and rejects a stale job revision", () => {
  let history = appendHistoryEntry([], { id: 1, expression: "yellowstone(@n)" });
  history = appendHistoryEntry(history, { id: 2, expression: "yellowstone(@n)" });
  const first = nextHistoryWork(history);
  assert.equal(first.kind, "ready");
  assert.equal(first.entry.id, 1);
  const computing = transitionHistoryEntry(history, 1, 1, { state: "computing" });
  const stale = transitionHistoryEntry(computing, 1, 2, { state: "completed", value: "incorrect" });
  assert.equal(stale.find((entry) => entry.id === 1).state, "computing");
});

test("never schedules past an earlier computing entry", () => {
  let history = appendHistoryEntry([], { id: 1, expression: "yellowstone(@n)" });
  history = appendHistoryEntry(history, { id: 2, expression: "yellowstone(@n)" });
  const computing = transitionHistoryEntry(history, 1, 1, { state: "computing" });
  const next = nextHistoryWork(computing);
  assert.equal(next.kind, "computing");
  assert.equal(next.entry.id, 1);
});

test("batches only contiguous History entries whose dependencies are resolved", () => {
  let history = appendHistoryEntry([], { id: 1, expression: "yellowstone(@n)" });
  history = appendHistoryEntry(history, { id: 2, expression: "yellowstone(@n)" });
  history = appendHistoryEntry(history, { id: 3, expression: "@history(-1) + 1" });
  const batch = nextHistoryBatch(history);
  assert.equal(batch.kind, "ready");
  assert.deepEqual(batch.jobs.map((job) => job.entry.id), [1, 2]);
});

test("returns orphaned computing work to the serial queue", () => {
  const history = [complete(2, "2", "2"), { ...complete(1, "1", "1"), state: "computing" }];
  const recovered = recoverOrphanedHistoryWork(history);
  assert.equal(recovered.find((entry) => entry.id === 1).state, "queued");
  assert.equal(recovered.find((entry) => entry.id === 2).state, "completed");
});
