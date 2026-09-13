import { recamanTerm } from "./recaman.js";
import { sternTerm } from "./stern.js";
import { yellowstoneTerm } from "./yellowstone.js";

export const sequenceValuePolicy = Object.freeze({
  maximumCachedIndex: 2_000,
  maximumPrimeIndex: 100_000,
  maximumPrimeCountInput: 100_000,
  maximumEstimatedCacheBytes: 32 * 1024 * 1024,
});

const catalanValues = [1n];
const partitionValues = [1n];
const bellValues = [1n];
const harmonicValues = [{ numerator: 0n, denominator: 1n }];
const primes = [2];
let nextPrimeCandidate = 3;
let estimatedCacheBytes = 5 * 24;

function estimatedBigIntBytes(value) {
  const bits = absolute(value).toString(2).length;
  return 16 + Math.ceil(bits / 8);
}

function cacheValue(values, value, bigInts) {
  const addedBytes = bigInts.reduce((total, item) => total + estimatedBigIntBytes(item), 16);
  if (estimatedCacheBytes + addedBytes > sequenceValuePolicy.maximumEstimatedCacheBytes) {
    throw new Error("sequence cache reached its estimated memory budget");
  }
  values.push(value);
  estimatedCacheBytes += addedBytes;
}

function absolute(value) { return value < 0n ? -value : value; }
function gcd(left, right) {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function integer(value) { return Object.freeze({ kind: "integer", value }); }
function rational(numerator, denominator) {
  const divisor = gcd(numerator, denominator);
  return Object.freeze({ kind: "rational", numerator: numerator / divisor, denominator: denominator / divisor });
}

function fibonacciPair(n) {
  if (n === 0) return [0n, 1n];
  const [a, b] = fibonacciPair(Math.floor(n / 2));
  const c = a * ((2n * b) - a);
  const d = (a * a) + (b * b);
  return n % 2 === 0 ? [c, d] : [d, c + d];
}

function binomialValue(n, k) {
  if (k > n) throw new Error("binomial requires k <= n");
  let result = 1n;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) {
    result = (result * BigInt(n - index + 1)) / BigInt(index);
  }
  return result;
}

function stirlingSecondValue(n, k) {
  const row = Array(k + 1).fill(0n);
  row[0] = 1n;
  for (let index = 1; index <= n; index += 1) {
    for (let column = Math.min(index, k); column >= 1; column -= 1) {
      row[column] = row[column - 1] + (BigInt(column) * row[column]);
    }
    row[0] = 0n;
  }
  return row[k];
}

function catalanValue(n) {
  while (catalanValues.length <= n) {
    const index = catalanValues.length - 1;
    const next = (catalanValues[index] * BigInt(2 * ((2 * index) + 1))) / BigInt(index + 2);
    cacheValue(catalanValues, next, [next]);
  }
  return catalanValues[n];
}

// Euler's generalized-pentagonal recurrence lets the partition cache grow one
// immutable term at a time instead of rebuilding an O(n²) table for every n.
function partitionValue(n) {
  while (partitionValues.length <= n) {
    const index = partitionValues.length;
    let total = 0n;
    for (let k = 1; ; k += 1) {
      const lower = (k * ((3 * k) - 1)) / 2;
      if (lower > index) break;
      const sign = k % 2 === 1 ? 1n : -1n;
      total += sign * partitionValues[index - lower];
      const upper = (k * ((3 * k) + 1)) / 2;
      if (upper <= index) total += sign * partitionValues[index - upper];
    }
    cacheValue(partitionValues, total, [total]);
  }
  return partitionValues[n];
}

function bellValue(n) {
  while (bellValues.length <= n) {
    const index = bellValues.length - 1;
    let next = 0n;
    let choose = 1n;
    for (let k = 0; k <= index; k += 1) {
      next += choose * bellValues[k];
      if (k < index) choose = (choose * BigInt(index - k)) / BigInt(k + 1);
    }
    cacheValue(bellValues, next, [next]);
  }
  return bellValues[n];
}

function harmonicValue(n) {
  while (harmonicValues.length <= n) {
    const index = harmonicValues.length;
    const prior = harmonicValues[index - 1];
    const next = rational((prior.numerator * BigInt(index)) + prior.denominator, prior.denominator * BigInt(index));
    cacheValue(harmonicValues, next, [next.numerator, next.denominator]);
  }
  return harmonicValues[n];
}

function isPrimeCandidate(candidate) {
  const limit = Math.floor(Math.sqrt(candidate));
  for (const prime of primes) {
    if (prime > limit) break;
    if (candidate % prime === 0) return false;
  }
  return true;
}

function extendPrimesToCount(count) {
  while (primes.length < count) {
    if (isPrimeCandidate(nextPrimeCandidate)) { primes.push(nextPrimeCandidate); estimatedCacheBytes += 8; }
    nextPrimeCandidate += 2;
  }
}

function extendPrimesThrough(limit) {
  while (nextPrimeCandidate <= limit) {
    if (isPrimeCandidate(nextPrimeCandidate)) { primes.push(nextPrimeCandidate); estimatedCacheBytes += 8; }
    nextPrimeCandidate += 2;
  }
}

function primeCount(limit) {
  extendPrimesThrough(limit);
  let low = 0;
  let high = primes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (primes[middle] <= limit) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function sequenceValue(name, n, k = null) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${name} requires a non-negative integer`);
  const maximum = name === "prime" || name === "recaman" ? sequenceValuePolicy.maximumPrimeIndex
    : name === "primepi" ? sequenceValuePolicy.maximumPrimeCountInput
      : name === "stern" ? 1_000_000
        : name === "yellowstone" ? 10_000
          : sequenceValuePolicy.maximumCachedIndex;
  if (n > maximum) throw new Error(`${name} supports n up to ${maximum.toLocaleString()}`);
  if (name === "fib") return integer(fibonacciPair(n)[0]);
  if (name === "lucas") { const [current, next] = fibonacciPair(n); return integer((2n * next) - current); }
  if (name === "jacobsthal") return integer(((2n ** BigInt(n)) - (n % 2 === 0 ? 1n : -1n)) / 3n);
  if (name === "triangular") return integer((BigInt(n) * BigInt(n + 1)) / 2n);
  if (name === "catalan") return integer(catalanValue(n));
  if (name === "partition") return integer(partitionValue(n));
  if (name === "bell") return integer(bellValue(n));
  if (name === "harmonic") return harmonicValue(n);
  if (name === "yellowstone") return integer(BigInt(yellowstoneTerm(n)));
  if (name === "recaman") return integer(BigInt(recamanTerm(n)));
  if (name === "stern") return integer(BigInt(sternTerm(n)));
  if (name === "binomial") return integer(binomialValue(n, k));
  if (name === "stirling2") return integer(stirlingSecondValue(n, k));
  if (name === "prime") {
    if (n < 1) throw new Error("prime requires a positive integer");
    extendPrimesToCount(n);
    return integer(BigInt(primes[n - 1]));
  }
  if (name === "primepi") return integer(BigInt(primeCount(n)));
  throw new Error(`unknown sequence: ${name}`);
}

export function sequenceValueCacheStats() {
  return Object.freeze({
    catalanTerms: catalanValues.length,
    partitionTerms: partitionValues.length,
    bellTerms: bellValues.length,
    harmonicTerms: harmonicValues.length,
    primeTerms: primes.length,
    estimatedCacheBytes,
    maximumEstimatedCacheBytes: sequenceValuePolicy.maximumEstimatedCacheBytes,
  });
}
