import assert from "node:assert/strict";
import test from "node:test";
import BreakDecimal from "break_eternity.js";
import { analyzePrimality, evaluateAutomatically, evaluateWithAnalysis, formatAutomatically } from "../src/engine.js";

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

test("publishes a calculated exact integer with its classification", () => {
  const value = evaluateWithAnalysis("97");
  assert.equal(value.primality?.kind, "prime");
  assert.equal(value.primality?.certainty, "verified");
});

test("does not classify Decimal results lacking an independent integer reconstruction", () => {
  assert.equal(evaluateAutomatically("sqrt(4)").exactInteger, undefined);
  assert.equal(analyzePrimality(evaluateAutomatically("sqrt(4)")), null);
});

test("uses compact notation without expanding a giant BreakEternity layer", () => {
  const decimal = new BreakDecimal().fromComponents(1, 1_000_000_000, 2);
  const formatted = formatAutomatically({ kind: "break-eternity", decimal, full: "synthetic large layer" });
  assert.equal(formatted.tower, true);
  assert.match(formatted.significand, /^10⟦\d+⟧\d+/);
});

test("rejects tetration heights beyond the evaluator safety budget", () => {
  assert.throws(() => evaluateAutomatically("3↑↑3↑↑3"), /tetration height exceeds the current safety budget/);
});

test("decimal notation keeps an eligible large Decimal value expanded", () => {
  const formatted = formatAutomatically(evaluateAutomatically("10^999"), { notation: "decimal", precision: 1000 });
  assert.equal(formatted.exponent, "");
  assert.equal(formatted.significand.length, 1000);
});

test("decimal notation falls back to scientific form beyond the display envelope", () => {
  const formatted = formatAutomatically(evaluateAutomatically("10^1000"), { notation: "decimal", precision: 1000 });
  assert.equal(formatted.exponent, "1000");
});
