import { deserializeValue, evaluateWithAnalysis, serializeValue } from "./engine";
import { evaluateHistoryJobs } from "./historyExecution";

function evaluateJob({ expression, references = [], options = {} }) {
  const restoredReferences = new Map(references.map(([token, value]) => [token, value?.kind === "number" ? String(value.number) : deserializeValue(value)]));
  return serializeValue(evaluateWithAnalysis(expression, restoredReferences, options));
}

self.onmessage = ({ data }) => {
  const { jobId, expression, references = [], options = {}, historyJobs, historyValues = [] } = data;
  if (Array.isArray(historyJobs)) {
    const initialValues = new Map(historyValues.map(([id, value]) => [id, deserializeValue(value)]));
    const results = evaluateHistoryJobs(historyJobs, initialValues).map((result) => result.type === "result"
      ? { ...result, value: serializeValue(result.value) }
      : result);
    self.postMessage({ type: "batch-result", jobId, results });
    return;
  }
  try {
    // The result is only published once all synchronous analysis that belongs to
    // it is complete, avoiding a visible unclassified intermediate value.
    self.postMessage({ type: "result", jobId, value: evaluateJob({ expression, references, options }) });
  } catch (error) {
    self.postMessage({ type: "error", jobId, message: error?.message ?? "Calculation failed" });
  }
};
