// OEIS A005132. This is the standard Recamán sequence, whose positive
// backward move is preferred only when it has not occurred before. The
// forward alternative is allowed to repeat, so this is not a permutation.
export const recamanPolicy = Object.freeze({
  maximumTerm: 100_000,
  maximumCacheBytes: 32 * 1024 * 1024,
});

const state = {
  values: [0],
  seen: new Set([0]),
};

function estimatedBytes() {
  // Set overhead is implementation-specific; this is a deliberately
  // conservative guardrail rather than an observation about browser memory.
  return (state.values.length * 16) + (state.seen.size * 64);
}

function validateTerm(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("recaman requires an integer n >= 0");
  if (n > recamanPolicy.maximumTerm) throw new Error(`recaman supports n ≤ ${recamanPolicy.maximumTerm.toLocaleString()} in this engine`);
}

function extendThrough(n) {
  while (state.values.length <= n) {
    if (estimatedBytes() >= recamanPolicy.maximumCacheBytes) throw new Error("recaman cache reached its memory budget");
    const index = state.values.length;
    const previous = state.values.at(-1);
    const backward = previous - index;
    const next = backward > 0 && !state.seen.has(backward) ? backward : previous + index;
    state.values.push(next);
    state.seen.add(next);
  }
}

export function recamanTerm(n) {
  validateTerm(n);
  extendThrough(n);
  return state.values[n];
}

export function recamanCacheStats() {
  return Object.freeze({
    cachedTerms: state.values.length,
    estimatedBytes: estimatedBytes(),
    maximumTerm: recamanPolicy.maximumTerm,
    maximumCacheBytes: recamanPolicy.maximumCacheBytes,
  });
}
