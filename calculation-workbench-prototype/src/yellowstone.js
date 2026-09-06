// OEIS A098550, kept as an in-memory derived cache. It is intentionally not
// persisted with a notebook: any engine version can rebuild it from term one.
export const yellowstonePolicy = Object.freeze({
  maximumTerm: 10_000,
  maximumCacheBytes: 32 * 1024 * 1024,
});

const state = {
  values: [1, 2, 3],
  used: new Set([1, 2, 3]),
};

function gcd(left, right) {
  let a = left;
  let b = right;
  while (b) [a, b] = [b, a % b];
  return a;
}

function estimatedBytes() {
  // A Set's exact overhead is engine-specific. This intentionally generous
  // estimate is a guardrail, not a claim about a browser's actual heap use.
  return (state.values.length * 16) + (state.used.size * 64);
}

function validateTerm(n) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("yellowstone requires an integer n >= 1");
  if (n > yellowstonePolicy.maximumTerm) throw new Error(`yellowstone supports n ≤ ${yellowstonePolicy.maximumTerm.toLocaleString()} in this engine`);
}

function extendThrough(n) {
  while (state.values.length < n) {
    if (estimatedBytes() >= yellowstonePolicy.maximumCacheBytes) throw new Error("yellowstone cache reached its memory budget");
    const twoBack = state.values.at(-2);
    const previous = state.values.at(-1);
    let candidate = 1;
    while (state.used.has(candidate) || gcd(candidate, twoBack) === 1 || gcd(candidate, previous) !== 1) candidate += 1;
    state.values.push(candidate);
    state.used.add(candidate);
  }
}

export function yellowstoneTerm(n) {
  validateTerm(n);
  extendThrough(n);
  return state.values[n - 1];
}

export function yellowstoneCacheStats() {
  return Object.freeze({
    cachedTerms: state.values.length,
    estimatedBytes: estimatedBytes(),
    maximumTerm: yellowstonePolicy.maximumTerm,
    maximumCacheBytes: yellowstonePolicy.maximumCacheBytes,
  });
}
