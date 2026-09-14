import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically } from "../src/engine.js";
import { exampleWorkbenches } from "../src/exampleWorkbenches.js";
import { createNotebook, maximumNotebookHistoryEntries, validateNotebook } from "../src/notebook.js";

const view = { base: 10, precision: 48, notation: "auto", groupDigits: true, activeMode: "Calculator" };

test("exports an expression-first notebook with optional cached answers and view", () => {
  const value = evaluateAutomatically("123");
  const notebook = createNotebook({ expression: "123", previewValue: value, includeActiveAnswer: true, history: [{ id: 4, expression: "123", value }], nextId: 5, view, includeView: true, includeAnswers: true });
  assert.equal(notebook.schemaVersion, 1);
  assert.equal(notebook.history[0].id, 4);
  assert.equal(notebook.history[0].expression, "123");
  assert.equal(notebook.history[0].output.engine.id, "native-exact");
  assert.equal(notebook.history[0].output.renderedAnswer, "123");
  assert.deepEqual(validateNotebook(notebook), { expression: "123", history: [{ id: 4, expression: "123" }], nextId: 5, view });
});

test("keeps device appearance out of notebook view exports", () => {
  const notebook = createNotebook({
    expression: "1",
    previewValue: null,
    includeActiveAnswer: false,
    history: [],
    nextId: 1,
    view: { ...view, appearance: "dark", theme: "dark" },
    includeView: true,
    includeAnswers: false,
  });
  assert.equal(notebook.viewSettings.appearance, undefined);
  assert.equal(notebook.viewSettings.theme, undefined);
  assert.equal(notebook.viewSettings.base, 10);
});

test("imports preserve Fibonacci order and relative expressions while discarding outputs", () => {
  const fibonacci = validateNotebook(exampleWorkbenches.fibonacci);
  assert.equal(fibonacci.history[0].id, 5);
  assert.equal(fibonacci.history.at(-1).id, 1);
  assert.equal(fibonacci.expression, "@history(-1) + @history(-2)");
  assert.equal(fibonacci.history[0].output, undefined);
});

test("rejects invalid or duplicate History IDs", () => {
  assert.throws(() => validateNotebook({ schemaVersion: 1, activeExpression: { expression: "1" }, history: [{ id: 1, expression: "1" }, { id: 1, expression: "2" }] }), /invalid/);
});

test("normalizes an unsafe or stale next History ID", () => {
  const base = { schemaVersion: 1, activeExpression: { expression: "1" }, history: [{ id: 7, expression: "1" }] };
  assert.equal(validateNotebook({ ...base, nextHistoryId: 4 }).nextId, 8);
  assert.equal(validateNotebook({ ...base, nextHistoryId: Number.MAX_SAFE_INTEGER + 1 }).nextId, 8);
});

test("expands a bounded repeat block into ordinary newest-first History entries", () => {
  const notebook = validateNotebook({ schemaVersion: 1, activeExpression: { expression: "yellowstone(@n)" }, history: [{ repeat: { expression: "yellowstone(@n)", count: 3, startId: 7 } }], nextHistoryId: 10 });
  assert.deepEqual(notebook.history, [
    { id: 9, expression: "yellowstone(@n)" },
    { id: 8, expression: "yellowstone(@n)" },
    { id: 7, expression: "yellowstone(@n)" },
  ]);
});

test("rejects oversized or malformed History repeat blocks", () => {
  const base = { schemaVersion: 1, activeExpression: { expression: "1" } };
  assert.throws(() => validateNotebook({ ...base, history: [{ repeat: { expression: "1", count: maximumNotebookHistoryEntries + 1, startId: 1 } }] }), /repeat entry is invalid/);
  assert.throws(() => validateNotebook({ ...base, history: [{ repeat: { expression: "1", count: 3, startId: 2 } }, { id: 3, expression: "1" }] }), /History entry is invalid/);
});
