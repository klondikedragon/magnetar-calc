import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically, inspectAutomatically } from "../src/engine.js";
import { exampleCatalog, filterExampleCatalog, parseExampleSearch, publishedExamples, validatePublishedExamples } from "../src/exampleCatalog.js";
import { validateNotebook } from "../src/notebook.js";

test("published examples have stable identities, references, valid notebooks, and fixtures", () => {
  assert.equal(validatePublishedExamples(), true);
  assert.equal(new Set(exampleCatalog.map((entry) => entry.id)).size, exampleCatalog.length);
  assert.deepEqual(publishedExamples.map((entry) => entry.id), ["history.fibonacci-continuation", "magnitude.power-tower-25", "sequences.yellowstone-permutation", "sequences.lucas-companion", "sequences.pell-silver-ratio", "sequences.tribonacci", "sequences.padovan-plastic"]);
});

test("Yellowstone fixture uses the next History position and has the OEIS prefix", () => {
  const example = exampleCatalog.find((entry) => entry.id === "sequences.yellowstone-permutation");
  assert.equal(example.notebook.activeExpression.expression, "yellowstone(@n)");
  const expected = [1, 2, 3, 4, 9, 8, 15, 14, 5, 6, 25, 12];
  const notebook = validateNotebook(example.notebook);
  const actual = [...notebook.history].reverse().slice(0, 12).map((entry, index) => evaluateAutomatically(entry.expression, new Map([["@n", String(index + 1)]])).decimal.toNumber());
  assert.deepEqual(actual, expected);
});

test("recurrence examples declare 100-term source-backed histories and reusable rules", () => {
  const expected = new Map([
    ["sequences.lucas-companion", ["2", "1", "@history(-1) + @history(-2)"]],
    ["sequences.pell-silver-ratio", ["0", "1", "2 @history(-1) + @history(-2)"]],
    ["sequences.tribonacci", ["0", "0", "1", "@history(-1) + @history(-2) + @history(-3)"]],
    ["sequences.padovan-plastic", ["1", "1", "1", "@history(-2) + @history(-3)"]],
  ]);
  for (const [id, values] of expected) {
    const example = exampleCatalog.find((entry) => entry.id === id);
    const notebook = validateNotebook(example.notebook);
    const chronological = [...notebook.history].reverse();
    assert.equal(chronological.length, 100);
    assert.deepEqual(chronological.slice(0, values.length - 1).map((entry) => entry.expression), values.slice(0, -1));
    assert.ok(chronological.slice(values.length - 1).every((entry) => entry.expression === values.at(-1)));
    assert.equal(notebook.expression, values.at(-1));
  }
});

test("recurrence examples produce their independently documented prefixes", () => {
  const cases = [
    ["sequences.lucas-companion", [2, 1, 3, 4, 7, 11]],
    ["sequences.pell-silver-ratio", [0, 1, 2, 5, 12, 29]],
    ["sequences.tribonacci", [0, 0, 1, 1, 2, 4]],
    ["sequences.padovan-plastic", [1, 1, 1, 2, 2, 3]],
  ];
  for (const [id, expected] of cases) {
    const notebook = validateNotebook(exampleCatalog.find((entry) => entry.id === id).notebook);
    const history = [...notebook.history].reverse();
    const seedCount = id === "sequences.tribonacci" || id === "sequences.padovan-plastic" ? 3 : 2;
    const values = history.slice(0, seedCount).map((entry) => evaluateAutomatically(entry.expression).decimal.toNumber());
    while (values.length < expected.length) {
      const references = new Map(values.map((value, index) => [`@history(-${values.length - index})`, String(value)]));
      values.push(evaluateAutomatically(notebook.expression, references).decimal.toNumber());
    }
    assert.deepEqual(values, expected);
  }
});

test("catalog categories use mathematical names and primary videos are searchable", () => {
  assert.equal(exampleCatalog.find((entry) => entry.id === "history.fibonacci-continuation").category, "Sequences");
  assert.equal(exampleCatalog.find((entry) => entry.id === "magnitude.power-tower-25").category, "Magnitude & growth");
  const yellowstone = exampleCatalog.find((entry) => entry.id === "sequences.yellowstone-permutation");
  assert.equal(yellowstone.video.title, "The Yellowstone Permutation — Numberphile");
  assert.ok(filterExampleCatalog("yellowstone permutation numberphile").includes(yellowstone));
});

test("example search includes keywords and reference URLs but excludes drafts", () => {
  assert.deepEqual(parseExampleSearch('fibonacci "relative history"'), ["fibonacci", "relative history"]);
  assert.deepEqual(filterExampleCatalog("oeis").map((entry) => entry.id), ["history.fibonacci-continuation", "sequences.yellowstone-permutation", "sequences.lucas-companion", "sequences.pell-silver-ratio", "sequences.tribonacci", "sequences.padovan-plastic"]);
  assert.equal(filterExampleCatalog("basement").length, 0);
});

test("power-tower example preserves structure while deriving the vetted digit estimate", () => {
  const seed = evaluateAutomatically("25^25^3");
  const value = evaluateAutomatically("25^@history(-1)", new Map([["@history(-1)", seed]]));
  const facts = inspectAutomatically(value, { base: 10 }).facts ?? [];
  assert.equal(value.kind, "structural-power");
  assert.equal(facts.find((fact) => fact.id === "decimal-digit-estimate")?.value, "≈ 9.0807984 × 10^21842");
});
