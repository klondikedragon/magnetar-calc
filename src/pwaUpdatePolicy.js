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
