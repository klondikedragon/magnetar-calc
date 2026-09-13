import assert from "node:assert/strict";
import test from "node:test";
import { recamanCacheStats, recamanPolicy, recamanTerm } from "../src/recaman.js";

test("Recamán cache matches the OEIS prefix and greedy rule", () => {
  const expected = [0, 1, 3, 6, 2, 7, 13, 20, 12, 21, 11, 22, 10, 23, 9, 24, 8, 25, 43, 62, 42, 63, 41, 18, 42, 17, 43, 16, 44, 15];
  const terms = Array.from({ length: 512 }, (_, index) => recamanTerm(index));
  assert.deepEqual(terms.slice(0, expected.length), expected);
  const seen = new Set([terms[0]]);
  for (let index = 1; index < terms.length; index += 1) {
    const previous = terms[index - 1];
    const backward = previous - index;
    const expectedTerm = backward > 0 && !seen.has(backward) ? backward : previous + index;
    assert.equal(terms[index], expectedTerm, `term ${index} follows the standard greedy rule`);
    seen.add(terms[index]);
  }
});

test("Recamán cache has explicit term and memory bounds", () => {
  assert.throws(() => recamanTerm(recamanPolicy.maximumTerm + 1), /supports n/);
  const stats = recamanCacheStats();
  assert.ok(stats.cachedTerms >= 512);
  assert.ok(stats.estimatedBytes < stats.maximumCacheBytes);
});
