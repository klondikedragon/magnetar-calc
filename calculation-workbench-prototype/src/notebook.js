import { formatAutomatically, formatForHighPrecisionExport, inspectAutomatically, serializeValue } from "./engine.js";

export const notebookSchemaVersion = 1;
export const maximumNotebookHistoryEntries = 10_000;

function exportedAnswer(value, formatOptions, highPrecision = false) {
  const inspection = inspectAutomatically(value, formatOptions);
  return {
    engine: {
      id: value.engineId ?? value.kind,
      label: value.engineLabel ?? inspection.engine ?? "Unknown engine",
      representation: inspection.representation,
      precision: inspection.precision,
      exactness: inspection.exactness,
      value: serializeValue(value),
    },
    renderedAnswer: highPrecision
      ? formatForHighPrecisionExport(value, formatOptions)
      : formatAutomatically(value, formatOptions).text,
  };
}

export function createNotebook({ expression, previewValue, includeActiveAnswer, history, nextId, view, includeView, includeAnswers, highPrecision = false }) {
  const formatOptions = { base: view.base, precision: view.precision, notation: view.notation, groupDigits: view.groupDigits };
  const entry = (item) => ({
    id: item.id,
    expression: item.expression,
    ...(includeAnswers ? { output: exportedAnswer(item.value, formatOptions, highPrecision) } : {}),
  });
  return {
    schemaVersion: notebookSchemaVersion,
    activeExpression: {
      expression,
      ...(includeAnswers && includeActiveAnswer && previewValue ? { output: exportedAnswer(previewValue, formatOptions, highPrecision) } : {}),
    },
    history: history.map(entry),
    nextHistoryId: nextId,
    ...(includeView ? { viewSettings: { ...view } } : {}),
  };
}

export function validateNotebook(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("This is not a calculation notebook");
  if (candidate.schemaVersion !== notebookSchemaVersion) throw new Error("This notebook uses an unsupported schema version");
  if (!candidate.activeExpression || typeof candidate.activeExpression.expression !== "string") throw new Error("The notebook has no active expression");
  if (!Array.isArray(candidate.history)) throw new Error("The notebook has no History array");
  const ids = new Set();
  const history = [];
  const addEntry = (id, expression) => {
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id) || typeof expression !== "string") throw new Error("A History entry is invalid");
    ids.add(id);
    history.push({ id, expression });
  };
  for (const entry of candidate.history) {
    if (entry?.repeat) {
      const repeat = entry.repeat;
      if (!repeat || typeof repeat !== "object" || Array.isArray(repeat)
        || typeof repeat.expression !== "string" || !Number.isSafeInteger(repeat.count)
        || repeat.count < 1 || !Number.isSafeInteger(repeat.startId) || repeat.startId < 1
        || repeat.startId + repeat.count - 1 > Number.MAX_SAFE_INTEGER
        || history.length + repeat.count > maximumNotebookHistoryEntries) {
        throw new Error("A History repeat entry is invalid");
      }
      // Notebook History is newest-first. A repeat's startId is the first
      // minted ID, so expand its newest member first without changing the
      // regular History representation seen by dependency analysis.
      for (let offset = repeat.count - 1; offset >= 0; offset -= 1) addEntry(repeat.startId + offset, repeat.expression);
      continue;
    }
    if (history.length >= maximumNotebookHistoryEntries) throw new Error("History exceeds the 10,000-entry notebook limit");
    addEntry(entry?.id, entry?.expression);
  }
  const firstUnusedId = Math.max(...history.map((entry) => entry.id + 1), 1);
  // An imported counter may be stale or malformed. Only a safe, unused positive
  // integer can be retained; otherwise continue immediately after the maximum ID.
  const nextId = Number.isSafeInteger(candidate.nextHistoryId) && candidate.nextHistoryId >= firstUnusedId
    ? candidate.nextHistoryId
    : firstUnusedId;
  const view = candidate.viewSettings && typeof candidate.viewSettings === "object" ? candidate.viewSettings : null;
  return { expression: candidate.activeExpression.expression, history, nextId, view };
}
