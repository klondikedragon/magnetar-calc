import assert from "node:assert/strict";
import test from "node:test";
import { deserializeValue, evaluateAutomatically, inspectAutomatically, serializeValue } from "../src/engine.js";

test("records a bounded precision plan for Decimal approximations", () => {
  const value = evaluateAutomatically("pi + 1", new Map(), { calculationPrecision: 100, targetPrecision: 60 });
  assert.equal(value.kind, "decimal.js");
  assert.deepEqual(value.quality, {
    certainty: "rounded",
    representation: "decimal",
    targetDigits: 60,
    guardDigits: 20,
    workingDigits: 80,
    retainedDigits: 80,
  });
  assert.equal(inspectAutomatically(value).precision, "80 working digits; 60 target");
});

test("preserves numerical provenance through serialization", () => {
  const value = evaluateAutomatically("sqrt(2)", new Map(), { calculationPrecision: 90 });
  const restored = deserializeValue(serializeValue(value));
  assert.deepEqual(restored.quality, value.quality);
  assert.equal(restored.calculationPrecision, value.calculationPrecision);
});

test("labels the wide-range backend as an estimate rather than an exact value", () => {
  const value = evaluateAutomatically("5↑↑5");
  assert.equal(value.kind, "break-eternity");
  assert.equal(value.quality.certainty, "magnitude-only");
  assert.equal(inspectAutomatically(value).exactness, "magnitude-only approximation");
});
