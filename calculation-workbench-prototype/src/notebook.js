import { formatAutomatically, formatForHighPrecisionExport, inspectAutomatically, serializeValue } from "./engine.js";

export const notebookSchemaVersion = 1;

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
  const history = candidate.history.map((entry) => {
    if (!entry || !Number.isInteger(entry.id) || entry.id < 1 || ids.has(entry.id) || typeof entry.expression !== "string") throw new Error("A History entry is invalid");
    ids.add(entry.id);
    return { id: entry.id, expression: entry.expression };
  });
  const nextId = Number.isInteger(candidate.nextHistoryId) && candidate.nextHistoryId > 0
    ? Math.max(candidate.nextHistoryId, ...history.map((entry) => entry.id + 1), 1)
    : Math.max(...history.map((entry) => entry.id + 1), 1);
  const view = candidate.viewSettings && typeof candidate.viewSettings === "object" ? candidate.viewSettings : null;
  return { expression: candidate.activeExpression.expression, history, nextId, view };
}
