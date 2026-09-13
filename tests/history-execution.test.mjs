import assert from "node:assert/strict";
import test from "node:test";
import { appendHistoryEntries, nextHistoryBatch, transitionHistoryEntry } from "../src/historyLedger.js";
import { createHistoryWorkerRequest, evaluateHistoryJobs, mergeHistoryResults } from "../src/historyExecution.js";

function executableJobs(batch) {
  return batch.jobs.map(({ entry, references }) => ({
    id: entry.id,
    revision: entry.revision,
    expression: entry.expression,
    ordinal: entry.ordinal,
    references,
    options: { precision: 48 },
  }));
}

test("evaluates dependent History jobs inside one chronological batch", () => {
  const history = appendHistoryEntries([], [
    { id: 1, expression: "1" },
    { id: 2, expression: "2" },
    { id: 3, expression: "@history(-1) + @history(-2)" },
    { id: 4, expression: "@history(3) + @n" },
  ]);
  const batch = nextHistoryBatch(history);
  const results = evaluateHistoryJobs(executableJobs(batch), new Map(batch.externalValues));
  assert.deepEqual(results.map((result) => result.value?.exactInteger), ["1", "2", "3", "7"]);
});

test("sends only completed values referenced outside the batch", () => {
  let history = appendHistoryEntries([], [
    { id: 1, expression: "10" },
    { id: 2, expression: "@history(-1) + 1" },
    { id: 3, expression: "@history(-1) + @history(1)" },
  ]);
  history = transitionHistoryEntry(history, 1, 1, { state: "completed", value: "10" });
  const batch = nextHistoryBatch(history);
  assert.deepEqual(batch.externalValues, [[1, "10"]]);
  const results = evaluateHistoryJobs(executableJobs(batch), new Map(batch.externalValues));
  assert.deepEqual(results.map((result) => result.value?.exactInteger), ["11", "21"]);
});

test("reports a failed job and blocks its dependent job without aborting the batch", () => {
  const history = appendHistoryEntries([], [
    { id: 1, expression: "not_a_function(1)" },
    { id: 2, expression: "@history(-1) + 1" },
    { id: 3, expression: "4" },
  ]);
  const results = evaluateHistoryJobs(executableJobs(nextHistoryBatch(history)));
  assert.deepEqual(results.map((result) => result.type), ["error", "error", "result"]);
  assert.match(results[1].message, /did not complete/);
  assert.equal(results[2].value.exactInteger, "4");
});

test("creates a compact worker request with dependency descriptors", () => {
  const history = appendHistoryEntries([], [
    { id: 1, expression: "1" },
    { id: 2, expression: "@history(-1) + @n" },
  ]);
  const request = createHistoryWorkerRequest(nextHistoryBatch(history), { precision: 48 });
  assert.equal(request.historyJobs.length, 2);
  assert.deepEqual(request.historyJobs[1].references, [{ token: "@history(-1)", targetId: 1 }, { token: "@n", targetId: null }]);
  assert.deepEqual(request.historyValues, []);
});

test("merges worker results by ID and revision without touching stale entries", () => {
  const history = appendHistoryEntries([], [{ id: 1, expression: "1" }, { id: 2, expression: "2" }]);
  const merged = mergeHistoryResults(history, [
    { id: 1, revision: 1, type: "result", value: "one" },
    { id: 2, revision: 2, type: "result", value: "stale" },
  ], (value) => value.toUpperCase());
  assert.equal(merged.find((entry) => entry.id === 1).value, "ONE");
  assert.equal(merged.find((entry) => entry.id === 2).state, "queued");
});
