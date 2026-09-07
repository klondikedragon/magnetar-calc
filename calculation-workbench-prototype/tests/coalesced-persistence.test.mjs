import assert from "node:assert/strict";
import test from "node:test";
import { createCoalescedPersistence } from "../src/coalescedPersistence.js";

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(milliseconds) {
      now += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((left, right) => left[1].at - right[1].at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

test("coalesces rapid snapshots and serializes only the newest state", () => {
  const timers = createFakeTimers();
  const writes = [];
  const persistence = createCoalescedPersistence({ write: (snapshot) => writes.push(snapshot), timers });
  persistence.schedule(() => "first");
  timers.advance(500);
  persistence.schedule(() => "latest");
  timers.advance(999);
  assert.deepEqual(writes, []);
  timers.advance(1);
  assert.deepEqual(writes, ["latest"]);
});

test("uses a maximum checkpoint interval during continuous updates", () => {
  const timers = createFakeTimers();
  const writes = [];
  const persistence = createCoalescedPersistence({ write: (snapshot) => writes.push(snapshot), timers, delayMs: 1_000, maximumDelayMs: 3_000 });
  persistence.schedule(() => "first");
  timers.advance(900);
  persistence.schedule(() => "second");
  timers.advance(900);
  persistence.schedule(() => "third");
  timers.advance(900);
  persistence.schedule(() => "checkpoint");
  timers.advance(300);
  assert.deepEqual(writes, ["checkpoint"]);
});

test("flushes the newest snapshot for lifecycle events", () => {
  const timers = createFakeTimers();
  const writes = [];
  const persistence = createCoalescedPersistence({ write: (snapshot) => writes.push(snapshot), timers });
  persistence.schedule(() => "durable");
  assert.equal(persistence.flush(), true);
  assert.deepEqual(writes, ["durable"]);
  assert.equal(persistence.flush(), false);
});
