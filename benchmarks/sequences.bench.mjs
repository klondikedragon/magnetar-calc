import { performance } from "node:perf_hooks";
import { sequenceValue } from "../src/sequenceValues.js";

function measure(label, run) {
  const startedAt = performance.now();
  run();
  console.log(`${label}: ${(performance.now() - startedAt).toFixed(2)} ms`);
}

measure("Yellowstone terms 1–1,000 (cold prefix)", () => {
  for (let n = 1; n <= 1_000; n += 1) sequenceValue("yellowstone", n);
});
measure("Fibonacci terms 1–1,000 (direct fast doubling)", () => {
  for (let n = 1; n <= 1_000; n += 1) sequenceValue("fib", n);
});
measure("Partition terms 1–1,000 (incremental cache)", () => {
  for (let n = 1; n <= 1_000; n += 1) sequenceValue("partition", n);
});
measure("Bell terms 1–500 (incremental cache)", () => {
  for (let n = 1; n <= 500; n += 1) sequenceValue("bell", n);
});
measure("Harmonic terms 1–1,000 (incremental cache)", () => {
  for (let n = 1; n <= 1_000; n += 1) sequenceValue("harmonic", n);
});
measure("All cached endpoints ×1,000 (warm)", () => {
  for (let repeat = 0; repeat < 1_000; repeat += 1) {
    sequenceValue("yellowstone", 1_000);
    sequenceValue("partition", 1_000);
    sequenceValue("bell", 500);
    sequenceValue("harmonic", 1_000);
  }
});
