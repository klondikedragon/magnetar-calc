const defaultLimit = 240;

export function createHistoryQueueDiagnostics(limit = defaultLimit) {
  const events = [];
  return {
    record(event) {
      events.push({ at: performance.now(), ...event });
      if (events.length > limit) events.splice(0, events.length - limit);
    },
    snapshot() { return events.map((event) => ({ ...event })); },
    clear() { events.length = 0; },
  };
}
