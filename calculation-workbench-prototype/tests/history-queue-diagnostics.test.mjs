import assert from "node:assert/strict";
import test from "node:test";
import { createHistoryQueueDiagnostics } from "../src/historyQueueDiagnostics.js";

test("keeps a bounded immutable queue diagnostic trace", () => {
  const trace = createHistoryQueueDiagnostics(2);
  trace.record({ event: "queued", id: 1 });
  trace.record({ event: "dispatched", id: 1 });
  trace.record({ event: "committed", id: 1 });
  assert.deepEqual(trace.snapshot().map((entry) => entry.event), ["dispatched", "committed"]);
  trace.clear();
  assert.deepEqual(trace.snapshot(), []);
});
