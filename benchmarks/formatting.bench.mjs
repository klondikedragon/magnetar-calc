import { performance } from "node:perf_hooks";
import { deserializeValue, formatForHighPrecisionExport } from "../src/engine.js";

for (const digitCount of [1_000, 6_002, 100_000]) {
  const value = deserializeValue({ kind: "exact-integer", integer: `1${"2".repeat(digitCount - 2)}3` });
  const startedAt = performance.now();
  const formatted = formatForHighPrecisionExport(value, {
    base: 10,
    groupDigits: true,
  });
  const elapsed = performance.now() - startedAt;
  console.log(`${digitCount.toLocaleString()} digits: ${elapsed.toFixed(2)} ms (${formatted.length.toLocaleString()} characters)`);
}
