import { useEffect } from "react";

/** Close a transient popover consistently on an outside press or Escape. */
export function useDismissiblePopover(open, onDismiss, containerRef, triggerRef) {
  useEffect(() => {
    if (!open) return undefined;
    const dismissOutside = (event) => {
      const target = event.target;
      if (containerRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onDismiss();
    };
    const dismissEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("keydown", dismissEscape);
    };
  }, [open, onDismiss, containerRef, triggerRef]);
}
