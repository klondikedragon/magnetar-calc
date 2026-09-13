import test from "node:test";
import assert from "node:assert/strict";
import { resolveActionPointerType, shouldRestoreEditorFocus } from "../src/interactionModality.js";

test("mouse and keyboard actions restore expression focus", () => {
  assert.equal(shouldRestoreEditorFocus("mouse"), true);
  assert.equal(shouldRestoreEditorFocus(""), true);
  assert.equal(shouldRestoreEditorFocus(undefined), true);
});

test("touch and pen palette actions preserve an unfocused editor", () => {
  assert.equal(shouldRestoreEditorFocus("touch"), false);
  assert.equal(shouldRestoreEditorFocus("pen"), false);
});

test("pointer-down modality wins over a synthetic mouse click", () => {
  const pointerType = resolveActionPointerType("touch", "mouse");
  assert.equal(pointerType, "touch");
  assert.equal(shouldRestoreEditorFocus(pointerType), false);
});
