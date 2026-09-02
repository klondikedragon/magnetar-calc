import { analyzePrimality, deserializeValue } from "./engine";

self.onmessage = ({ data }) => {
  try {
    const value = deserializeValue(data.value);
    self.postMessage({ type: "result", key: value.exactInteger, primality: analyzePrimality(value) });
  } catch (error) {
    self.postMessage({ type: "error", message: error?.message ?? "Primality analysis failed" });
  }
};
