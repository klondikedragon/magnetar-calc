export function shouldRestoreEditorFocus(pointerType) {
  return pointerType !== "touch" && pointerType !== "pen";
}

export function resolveActionPointerType(pointerDownType, clickType) {
  return pointerDownType || clickType || "";
}
