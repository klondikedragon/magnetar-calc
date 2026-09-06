import assert from "node:assert/strict";
import test from "node:test";
import {
  deserializeValue,
  digitCountAutomatically,
  evaluateAutomatically,
  formatAutomatically,
  inspectAutomatically,
  serializeValue,
} from "../src/engine.js";

test("keeps a manageable large integer power fully exact", () => {
  const value = evaluateAutomatically("6^46656");
  assert.equal(value.kind, "exact-integer");
  assert.equal(value.exactInteger.length, 36_306);
  const formatted = formatAutomatically(value, { base: 10, notation: "auto", precision: 48 });
  assert.equal(formatted.exponent, "36305");
  assert.match(formatted.significand, /…$/);
  assert.equal(formatted.full.length, 36_306);
});

test("represents a base-ten power beyond Decimal.js as an exact scale", () => {
  const value = evaluateAutomatically("10^(10^100)");
  const scale = (10n ** 100n).toString();
  assert.equal(value.kind, "extended-scale");
  assert.equal(value.scale.toString(), scale);
  assert.equal(value.significand.toString(), "1");
  assert.equal(value.quality.certainty, "exact");
  const formatted = formatAutomatically(value, { base: 16, notation: "auto", precision: 20 });
  assert.equal(formatted.radix, 10);
  assert.equal(formatted.exponent, scale);
  const inspection = inspectAutomatically(value, { base: 10 });
  assert.equal(inspection.exactness, "exact scientific scale");
  assert.equal(inspection.facts.find((fact) => fact.id === "extended-scale-digits").value, (10n ** 100n + 1n).toString());
});

test("uses the retained-precision window for addition at distant scales", () => {
  const value = evaluateAutomatically("10^(10^100) + 1");
  assert.equal(value.kind, "extended-scale");
  assert.equal(value.quality.certainty, "rounded");
  assert.equal(value.discardedAddend, "0");
  const inspection = inspectAutomatically(value, { base: 10 });
  assert.equal(inspection.facts.find((fact) => fact.id === "extended-scale-discarded-addend").certainty, "rounded");
});

test("combines an exact ordinary integer with an extended scale", () => {
  const value = evaluateAutomatically("2 * 10^(10^100)");
  assert.equal(value.kind, "extended-scale");
  assert.equal(value.significand.toString(), "2");
  assert.equal(value.scale.toString(), (10n ** 100n).toString());
});

test("round-trips extended scales through worker-safe serialization", () => {
  const value = evaluateAutomatically("10^(10^100)");
  const restored = deserializeValue(serializeValue(value));
  assert.equal(restored.kind, "extended-scale");
  assert.equal(restored.scale.toString(), value.scale.toString());
  assert.equal(restored.significand.toString(), "1");
  assert.equal(digitCountAutomatically(restored, 10).certainty, "exact");
});

test("keeps a non-base-ten giant power structural until logarithmic scale support exists", () => {
  const value = evaluateAutomatically("6^(10^100)");
  assert.equal(value.kind, "structural-power");
  assert.equal(value.canonical, `6^${(10n ** 100n).toString()}`);
});
