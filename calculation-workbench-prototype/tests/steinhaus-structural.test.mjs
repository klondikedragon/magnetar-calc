import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically, inspectAutomatically, deserializeValue, serializeValue } from "../src/engine.js";

test("retains larger Steinhaus triangles as direct exact powers", () => {
  const value = evaluateAutomatically("sm_triangle(301)");
  assert.equal(value.kind, "structural-power");
  assert.equal(value.canonical, "301^301");
  assert.equal(value.reduction.derivation, "△301 = 301^301");
  const facts = inspectAutomatically(value).facts;
  assert.equal(facts[0].id, "steinhaus-reduction");
  assert.ok(facts.some((fact) => fact.id === "decimal-digit-estimate"));
});

test("reduces the finite square-of-three construction without digit expansion", () => {
  const value = evaluateAutomatically("sm_square(3)");
  assert.equal(value.kind, "structural-power");
  assert.equal(value.reduction.notation, "□3");
  assert.equal(value.canonical, "3^35917545547686059365808220080151141317043");
  const facts = inspectAutomatically(value).facts;
  assert.match(facts[0].value, /\(27\^27\)\^\(27\^27\)/);
  assert.ok(facts.some((fact) => fact.id === "decimal-digit-estimate"));
});

test("persists a Steinhaus reduction and its provenance context", () => {
  const original = evaluateAutomatically("sm_square(3)");
  const restored = deserializeValue(serializeValue(original));
  assert.equal(restored.canonical, original.canonical);
  assert.deepEqual(restored.reduction, original.reduction);
});
