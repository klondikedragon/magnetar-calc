export function shouldRestoreEditorFocus(pointerType) {
  return pointerType !== "touch" && pointerType !== "pen";
}
