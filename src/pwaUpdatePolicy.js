export const pwaUpdateCheckIntervalMs = 16 * 60 * 60 * 1_000;
export const pwaUpdateIdleDelayMs = 1_500;

export function canActivatePwaUpdate({
  modalOpen,
  calculationStatus,
  pendingHistoryCount,
  exportActive,
  notebookOperationActive,
}) {
  return !modalOpen
    && !["debouncing", "computing"].includes(calculationStatus)
    && pendingHistoryCount === 0
    && !exportActive
    && !notebookOperationActive;
}

export function pwaUpdateIdleDelay(lastInteractionAt, now = Date.now()) {
  return Math.max(0, pwaUpdateIdleDelayMs - Math.max(0, now - lastInteractionAt));
}

// Update timing is deliberately kept outside React. Pointer and keyboard
// activity can be much more frequent than application state changes, and must
// never make an unchanged calculator result render again.
export function createPwaUpdateCoordinator({
  canActivate,
  flush,
  activate,
  now = Date.now,
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer),
}) {
  let updateAvailable = false;
  let activating = false;
  let disposed = false;
  let timer = null;
  let lastInteractionAt = now();

  const clearPendingTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const arm = () => {
    clearPendingTimer();
    if (disposed || !updateAvailable || activating || !canActivate()) return;
    timer = setTimer(() => {
      timer = null;
      if (disposed || !updateAvailable || activating) return;
      if (!canActivate()) return;
      activating = true;
      try {
        flush();
        Promise.resolve(activate()).catch(() => {
          // A failed activation must not permanently lock the coordinator.
          // Apply a fresh quiet period before retrying to avoid a tight loop.
          activating = false;
          lastInteractionAt = now();
          arm();
        });
      } catch {
        activating = false;
        lastInteractionAt = now();
        arm();
      }
    }, pwaUpdateIdleDelay(lastInteractionAt, now()));
  };

  return Object.freeze({
    noteInteraction() {
      if (disposed) return;
      lastInteractionAt = now();
      if (updateAvailable) arm();
    },
    setUpdateAvailable(available = true) {
      if (disposed) return;
      updateAvailable = Boolean(available);
      if (!updateAvailable) activating = false;
      arm();
    },
    reconsider() {
      if (!disposed) arm();
    },
    dispose() {
      disposed = true;
      clearPendingTimer();
    },
    snapshot() {
      return Object.freeze({ updateAvailable, activating, timerPending: timer !== null, lastInteractionAt });
    },
  });
}
