import { appendHistoryEntries, rebuildHistoryLedger } from "./historyLedger.js";

function hydrateSeed(seed) {
  return {
    workspace: seed,
    history: appendHistoryEntries([], seed.history.slice().reverse()),
    memory: null,
    recovered: false,
  };
}

export function prepareWorkspaceHydration(stored, seed, deserializeValue) {
  if (!stored) return hydrateSeed(seed);
  try {
    const history = rebuildHistoryLedger((stored.history ?? []).map((item) => {
      const value = deserializeValue(item.value);
      if (!value) throw new Error(`History item ${item.id ?? "?"} has no stored value`);
      return { ...item, value, state: "completed" };
    }));
    const memory = stored.memory ? { ...stored.memory, value: deserializeValue(stored.memory.value) } : null;
    if (stored.memory && !memory.value) throw new Error("Memory has no stored value");
    return { workspace: stored, history, memory, recovered: false };
  } catch (error) {
    return { ...hydrateSeed(seed), recovered: true, error };
  }
}
