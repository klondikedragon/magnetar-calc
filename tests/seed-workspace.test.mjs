import assert from "node:assert/strict";
import test from "node:test";
import { parseExpression } from "../src/expressionLanguage.js";
import { createDefaultWorkspace, defaultExpression, defaultHistoryExpression } from "../src/seedWorkspace.js";

test("builds a grammar-validated Mersenne default and ten Fibonacci seed entries", () => {
  const workspace = createDefaultWorkspace();
  assert.doesNotThrow(() => parseExpression(defaultExpression));
  assert.doesNotThrow(() => parseExpression(defaultHistoryExpression));
  assert.equal(defaultExpression, "2 ^ 19937 - 1");
  assert.equal(defaultHistoryExpression, "fib(@n - 1)");
  assert.equal(workspace.expression, defaultExpression);
  assert.equal(workspace.nextId, 11);
  assert.deepEqual(workspace.history.map((item) => item.id), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(workspace.history.map((item) => item.value.exactInteger), ["34", "21", "13", "8", "5", "3", "2", "1", "1", "0"]);
  assert.equal(workspace.previewValue.exactInteger.length, 6002);
});
