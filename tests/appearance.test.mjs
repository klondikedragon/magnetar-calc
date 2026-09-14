import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAppearancePreference, resolveAppearance } from "../src/appearance.js";
import { normalizePaletteMode, paletteModes } from "../src/paletteModes.js";

test("appearance defaults to the system and resolves its current scheme", () => {
  assert.equal(normalizeAppearancePreference("unexpected"), "system");
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("system", true), "dark");
  assert.equal(resolveAppearance("light", true), "light");
});

test("legacy general-purpose palettes migrate to Scientific", () => {
  for (const legacy of ["Calculator", "Scientific", "Trigonometry"]) {
    assert.equal(normalizePaletteMode(legacy), "Scientific");
  }
  assert.deepEqual(paletteModes, ["Scientific", "Number theory", "Sequences", "Ordinal / hierarchy", "Programmer"]);
});
