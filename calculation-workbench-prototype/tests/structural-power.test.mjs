import assert from "node:assert/strict";
import test from "node:test";
import {
  deserializeValue,
  evaluateAutomatically,
  inspectAutomatically,
  serializeValue,
} from "../src/engine.js";

test("preserves a nested power beyond the exact expansion boundary", () => {
  const value = evaluateAutomatically("2^(2^(2^63))");
  assert.equal(value.kind, "structural-power");
  assert.equal(value.canonical, "2^(2^9223372036854775808)");
  assert.equal(value.quality.certainty, "symbolic-exact");
  assert.equal(value.engineId, "structural-power");
});

test("uses semantic power preservation before a wide-range approximation", () => {
  const value = evaluateAutomatically("12^23^13");
  assert.equal(value.kind, "structural-power");
  assert.equal(value.canonical, "12^504036361936467383");
});

test("derives exact base-matching digits and qualified magnitude facts", () => {
  const value = evaluateAutomatically("2^(2^(2^63))");
  const inspection = inspectAutomatically(value, { base: 2 });
  const binaryDigits = inspection.facts.find((fact) => fact.id === "matching-base-digits");
  const estimate = inspection.facts.find((fact) => fact.id === "decimal-digit-estimate");
  const magnitude = inspection.facts.find((fact) => fact.id === "decimal-digit-interval");
  assert.equal(binaryDigits.value, "2^9223372036854775808 + 1");
  assert.equal(binaryDigits.certainty, "derived exact");
  assert.match(estimate.value, /^≈ 10\^\(2\.7765116 × 10\^18\)$/);
  assert.equal(estimate.certainty, "estimate");
  assert.match(magnitude.value, /^\[10\^\(2\.7765116 × 10\^18\), 10\^\(2\.7765118 × 10\^18\)\]$/);
  assert.equal(magnitude.certainty, "finite-precision interval");
  assert.ok(inspection.provenance.every((claim) => claim.sources.every((source) => source.url.startsWith("https://"))));
});

test("pairs a structural digit formula with a qualified decimal interval", () => {
  const value = evaluateAutomatically("25^88817841970012523233890533447265625");
  const inspection = inspectAutomatically(value, { base: 10 });
  const formula = inspection.facts.find((fact) => fact.id === "base-digit-formula");
  const estimate = inspection.facts.find((fact) => fact.id === "decimal-digit-estimate");
  const interval = inspection.facts.find((fact) => fact.id === "decimal-digit-interval");
  assert.match(formula.value, /^floor\(\(88817841970012523233890533447265625\) × log_10\(25\)\) \+ 1$/);
  assert.equal(formula.certainty, "derived exact formula");
  assert.match(estimate.value, /^≈ 1\.241/);
  assert.equal(estimate.certainty, "estimate");
  assert.match(interval.value, /^\[1\.241/);
  assert.equal(interval.certainty, "finite-precision interval");
  assert.equal(interval.ruleId, "magnitude.decimal-digit-interval");
});

test("round-trips structural powers through persisted History values", () => {
  const source = evaluateAutomatically("2^(2^(2^63))");
  const restored = deserializeValue(serializeValue(source));
  assert.equal(restored.canonical, source.canonical);
  const next = evaluateAutomatically("2^@history(-1)", new Map([["@history(-1)", restored]]));
  assert.equal(next.kind, "structural-power");
  assert.equal(next.canonical, "2^(2^(2^9223372036854775808))");
});
