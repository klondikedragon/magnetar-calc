import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically, inspectAutomatically } from "../src/engine.js";
import { exampleCatalog, filterExampleCatalog, parseExampleSearch, publishedExamples, validatePublishedExamples } from "../src/exampleCatalog.js";

test("published examples have stable identities, references, valid notebooks, and fixtures", () => {
  assert.equal(validatePublishedExamples(), true);
  assert.equal(new Set(exampleCatalog.map((entry) => entry.id)).size, exampleCatalog.length);
  assert.deepEqual(publishedExamples.map((entry) => entry.id), ["history.fibonacci-continuation", "magnitude.power-tower-25"]);
});

test("example search includes keywords and reference URLs but excludes drafts", () => {
  assert.deepEqual(parseExampleSearch('fibonacci "relative history"'), ["fibonacci", "relative history"]);
  assert.deepEqual(filterExampleCatalog("oeis").map((entry) => entry.id), ["history.fibonacci-continuation"]);
  assert.equal(filterExampleCatalog("basement").length, 0);
});

test("power-tower example preserves structure while deriving the vetted digit estimate", () => {
  const seed = evaluateAutomatically("25^25^3");
  const value = evaluateAutomatically("25^@history(-1)", new Map([["@history(-1)", seed]]));
  const facts = inspectAutomatically(value, { base: 10 }).facts ?? [];
  assert.equal(value.kind, "structural-power");
  assert.equal(facts.find((fact) => fact.id === "decimal-digit-estimate")?.value, "≈ 9.0807984 × 10^21842");
});
