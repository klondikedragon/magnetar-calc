import { performance } from "node:perf_hooks";
import { evaluateAutomatically, formatAutomatically } from "../src/engine.js";
import { createValuePresentationCache } from "../src/presentationCache.js";

const value = evaluateAutomatically("2^19937 - 1");
const options = { base: 10, precision: 1_000, notation: "auto", groupDigits: true };
const repetitions = 100;

let startedAt = performance.now();
for (let index = 0; index < repetitions; index += 1) formatAutomatically(value, options);
const uncached = performance.now() - startedAt;

const cachedFormatter = createValuePresentationCache((candidate) => formatAutomatically(candidate, options));
startedAt = performance.now();
for (let index = 0; index < repetitions; index += 1) cachedFormatter(value);
const cached = performance.now() - startedAt;

console.log(`${repetitions} unchanged presentations: ${uncached.toFixed(2)} ms uncached; ${cached.toFixed(2)} ms cached`);
