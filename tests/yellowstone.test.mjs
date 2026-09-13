import assert from "node:assert/strict";
import test from "node:test";
import { yellowstoneCacheStats, yellowstonePolicy, yellowstoneTerm } from "../src/yellowstone.js";

function gcd(left, right) {
  let a = left;
  let b = right;
  while (b) [a, b] = [b, a % b];
  return a;
}

test("Yellowstone cache preserves the greedy permutation invariant", () => {
  const terms = Array.from({ length: 512 }, (_, index) => yellowstoneTerm(index + 1));
  assert.equal(new Set(terms).size, terms.length);
  const used = new Set(terms.slice(0, 3));
  for (let index = 3; index < terms.length; index += 1) {
    const term = terms[index];
    assert.ok(gcd(term, terms[index - 2]) > 1, `term ${index + 1} shares a factor with term ${index - 1}`);
    assert.equal(gcd(term, terms[index - 1]), 1, `term ${index + 1} is coprime with the previous term`);
    for (let candidate = 1; candidate < term; candidate += 1) assert.ok(used.has(candidate) || gcd(candidate, terms[index - 2]) === 1 || gcd(candidate, terms[index - 1]) !== 1, `term ${index + 1} is the smallest eligible unused value`);
    used.add(term);
  }
});

test("Yellowstone cache has explicit term and memory bounds", () => {
  assert.throws(() => yellowstoneTerm(yellowstonePolicy.maximumTerm + 1), /supports n/);
  const stats = yellowstoneCacheStats();
  assert.ok(stats.cachedTerms >= 512);
  assert.ok(stats.estimatedBytes < stats.maximumCacheBytes);
});
