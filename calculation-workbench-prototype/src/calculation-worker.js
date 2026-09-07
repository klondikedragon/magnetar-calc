import { deserializeValue, evaluateWithAnalysis, serializeValue } from "./engine";

function evaluateJob({ expression, references = [], options = {} }) {
  const restoredReferences = new Map(references.map(([token, value]) => [token, value?.kind === "number" ? String(value.number) : deserializeValue(value)]));
  return serializeValue(evaluateWithAnalysis(expression, restoredReferences, options));
}

self.onmessage = ({ data }) => {
  const { jobId, expression, references = [], options = {}, jobs } = data;
  if (Array.isArray(jobs)) {
    const results = jobs.map((job) => {
      try {
        return { id: job.id, revision: job.revision, type: "result", value: evaluateJob(job) };
      } catch (error) {
        return { id: job.id, revision: job.revision, type: "error", message: error?.message ?? "Calculation failed" };
      }
    });
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
