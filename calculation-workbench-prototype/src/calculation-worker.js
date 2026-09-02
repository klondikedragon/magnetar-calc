import { deserializeValue, evaluateAutomatically, serializeValue } from "./engine";

self.onmessage = ({ data }) => {
  const { jobId, expression, references = [], options = {} } = data;
  try {
    const restoredReferences = new Map(references.map(([token, value]) => [token, deserializeValue(value)]));
    const value = evaluateAutomatically(expression, restoredReferences, options);
    self.postMessage({ type: "result", jobId, value: serializeValue(value) });
  } catch (error) {
    self.postMessage({ type: "error", jobId, message: error?.message ?? "Calculation failed" });
  }
};
