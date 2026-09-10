// OEIS A002487. The binary recurrence lets us calculate a(n) directly in
// O(log n), without retaining previous terms as cache state.
export const sternPolicy = Object.freeze({ maximumTerm: 1_000_000 });

export function sternTerm(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("stern requires an integer n >= 0");
  if (n > sternPolicy.maximumTerm) throw new Error(`stern supports n ≤ ${sternPolicy.maximumTerm.toLocaleString()} in this engine`);
  let left = 0n;
  let right = 1n;
  const bits = n.toString(2);
  for (const bit of bits) {
    if (bit === "0") right = left + right;
    else left += right;
  }
  return left;
}
