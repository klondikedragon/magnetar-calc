import assert from "node:assert/strict";
import test from "node:test";
import { wrapExpressionForContinuation } from "../src/expressionContinuation.js";

test("wraps a complete expression for palette continuation", () => {
  assert.equal(wrapExpressionForContinuation("2 + 3 * 4"), "(2 + 3 * 4)");
});

test("does not accumulate redundant whole-expression parentheses", () => {
  assert.equal(wrapExpressionForContinuation("((2 + 3))"), "((2 + 3))");
  assert.equal(wrapExpressionForContinuation("(2) + (3)"), "((2) + (3))");
});
