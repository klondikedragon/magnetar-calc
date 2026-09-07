import assert from "node:assert/strict";
import test from "node:test";
import { appendHistoryEntry, invalidateAfterHistoryDeletion, nextHistoryWork, transitionHistoryEntry, workerReferencesForEntry } from "../src/historyLedger.js";

const complete = (id, expression, value) => ({ id, expression, value, state: "completed", ordinal: id, references: [], usesSequencePosition: false, error: null });

test("mints an ID immediately and resolves only an entry's needed worker references", () => {
  const history = [complete(2, "2", "2"), complete(1, "1", "1")];
  const next = appendHistoryEntry(history, { id: 3, expression: "@history(-1) + @n" });
  assert.equal(next[0].id, 3);
  assert.equal(next[0].state, "queued");
  assert.deepEqual(workerReferencesForEntry(next, next[0]).references, [["@history(-1)", "2"], ["@n", "3"]]);
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
