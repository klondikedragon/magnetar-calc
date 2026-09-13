import assert from "node:assert/strict";
import test from "node:test";
import { canActivatePwaUpdate, pwaUpdateCheckIntervalMs, pwaUpdateIdleDelay } from "../src/pwaUpdatePolicy.js";

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
