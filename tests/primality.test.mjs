import assert from "node:assert/strict";
import test from "node:test";
import BreakDecimal from "break_eternity.js";
import { analyzePrimality, analyzePrimeFactors, deserializeValue, digitCountAutomatically, evaluateAutomatically, evaluateWithAnalysis, formatAutomatically, formatDigitCountForInspector, formatForCopy, formatForHighPrecisionExport, formatPrimeFactors, inspectAutomatically, serializeValue } from "../src/engine.js";

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

test("preserves primality through the worker-safe value round trip", () => {
  const calculated = evaluateWithAnalysis("7");
  const restored = deserializeValue(serializeValue(calculated));
  assert.deepEqual(restored.primality, calculated.primality);
});

test("calculates and preserves bounded exact prime factors", () => {
  const calculated = evaluateWithAnalysis("-756");
  assert.equal(formatPrimeFactors(calculated.factorization), "−1 × 2² × 3³ × 7");
  assert.equal(calculated.factorization?.certainty, "verified");
  const restored = deserializeValue(serializeValue(calculated));
  assert.deepEqual(restored.factorization, calculated.factorization);
  assert.equal(inspectAutomatically(restored).facts?.[0]?.value, "−1 × 2² × 3³ × 7");
});

test("does not factor exact integers outside the safe trial-division frontier", () => {
  assert.equal(analyzePrimeFactors(evaluateAutomatically("10000000019")), null);
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

test("oversized exact powers preserve their structural form beyond the display envelope", () => {
  const formatted = formatAutomatically(evaluateAutomatically("10^100000"), { notation: "decimal", precision: 10000 });
  assert.equal(formatted.structuralPower, true);
  assert.equal(formatted.text, "10^100000");
});

test("clipboard formatting honors Decimal notation at full engine precision", () => {
  const value = evaluateAutomatically("(2005956546822746114^2 - 2)^2 - 2");
  const copied = formatForCopy(value, { base: 10, notation: "decimal" });
  assert.equal(copied, "16191462721115671781777559070120513664958590125499158514329308740975788034");
  const grouped = formatForCopy(value, { base: 10, notation: "decimal", groupDigits: true });
  assert.equal(grouped, "16,191,462,721,115,671,781,777,559,070,120,513,664,958,590,125,499,158,514,329,308,740,975,788,034");
});

test("display places do not change exact rational representation", () => {
  const value = evaluateAutomatically("1 / 7");
  const displayed = formatAutomatically(value, { base: 10, notation: "auto", precision: 2 });
  assert.equal(value.kind, "exact-rational");
  assert.equal(displayed.text, "0.14");
  assert.equal(inspectAutomatically(value).precision, "exact numerator and denominator");
});

test("Auto displays trusted exact integers in full regardless of fractional places", () => {
  const value = evaluateAutomatically("(2005956546822746114^2 - 2)^2 - 2");
  const displayed = formatAutomatically(value, { base: 10, notation: "auto", precision: 1 });
  assert.equal(displayed.text, "16191462721115671781777559070120513664958590125499158514329308740975788034");
  assert.equal(displayed.exactIntegerDisplay, true);
});

test("high-precision export formats all recomputed Decimal digits without changing defaults", () => {
  const value = evaluateAutomatically("1 / 7", new Map(), { calculationPrecision: 1500, forceDecimal: true });
  const exported = formatForHighPrecisionExport(value, { base: 10, maximumLength: 2000 });
  assert.equal(value.decimal.sd(), 1500);
  assert.equal(exported.length, 1502);
  assert.match(exported, /^0\.142857142857/);
  assert.equal(evaluateAutomatically("1 / 7").decimal.sd(), 1000);
});

test("Auto uses an expanded zero-place value while it remains compact", () => {
  const decimal = formatAutomatically(evaluateAutomatically("3103.8"), { base: 10, precision: 0, notation: "auto" });
  assert.equal(decimal.text, "3104");
  const scientific = formatAutomatically(evaluateAutomatically("3103.8"), { base: 10, precision: 0, notation: "scientific" });
  assert.equal(scientific.text, "3 × 10^3");
});

test("Auto expands compact rounded and fractional Decimal results", () => {
  const integer = formatAutomatically(evaluateAutomatically("4 * 6.0"), { base: 10, precision: 48, notation: "auto" });
  const fraction = formatAutomatically(evaluateAutomatically("1 / 7"), { base: 10, precision: 10, notation: "auto" });
  assert.equal(integer.text, "24");
  assert.equal(fraction.text, "0.1428571429");
});

test("Auto keeps untrusted oversized Decimal integers scientific", () => {
  const result = formatAutomatically(evaluateAutomatically("round(10^1000)"), { base: 10, precision: 48, notation: "auto" });
  assert.equal(result.exponent, "1000");
});

test("accepts relative history references alongside stable history IDs", () => {
  const restoredOne = deserializeValue(serializeValue(evaluateAutomatically("1")));
  const references = new Map([
    ["@history(19)", "5"], ["@history(4)", restoredOne],
    ["@history(-1)", "5"], ["@history(-2)", restoredOne],
  ]);
  assert.equal(evaluateAutomatically("@history(-1) + @history(-2)", references).decimal.toString(), "6");
  assert.equal(evaluateAutomatically("@history(19) + @history(4)", references).decimal.toString(), "6");
  assert.throws(() => evaluateAutomatically("@history(-3)", references), /unknown history reference/);
});

test("formats ordinary digit counts and exposes structural digit formulas", () => {
  const ordinary = digitCountAutomatically(evaluateAutomatically("10^3102"), 10);
  assert.equal(formatDigitCountForInspector(ordinary, { groupDigits: true }), "3,103");
  const structural = inspectAutomatically(evaluateAutomatically("10^100000"), { base: 10 });
  assert.equal(structural.facts.find((fact) => fact.id === "matching-base-digits").value, "100000 + 1");
});

test("evaluates the dynamic sequence position and extrema functions", () => {
  const references = new Map([["@n", "7"]]);
  assert.equal(evaluateAutomatically("@n^2", references).decimal.toString(), "49");
  assert.equal(evaluateAutomatically("min(8, @n, 12)", references).decimal.toString(), "7");
  assert.equal(evaluateAutomatically("max(8, @n, 12)", references).decimal.toString(), "12");
});
