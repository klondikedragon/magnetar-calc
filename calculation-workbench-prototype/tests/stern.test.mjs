import assert from "node:assert/strict";
import test from "node:test";
import { sternPolicy, sternTerm } from "../src/stern.js";

test("Stern's direct binary evaluation matches its OEIS prefix and recurrence", () => {
  const expected = [0n, 1n, 1n, 2n, 1n, 3n, 2n, 3n, 1n, 4n, 3n, 5n, 2n, 5n, 3n, 4n];
  assert.deepEqual(expected.map((_, index) => sternTerm(index)), expected);
  for (let n = 1; n <= 4096; n += 1) {
    assert.equal(sternTerm(2 * n), sternTerm(n));
    assert.equal(sternTerm((2 * n) + 1), sternTerm(n) + sternTerm(n + 1));
  }
});

test("Stern's direct evaluator has an explicit input bound", () => {
  assert.throws(() => sternTerm(sternPolicy.maximumTerm + 1), /supports n/);
});
