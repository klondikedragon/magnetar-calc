import assert from "node:assert/strict";
import test from "node:test";
import { deserializeValue, evaluateAutomatically, formatAutomatically, serializeValue } from "../src/engine.js";

test("keeps integer-safe arithmetic as an exact BigInt value", () => {
  const value = evaluateAutomatically("(2005956546822746114^2 - 2)^2 - 2");
  assert.equal(value.kind, "exact-integer");
  assert.equal(value.exactInteger, "16191462721115671781777559070120513664958590125499158514329308740975788034");
  assert.equal(formatAutomatically(value, { base: 10, notation: "auto", precision: 0 }).text, value.exactInteger);
});

test("normalizes exact rational arithmetic without introducing Decimal rounding", () => {
  const value = evaluateAutomatically("(1 / 6) + (1 / 3)");
  assert.equal(value.kind, "exact-rational");
  assert.equal(value.numerator, 1n);
  assert.equal(value.denominator, 2n);
  assert.equal(formatAutomatically(value, { base: 16, notation: "auto", precision: 12 }).text, "1/2");
});

test("preserves exact values through worker-safe serialization and history references", () => {
  const source = evaluateAutomatically("2^500");
  const serialized = serializeValue(source);
  assert.equal(typeof serialized.integer, "string");
  assert.equal("decimal" in serialized, false);
  const restored = deserializeValue(serialized);
  assert.equal(restored.integer, source.integer);
  const referenced = evaluateAutomatically("@history(-1) / 2^499", new Map([["@history(-1)", restored]]));
  assert.equal(referenced.kind, "exact-integer");
  assert.equal(referenced.exactInteger, "2");
});

test("uses Decimal.js only when an explicit approximation is requested", () => {
  const value = evaluateAutomatically("1 / 7", new Map(), { forceDecimal: true, calculationPrecision: 120 });
  assert.equal(value.kind, "decimal.js");
  assert.equal(value.decimal.sd(), 120);
});
