import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically } from "../src/engine.js";

// Composition is a separate contract from an individual function's behavior:
// any exact intermediate result should remain usable as an input to another
// catalog function, no matter how deeply it is nested.
const compositionCases = [
  ["nested Steinhaus triangles", "sm_triangle(sm_triangle(1))", "1"],
  ["a sequence as a Steinhaus input", "sm_triangle(fib(3))", "4"],
  ["a Steinhaus result inside a root", "sqrt(sm_triangle(4))", "16"],
  ["multiple Steinhaus results in a variadic function", "max(sm_triangle(2), sm_triangle(3))", "27"],
  ["Steinhaus with an ordinary arithmetic expression", "sm_triangle(1 + 2)", "27"],
  ["mixed trigonometry, Steinhaus, and rounding", "round(sin(0) + sm_triangle(2), 0)", "4"],
  ["ordinary nested catalog functions", "sqrt(abs(-81))", "9"],
  ["nested variadic and sequence functions", "min(max(2, 3), fib(5))", "3"],
];

for (const [name, expression, expected] of compositionCases) {
  test(`composes ${name}`, () => {
    const value = evaluateAutomatically(expression);
    assert.equal(value.decimal?.toString(), expected);
  });
}

test("composes a Steinhaus construction with a History reference", () => {
  const value = evaluateAutomatically("sm_triangle(@history(-1))", new Map([["@history(-1)", "2"]]));
  assert.equal(value.decimal?.toString(), "4");
});

