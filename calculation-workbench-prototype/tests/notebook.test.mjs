import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically } from "../src/engine.js";
import { exampleWorkbenches } from "../src/exampleWorkbenches.js";
import { createNotebook, validateNotebook } from "../src/notebook.js";

const view = { base: 10, precision: 48, notation: "auto", groupDigits: true, activeMode: "Calculator" };

test("exports an expression-first notebook with optional cached answers and view", () => {
  const value = evaluateAutomatically("123");
  const notebook = createNotebook({ expression: "123", previewValue: value, includeActiveAnswer: true, history: [{ id: 4, expression: "123", value }], nextId: 5, view, includeView: true, includeAnswers: true });
  assert.equal(notebook.schemaVersion, 1);
  assert.equal(notebook.history[0].id, 4);
  assert.equal(notebook.history[0].expression, "123");
  assert.equal(notebook.history[0].output.engine.id, "decimal.js");
  assert.equal(notebook.history[0].output.renderedAnswer, "123");
  assert.deepEqual(validateNotebook(notebook), { expression: "123", history: [{ id: 4, expression: "123" }], nextId: 5, view });
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
