// Exact values are deliberately separate from Decimal.js. They retain the
// mathematical result as BigInt components and only become an approximation
// when a caller explicitly asks for one.

// This is an expansion budget, not a precision setting. One hundred thousand
// decimal digits is still compact enough for the worker and lets ordinary
// powers such as 6^46656 remain fully exact.
const maximumExactDigits = 100_000;
const maximumExactPowerExponent = 100_000;

class NotExactError extends Error {}

function notExact() { throw new NotExactError(); }

function absolute(value) { return value < 0n ? -value : value; }

function gcd(left, right) {
  let a = absolute(left);
  let b = absolute(right);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function withinExactLimit(value) {
  return absolute(value).toString().length <= maximumExactDigits;
}

function guard(numerator, denominator = 1n) {
  if (!withinExactLimit(numerator) || !withinExactLimit(denominator)) notExact();
  return [numerator, denominator];
}

export function exactInteger(integer) {
  const value = BigInt(integer);
  guard(value);
  return {
    kind: "exact-integer",
    integer: value,
    exactInteger: value.toString(),
    full: value.toString(),
    engineId: "native-exact",
    engineLabel: "Native exact",
    certainty: "exact",
    quality: { certainty: "exact", representation: "integer", retainedDigits: "all" },
  };
}

export function exactRational(numerator, denominator = 1n) {
  let top = BigInt(numerator);
  let bottom = BigInt(denominator);
  if (bottom === 0n) throw new Error("division by zero");
  if (bottom < 0n) { top = -top; bottom = -bottom; }
  const divisor = gcd(top, bottom);
  top /= divisor;
  bottom /= divisor;
  guard(top, bottom);
  if (bottom === 1n) return exactInteger(top);
  return {
    kind: "exact-rational",
    numerator: top,
    denominator: bottom,
    full: `${top}/${bottom}`,
    engineId: "native-exact",
    engineLabel: "Native exact",
    certainty: "exact",
    quality: { certainty: "exact", representation: "rational", retainedDigits: "all" },
  };
}

export function isExactValue(value) {
  return value?.kind === "exact-integer" || value?.kind === "exact-rational";
}

export function exactParts(value) {
  if (value?.kind === "exact-integer") return { numerator: value.integer ?? BigInt(value.exactInteger), denominator: 1n };
  if (value?.kind === "exact-rational") return { numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) };
  return null;
}

function add(left, right) {
  const a = exactParts(left);
  const b = exactParts(right);
  return exactRational((a.numerator * b.denominator) + (b.numerator * a.denominator), a.denominator * b.denominator);
}

function subtract(left, right) {
  const a = exactParts(left);
  const b = exactParts(right);
  return exactRational((a.numerator * b.denominator) - (b.numerator * a.denominator), a.denominator * b.denominator);
}

function multiply(left, right) {
  const a = exactParts(left);
  const b = exactParts(right);
  return exactRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

function divide(left, right) {
  const a = exactParts(left);
  const b = exactParts(right);
  return exactRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

function compare(left, right) {
  const a = exactParts(left);
  const b = exactParts(right);
  const difference = (a.numerator * b.denominator) - (b.numerator * a.denominator);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function decimalLiteral(raw) {
  const match = raw.match(/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) notExact();
  const [, whole, fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent)) notExact();
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  const scale = fraction.length - exponent;
  if (Math.abs(scale) > maximumExactDigits) notExact();
  if (scale <= 0) return exactInteger(BigInt(digits) * (10n ** BigInt(-scale)));
  return exactRational(BigInt(digits), 10n ** BigInt(scale));
}

function asInteger(value) {
  const parts = exactParts(value);
  if (!parts || parts.denominator !== 1n) notExact();
  return parts.numerator;
}

function natural(value, maximum = 10_000) {
  const integer = asInteger(value);
  if (integer < 0n || integer > BigInt(maximum)) notExact();
  return Number(integer);
}

function factorial(value) {
  const input = natural(value, 5_000);
  let result = 1n;
  for (let index = 2n; index <= BigInt(input); index += 1n) {
    result *= index;
    if (!withinExactLimit(result)) notExact();
  }
  return exactInteger(result);
}

function power(left, right) {
  const exponent = asInteger(right);
  if (absolute(exponent) > BigInt(maximumExactPowerExponent)) notExact();
  const base = exactParts(left);
  if (base.numerator === 0n && exponent < 0n) throw new Error("division by zero");
  const magnitude = exponent < 0n ? -exponent : exponent;
  const numerator = base.numerator ** magnitude;
  const denominator = base.denominator ** magnitude;
  if (!withinExactLimit(numerator) || !withinExactLimit(denominator)) notExact();
  return exponent < 0n ? exactRational(denominator, numerator) : exactRational(numerator, denominator);
}

function integerSquareRoot(value) {
  if (value < 0n) notExact();
  if (value < 2n) return value;
  let lower = 1n;
  let upper = value;
  while (lower + 1n < upper) {
    const middle = (lower + upper) >> 1n;
    if (middle * middle <= value) lower = middle;
    else upper = middle;
  }
  return lower;
}

function exactSquareRoot(value) {
  const parts = exactParts(value);
  if (parts.numerator < 0n) notExact();
  const top = integerSquareRoot(parts.numerator);
  const bottom = integerSquareRoot(parts.denominator);
  if ((top * top) !== parts.numerator || (bottom * bottom) !== parts.denominator) notExact();
  return exactRational(top, bottom);
}

function sequence(implementationId, args) {
  const n = natural(args[0], implementationId === "sequence-nth-prime" ? 100_000 : 2_000);
  if (implementationId === "sequence-fibonacci" || implementationId === "sequence-lucas" || implementationId === "sequence-jacobsthal") {
    let a = implementationId === "sequence-lucas" ? 2n : 0n;
    let b = 1n;
    for (let index = 0; index < n; index += 1) [a, b] = [b, implementationId === "sequence-jacobsthal" ? b + (2n * a) : a + b];
    return exactInteger(a);
  }
  if (implementationId === "sequence-triangular") return exactInteger((BigInt(n) * BigInt(n + 1)) / 2n);
  if (implementationId === "sequence-catalan") {
    let result = 1n;
    for (let index = 0; index < n; index += 1) result = (result * BigInt(2 * ((2 * index) + 1))) / BigInt(index + 2);
    return exactInteger(result);
  }
  if (implementationId === "combinatorics-binomial") {
    const k = natural(args[1], n);
    if (k > n) throw new Error("binomial requires k <= n");
    let result = 1n;
    for (let index = 1; index <= Math.min(k, n - k); index += 1) result = (result * BigInt(n - index + 1)) / BigInt(index);
    return exactInteger(result);
  }
  if (implementationId === "combinatorics-stirling-second") {
    const k = natural(args[1], n);
    const rows = Array(k + 1).fill(0n);
    rows[0] = 1n;
    for (let row = 1; row <= n; row += 1) {
      for (let column = Math.min(row, k); column >= 2; column -= 1) rows[column] = rows[column - 1] + (BigInt(column) * rows[column]);
      if (k >= 1) rows[1] = 1n;
    }
    return exactInteger(rows[k]);
  }
  if (implementationId === "sequence-partition") {
    const values = Array(n + 1).fill(0n);
    values[0] = 1n;
    for (let part = 1; part <= n; part += 1) for (let total = part; total <= n; total += 1) values[total] += values[total - part];
    return exactInteger(values[n]);
  }
  if (implementationId === "sequence-bell") {
    let row = [1n];
    for (let index = 1; index <= n; index += 1) {
      const next = [row.at(-1)];
      for (let column = 1; column <= index; column += 1) next.push(next[column - 1] + row[column - 1]);
      row = next;
    }
    return exactInteger(row[0]);
  }
  if (implementationId === "sequence-harmonic") {
    let result = exactInteger(0);
    for (let index = 1; index <= n; index += 1) result = add(result, exactRational(1n, BigInt(index)));
    return result;
  }
  notExact();
}

function referenceValue(token, references) {
  const reference = references.get(token);
  if (isExactValue(reference)) return reference;
  if (typeof reference === "string") return decimalLiteral(reference);
  if (reference?.exactInteger && /^-?\d+$/.test(reference.exactInteger)) return exactInteger(reference.exactInteger);
  notExact();
}

function evaluateNode(node, references) {
  if (node.type === "group") return evaluateNode(node.value, references);
  if (node.type === "number") return decimalLiteral(node.raw);
  if (node.type === "reference") return referenceValue(node.token, references);
  if (node.type === "atom") notExact();
  if (node.type === "unary") {
    const value = evaluateNode(node.value, references);
    const parts = exactParts(value);
    if (node.implementationId === "arithmetic-positive") return value;
    if (node.implementationId === "arithmetic-negative") return exactRational(-parts.numerator, parts.denominator);
    if (node.implementationId === "arithmetic-sqrt") return exactSquareRoot(value);
    notExact();
  }
  if (node.type === "postfix") {
    if (node.implementationId === "arithmetic-factorial") return factorial(evaluateNode(node.value, references));
    notExact();
  }
  if (node.type === "binary") {
    const left = evaluateNode(node.left, references);
    const right = evaluateNode(node.right, references);
    if (node.implementationId === "arithmetic-add") return add(left, right);
    if (node.implementationId === "arithmetic-subtract") return subtract(left, right);
    if (node.implementationId === "arithmetic-multiply") return multiply(left, right);
    if (node.implementationId === "arithmetic-divide") return divide(left, right);
    if (node.implementationId === "arithmetic-power" || node.implementationId === "hyperoperation-knuth-up") return power(left, right);
    if (node.implementationId === "arithmetic-modulo") return exactInteger(asInteger(left) % asInteger(right));
    notExact();
  }
  if (node.type === "call") {
    const args = node.args.map((argument) => evaluateNode(argument, references));
    if (node.implementationId === "arithmetic-abs") { const value = exactParts(args[0]); return exactRational(absolute(value.numerator), value.denominator); }
    if (node.implementationId === "arithmetic-min") return args.reduce((lowest, value) => compare(value, lowest) < 0 ? value : lowest);
    if (node.implementationId === "arithmetic-max") return args.reduce((highest, value) => compare(value, highest) > 0 ? value : highest);
    if (node.implementationId === "scientific-floor") { const value = exactParts(args[0]); return exactInteger(value.numerator >= 0n ? value.numerator / value.denominator : -((-value.numerator + value.denominator - 1n) / value.denominator)); }
    if (node.implementationId === "scientific-ceil") { const value = exactParts(args[0]); return exactInteger(value.numerator >= 0n ? (value.numerator + value.denominator - 1n) / value.denominator : -((-value.numerator) / value.denominator)); }
    if (node.implementationId === "scientific-trunc") { const value = exactParts(args[0]); return exactInteger(value.numerator / value.denominator); }
    if (node.implementationId?.startsWith("sequence-") || node.implementationId?.startsWith("combinatorics-")) return sequence(node.implementationId, args);
    notExact();
  }
  notExact();
}

export function tryEvaluateExact(ast, references = new Map()) {
  try {
    return evaluateNode(ast, references);
  } catch (error) {
    if (error instanceof NotExactError) return null;
    throw error;
  }
}

export function serializeExactValue(value) {
  if (value?.kind === "exact-integer") {
    const { decimal: _decimal, ...serializable } = value;
    return { ...serializable, integer: (value.integer ?? BigInt(value.exactInteger)).toString() };
  }
  if (value?.kind === "exact-rational") {
    const { decimal: _decimal, ...serializable } = value;
    return { ...serializable, numerator: BigInt(value.numerator).toString(), denominator: BigInt(value.denominator).toString() };
  }
  return value;
}

export function deserializeExactValue(value) {
  if (value?.kind === "exact-integer") return exactInteger(value.integer ?? value.exactInteger);
  if (value?.kind === "exact-rational") return exactRational(value.numerator, value.denominator);
  return value;
}
