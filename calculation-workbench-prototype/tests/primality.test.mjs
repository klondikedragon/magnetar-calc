import assert from "node:assert/strict";
import test from "node:test";
import { analyzePrimality, evaluateAutomatically } from "../src/engine.js";

test("verifies prime and composite exact integers within the deterministic range", () => {
  const prime = analyzePrimality(evaluateAutomatically("97"));
  const composite = analyzePrimality(evaluateAutomatically("221"));
  assert.deepEqual(prime?.kind, "prime");
  assert.deepEqual(prime?.certainty, "verified");
  assert.deepEqual(composite?.kind, "composite");
  assert.deepEqual(composite?.certainty, "verified");
});

test("uses a qualified result above the deterministic range", () => {
  const mersenne127 = analyzePrimality(evaluateAutomatically("2^127-1"));
  assert.deepEqual(mersenne127?.kind, "prime");
  assert.deepEqual(mersenne127?.certainty, "probable");
});

test("does not classify Decimal results lacking an independent integer reconstruction", () => {
  assert.equal(evaluateAutomatically("sqrt(4)").exactInteger, undefined);
  assert.equal(analyzePrimality(evaluateAutomatically("sqrt(4)")), null);
});
