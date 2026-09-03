import { deserializeValue, evaluateWithAnalysis, serializeValue } from "./engine";

self.onmessage = ({ data }) => {
  const { jobId, expression, references = [], options = {} } = data;
  try {
    const restoredReferences = new Map(references.map(([token, value]) => [token, value?.kind === "number" ? String(value.number) : deserializeValue(value)]));
    // The result is only published once all synchronous analysis that belongs to
    // it is complete, avoiding a visible unclassified intermediate value.
    const value = evaluateWithAnalysis(expression, restoredReferences, options);
    self.postMessage({ type: "result", jobId, value: serializeValue(value) });
  } catch (error) {
    self.postMessage({ type: "error", jobId, message: error?.message ?? "Calculation failed" });
  }
};
