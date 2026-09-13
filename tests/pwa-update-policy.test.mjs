import assert from "node:assert/strict";
import test from "node:test";
import { canActivatePwaUpdate, createPwaUpdateCoordinator, pwaUpdateCheckIntervalMs, pwaUpdateIdleDelay } from "../src/pwaUpdatePolicy.js";

const idleApp = {
  modalOpen: false,
  calculationStatus: "completed",
  pendingHistoryCount: 0,
  exportActive: false,
  notebookOperationActive: false,
};

test("a PWA update activates only when calculator work is safely idle", () => {
  assert.equal(canActivatePwaUpdate(idleApp), true);
  assert.equal(canActivatePwaUpdate({ ...idleApp, modalOpen: true }), false);
  assert.equal(canActivatePwaUpdate({ ...idleApp, calculationStatus: "computing" }), false);
  assert.equal(canActivatePwaUpdate({ ...idleApp, calculationStatus: "debouncing" }), false);
  assert.equal(canActivatePwaUpdate({ ...idleApp, pendingHistoryCount: 1 }), false);
  assert.equal(canActivatePwaUpdate({ ...idleApp, exportActive: true }), false);
  assert.equal(canActivatePwaUpdate({ ...idleApp, notebookOperationActive: true }), false);
});

test("PWA update checks run on a 16-hour cadence and wait for brief input idle time", () => {
  assert.equal(pwaUpdateCheckIntervalMs, 16 * 60 * 60 * 1_000);
  assert.equal(pwaUpdateIdleDelay(1_000, 2_500), 0);
  assert.ok(pwaUpdateIdleDelay(1_000, 1_001) > 0);
});

function coordinatorHarness({ safe = true, activation = () => Promise.resolve() } = {}) {
  let clock = 1_000;
  let nextTimer = 1;
  const timers = new Map();
  const events = [];
  const coordinator = createPwaUpdateCoordinator({
    canActivate: () => safe,
    flush: () => events.push("flush"),
    activate: () => { events.push("activate"); return activation(); },
    now: () => clock,
    setTimer: (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    coordinator,
    events,
    timers,
    setSafe(value) { safe = value; },
    advance(milliseconds) {
      clock += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= clock).sort((left, right) => left[1].at - right[1].at);
      for (const [id, timer] of due) { if (timers.delete(id)) timer.callback(); }
    },
  };
}

test("ordinary interaction does not schedule work without a waiting update", () => {
  const harness = coordinatorHarness();
  harness.coordinator.noteInteraction();
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.coordinator.snapshot().updateAvailable, false);
});

test("a waiting update activates after a full quiet interval", () => {
  const harness = coordinatorHarness();
  harness.coordinator.setUpdateAvailable();
  harness.advance(1_000);
  harness.coordinator.noteInteraction();
  harness.advance(1_499);
  assert.deepEqual(harness.events, []);
  harness.advance(1);
  assert.deepEqual(harness.events, ["flush", "activate"]);
});

test("a blocked update is reconsidered when application safety changes", () => {
  const harness = coordinatorHarness({ safe: false });
  harness.coordinator.setUpdateAvailable();
  assert.equal(harness.timers.size, 0);
  harness.setSafe(true);
  harness.coordinator.reconsider();
  harness.advance(1_500);
  assert.deepEqual(harness.events, ["flush", "activate"]);
});

test("failed activation unlocks and waits before retrying", async () => {
  let attempts = 0;
  const harness = coordinatorHarness({ activation: () => attempts++ === 0 ? Promise.reject(new Error("offline")) : Promise.resolve() });
  harness.coordinator.setUpdateAvailable();
  harness.advance(1_500);
  await Promise.resolve();
  assert.equal(harness.coordinator.snapshot().activating, false);
  harness.advance(1_499);
  assert.deepEqual(harness.events, ["flush", "activate"]);
  harness.advance(1);
  assert.deepEqual(harness.events, ["flush", "activate", "flush", "activate"]);
});

test("disposing the coordinator clears a pending update", () => {
  const harness = coordinatorHarness();
  harness.coordinator.setUpdateAvailable();
  harness.coordinator.dispose();
  harness.advance(2_000);
  assert.deepEqual(harness.events, []);
});
