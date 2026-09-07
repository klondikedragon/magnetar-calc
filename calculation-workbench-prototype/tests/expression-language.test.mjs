import assert from "node:assert/strict";
import test from "node:test";
import { astToExpression, catalogImplementationIssues, parseExpression, tokenizeExpression } from "../src/expressionLanguage.js";

test("the extension registry covers every catalog entry", () => {
  assert.deepEqual(catalogImplementationIssues(), { missing: [], orphaned: [] });
});

test("the generic lexer recognizes references, names, and symbolic operators", () => {
  assert.deepEqual(tokenizeExpression("5pi + @history(-1) ↑↑ 3").map((token) => token.value), ["5", "pi", "+", "@history(-1)", "↑↑", "3", ""]);
});

test("accepts grouped decimal literals outside direct function arguments", () => {
  assert.deepEqual(tokenizeExpression("(1,234.50) + 6,789").map((token) => token.value), ["(", "1234.50", ")", "+", "6789", ""]);
  assert.equal(parseExpression("1,234 + 5").left.raw, "1234");
});

test("keeps commas as direct function argument separators", () => {
  const call = parseExpression("min(1,234)");
  assert.equal(call.args.length, 2);
  assert.equal(call.args[0].raw, "1");
  assert.equal(call.args[1].raw, "234");
  assert.equal(parseExpression("fib((1,234))").args[0].value.raw, "1234");
});

test("rejects malformed grouped decimal literals", () => {
  assert.throws(() => tokenizeExpression("12,34"), /invalid digit grouping/);
  assert.throws(() => tokenizeExpression("1,234,56"), /invalid digit grouping/);
});

test("the Pratt parser gives powers and tetration right associativity", () => {
  const power = parseExpression("2^3^2");
  assert.equal(power.type, "binary");
  assert.equal(power.implementationId, "arithmetic-power");
  assert.equal(power.right.type, "binary");
  assert.equal(parseExpression("2^^3").implementationId, "hyperoperation-knuth-double");
});

test("the parser represents calls, postfix forms, and implicit multiplication", () => {
  const ast = parseExpression("2fib(5)! + √(9)");
  assert.equal(ast.type, "binary");
  assert.equal(ast.left.implicit, true);
  assert.equal(ast.left.right.type, "postfix");
  assert.equal(astToExpression(parseExpression("min(8, @n, 12)")), "min(8, @n, 12)");
});

test("the parser reports source-level failures", () => {
  assert.throws(() => parseExpression("sqrt(4"), /missing parenthesis/);
  assert.throws(() => parseExpression("2 & 3"), /unsupported expression/);
});
