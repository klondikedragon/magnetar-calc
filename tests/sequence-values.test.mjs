import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically } from "../src/engine.js";
import { sequenceValue, sequenceValueCacheStats, sequenceValuePolicy } from "../src/sequenceValues.js";

const knownValues = [
  ["fib", 100, null, "354224848179261915075"],
  ["lucas", 20, null, "15127"],
  ["jacobsthal", 20, null, "349525"],
  ["triangular", 100, null, "5050"],
  ["catalan", 20, null, "6564120420"],
  ["partition", 100, null, "190569292"],
  ["bell", 15, null, "1382958545"],
  ["binomial", 100, 50, "100891344545564193334812497256"],
  ["stirling2", 10, 3, "9330"],
  ["prime", 100, null, "541"],
  ["primepi", 100, null, "25"],
];

for (const [name, n, k, expected] of knownValues) {
  test(`${name} uses the shared mathematically verified value`, () => {
    const value = sequenceValue(name, n, k);
    assert.equal(value.value.toString(), expected);
    const expression = k === null ? `${name}(${n})` : `${name}(${n}, ${k})`;
    assert.equal(evaluateAutomatically(expression).exactInteger, expected);
  });
}

test("cached recurrence tables extend instead of rebuilding", () => {
  sequenceValue("partition", 1_000);
  sequenceValue("bell", 200);
  sequenceValue("harmonic", 1_000);
  const before = sequenceValueCacheStats();
  sequenceValue("partition", 1_001);
  sequenceValue("bell", 201);
  sequenceValue("harmonic", 1_001);
  const after = sequenceValueCacheStats();
  assert.equal(after.partitionTerms, before.partitionTerms + 1);
  assert.equal(after.bellTerms, before.bellTerms + 1);
  assert.equal(after.harmonicTerms, before.harmonicTerms + 1);
  assert.ok(after.estimatedCacheBytes < after.maximumEstimatedCacheBytes);
});

test("shared sequence tables enforce explicit bounds", () => {
  assert.throws(() => sequenceValue("partition", sequenceValuePolicy.maximumCachedIndex + 1), /supports n/);
  assert.throws(() => sequenceValue("prime", sequenceValuePolicy.maximumPrimeIndex + 1), /supports n/);
});
