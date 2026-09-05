import assert from "node:assert/strict";
import test from "node:test";
import BreakDecimal from "break_eternity.js";
import { analyzePrimality, deserializeValue, evaluateAutomatically, evaluateWithAnalysis, formatAutomatically, formatForCopy, formatForHighPrecisionExport, inspectAutomatically, serializeValue } from "../src/engine.js";

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
  const formatted = formatAutomatically(evaluateAutomatically("10^10000"), { notation: "decimal", precision: 10000 });
  assert.equal(formatted.exponent, "10000");
});

test("clipboard formatting honors Decimal notation at full engine precision", () => {
  const value = evaluateAutomatically("(2005956546822746114^2 - 2)^2 - 2");
  const copied = formatForCopy(value, { base: 10, notation: "decimal" });
  assert.equal(copied, "16191462721115671781777559070120513664958590125499158514329308740975788034");
  const grouped = formatForCopy(value, { base: 10, notation: "decimal", groupDigits: true });
  assert.equal(grouped, "16,191,462,721,115,671,781,777,559,070,120,513,664,958,590,125,499,158,514,329,308,740,975,788,034");
});

test("display places do not change Decimal engine precision", () => {
  const value = evaluateAutomatically("1 / 7");
  const displayed = formatAutomatically(value, { base: 10, notation: "auto", precision: 2 });
  assert.equal(value.decimal.sd(), 1000);
  assert.equal(displayed.text, "1.43 × 10^-1");
  assert.equal(inspectAutomatically(value).precision, "1,000 significant digits internal");
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

test("zero display places uses a zero-place scientific coefficient for non-integers", () => {
  const decimal = formatAutomatically(evaluateAutomatically("3103.8"), { base: 10, precision: 0, notation: "auto" });
  assert.equal(decimal.text, "3 × 10^3");
  const scientific = formatAutomatically(evaluateAutomatically("3103.8"), { base: 10, precision: 0, notation: "scientific" });
  assert.equal(scientific.text, "3 × 10^3");
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
