import assert from "node:assert/strict";
import test from "node:test";
import { createValuePresentationCache } from "../src/presentationCache.js";

test("reuses a presentation for an unchanged value object", () => {
  let derivations = 0;
  const cache = createValuePresentationCache((value) => {
    derivations += 1;
    return { text: value.text.toUpperCase() };
  });
  const value = { text: "unchanged" };
  assert.equal(cache(value).text, "UNCHANGED");
  assert.equal(cache(value).text, "UNCHANGED");
  assert.equal(derivations, 1);
});

test("derives a presentation for each distinct value object", () => {
  let derivations = 0;
  const cache = createValuePresentationCache((value) => {
    derivations += 1;
    return value.text;
  });
  assert.equal(cache({ text: "same content" }), "same content");
  assert.equal(cache({ text: "same content" }), "same content");
  assert.equal(derivations, 2);
});
