const defaultDelayMs = 1_000;
const defaultMaximumDelayMs = 5_000;

// Keep serialization out of the render path. Callers provide a factory so the
// latest snapshot is assembled only when this controller actually flushes.
export function createCoalescedPersistence({ write, onError = () => {}, delayMs = defaultDelayMs, maximumDelayMs = defaultMaximumDelayMs, timers = globalThis }) {
  let delayedFlush = null;
  let maximumFlush = null;
  let latestSnapshot = null;

  function clearTimers() {
    if (delayedFlush !== null) timers.clearTimeout(delayedFlush);
    if (maximumFlush !== null) timers.clearTimeout(maximumFlush);
    delayedFlush = null;
    maximumFlush = null;
  }

  function flush() {
    clearTimers();
    if (!latestSnapshot) return false;
    const snapshot = latestSnapshot;
    latestSnapshot = null;
    try {
      write(snapshot());
      return true;
    } catch (error) {
      onError(error);
      return false;
    }
  }

  return {
    schedule(snapshot) {
      latestSnapshot = snapshot;
      if (delayedFlush !== null) timers.clearTimeout(delayedFlush);
      delayedFlush = timers.setTimeout(flush, delayMs);
      if (maximumFlush === null) maximumFlush = timers.setTimeout(flush, maximumDelayMs);
    },
    flush,
    cancel() {
      clearTimers();
      latestSnapshot = null;
    },
  };
}
