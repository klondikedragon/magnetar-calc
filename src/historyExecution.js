import { evaluateWithAnalysis, serializeValue } from "./engine.js";

export function createHistoryWorkerRequest(batch, options = {}) {
  return {
    historyJobs: batch.jobs.map(({ entry, references }) => ({
      id: entry.id,
      revision: entry.revision,
      expression: entry.expression,
      ordinal: entry.ordinal,
      references,
      options,
    })),
    historyValues: batch.externalValues.map(([id, value]) => [id, serializeValue(value)]),
  };
}

export function evaluateHistoryJobs(jobs, initialValues = new Map()) {
  const values = new Map(initialValues);
  const results = [];
  for (const job of jobs) {
    try {
      const references = new Map(job.references.map((reference) => {
        if (reference.targetId === null) return [reference.token, String(job.ordinal)];
        if (!values.has(reference.targetId)) throw new Error(`@history(${reference.targetId}) did not complete`);
        return [reference.token, values.get(reference.targetId)];
      }));
      const value = evaluateWithAnalysis(job.expression, references, job.options ?? {});
      values.set(job.id, value);
      results.push({ id: job.id, revision: job.revision, type: "result", value });
    } catch (error) {
      results.push({ id: job.id, revision: job.revision, type: "error", message: error?.message ?? "Calculation failed" });
    }
  }
  return results;
}

export function mergeHistoryResults(history, results, revive = (value) => value, normalizeError = (message) => message) {
  const byKey = new Map(results.map((result) => [`${result.id}:${result.revision}`, result]));
  return history.map((entry) => {
    const result = byKey.get(`${entry.id}:${entry.revision}`);
    if (!result) return entry;
    return result.type === "result"
      ? { ...entry, state: "completed", value: revive(result.value), error: null }
      : { ...entry, state: "failed", value: null, error: normalizeError(result.message) };
  });
}
