// OEIS A367620: the lexicographically earliest infinite comma-child path.
//
// The global definition depends on whether a branch has an infinite
// continuation, which is not an effective local recurrence. OEIS publishes
// the first 20,000 terms, however, and reports that the first choice point is
// only after term 412,987,860. Every term supported here therefore has one
// comma-child and can be generated without making an unproved branch choice.
export const kangarooPolicy = Object.freeze({
  maximumVerifiedTerm: 20_000,
  source: "https://oeis.org/A367620/b367620.txt",
});

const terms = [20];

function firstDecimalDigit(value) {
  let first = value;
  while (first >= 10) first = Math.floor(first / 10);
  return first;
}

export function commaChildren(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("comma children require a positive safe integer");
  const last = value % 10;
  const children = [];
  for (let first = 1; first <= 9; first += 1) {
    const candidate = value + (10 * last) + first;
    if (firstDecimalDigit(candidate) === first) children.push(candidate);
  }
  return children;
}

function extendThrough(n) {
  while (terms.length < n) {
    const children = commaChildren(terms.at(-1));
    if (children.length !== 1) {
      throw new Error(`kangaroo verification boundary reached: expected one comma-child, found ${children.length}`);
    }
    terms.push(children[0]);
  }
}

export function kangarooTerm(n) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("kangaroo requires an integer n >= 1");
  if (n > kangarooPolicy.maximumVerifiedTerm) {
    throw new Error(`kangaroo supports the published verified prefix n <= ${kangarooPolicy.maximumVerifiedTerm.toLocaleString()}`);
  }
  extendThrough(n);
  return terms[n - 1];
}

export function kangarooCacheStats() {
  return Object.freeze({
    terms: terms.length,
    maximumVerifiedTerm: kangarooPolicy.maximumVerifiedTerm,
  });
}
