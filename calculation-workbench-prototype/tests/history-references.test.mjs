import assert from "node:assert/strict";
import test from "node:test";
import { historyReferenceEntries } from "../src/historyReferences.js";

const history = [
  { id: 3, value: "three" },
  { id: 2, value: "two" },
  { id: 1, value: "one" },
];

test("supplies only the History references required by an active expression", () => {
  assert.deepEqual(
    historyReferenceEntries(history, { expression: "@history(-2) + @history(1)", ordinal: 4 }),
    [["@history(-2)", "two"], ["@history(1)", "one"]],
  );
});

test("supplies a dynamic position without serializing unrelated History values", () => {
  assert.deepEqual(historyReferenceEntries(history, { expression: "yellowstone(@n)", ordinal: 27 }), [["@n", "27"]]);
});

test("keeps the complete reference map for History recomputation", () => {
  assert.equal(historyReferenceEntries(history).length, 7);
});
