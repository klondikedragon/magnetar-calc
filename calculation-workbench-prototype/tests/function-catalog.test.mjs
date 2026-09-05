import assert from "node:assert/strict";
import test from "node:test";
import { filterFunctionCatalog, functionCatalog, functionInsertion, parseFunctionSearch } from "../src/functionCatalog.js";

test("function catalog ids remain unique and stable", () => {
  const ids = functionCatalog.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("sequence-fibonacci"));
  assert.ok(ids.includes("hyperoperation-knuth-double"));
});

test("function search requires every plain or quoted term", () => {
  assert.deepEqual(parseFunctionSearch('fibonacci "golden ratio"'), ["fibonacci", "golden ratio"]);
  assert.deepEqual(filterFunctionCatalog('fibonacci "golden ratio"').map((entry) => entry.id), ["constant-phi", "sequence-fibonacci"]);
  assert.deepEqual(filterFunctionCatalog("wainer", "Fast-growing hierarchy").map((entry) => entry.id), ["hierarchy-fgh1", "hierarchy-fgh2", "hierarchy-fgh3"]);
  assert.equal(filterFunctionCatalog("numberphile").filter((entry) => entry.category === "Steinhaus–Moser").length, 10);
  assert.equal(filterFunctionCatalog("youtube").filter((entry) => entry.category === "Steinhaus–Moser").length, 10);
});

test("catalog insertion wraps a selected expression and places the caret", () => {
  const sine = functionCatalog.find((entry) => entry.id === "trigonometry-sin");
  const min = functionCatalog.find((entry) => entry.id === "arithmetic-min");
  assert.deepEqual(functionInsertion(sine, "a + b"), { text: "sin(a + b)", caret: 9 });
  assert.deepEqual(functionInsertion(min, "x"), { text: "min(x, )", caret: 7 });
});
