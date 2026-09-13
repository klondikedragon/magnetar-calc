import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultWorkspace } from "../src/seedWorkspace.js";
import { prepareWorkspaceHydration } from "../src/workspaceHydration.js";

const deserialize = (value) => value?.valid ? value : null;

test("fresh workspace seeds become ordinary queued History work", () => {
  const seed = createDefaultWorkspace();
  const prepared = prepareWorkspaceHydration(null, seed, deserialize);
  assert.equal(prepared.workspace.expression, "2 ^ 19937 - 1");
  assert.deepEqual(prepared.history.map((item) => item.id), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(prepared.history.every((item) => item.state === "queued"));
});

test("stored answers hydrate as completed cache entries", () => {
  const seed = createDefaultWorkspace();
  const stored = { expression: "7", nextId: 2, history: [{ id: 1, expression: "7", value: { valid: true } }] };
  const prepared = prepareWorkspaceHydration(stored, seed, deserialize);
  assert.equal(prepared.workspace, stored);
  assert.equal(prepared.history[0].state, "completed");
  assert.equal(prepared.recovered, false);
});

test("invalid cached values recover to the declarative seed", () => {
  const seed = createDefaultWorkspace();
  const stored = { expression: "bad", history: [{ id: 1, expression: "7", value: null }] };
  const prepared = prepareWorkspaceHydration(stored, seed, deserialize);
  assert.equal(prepared.workspace, seed);
  assert.equal(prepared.recovered, true);
  assert.ok(prepared.history.every((item) => item.state === "queued"));
});
