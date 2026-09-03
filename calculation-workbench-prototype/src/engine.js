// Engine boundary. The UI should only depend on these methods; alternate
// arbitrary-precision and logarithmic backends can be added behind this API.
import BreakDecimal from "break_eternity.js";
import Decimal from "decimal.js";

function formatNumber(number, base, precision = 48, notation = "auto") {
  if (!Number.isFinite(number)) return { sign: "", significand: "Not a finite number", exponent: "", text: "Not a finite number", full: String(number) };
  const sign = number < 0 ? "−" : "";
  const absolute = Math.abs(number);
  if (base === 2 && Number.isInteger(number)) return { sign, significand: `0b${absolute.toString(2)}`, exponent: "", text: `${sign}0b${absolute.toString(2)}`, full: `${sign}0b${absolute.toString(2)}` };
  if (base === 16 && Number.isInteger(number)) return { sign, significand: `0x${absolute.toString(16).toUpperCase()}`, exponent: "", text: `${sign}0x${absolute.toString(16).toUpperCase()}`, full: `${sign}0x${absolute.toString(16).toUpperCase()}` };
  const significant = Number(absolute.toPrecision(Math.min(16, precision))).toString();
  const raw = notation === "scientific" || notation === "engineering" || absolute >= 1e9 || (absolute > 0 && absolute < 1e-6) ? absolute.toExponential(Math.min(15, Math.max(1, precision - 1))).replace(/(\.[0-9]*?)0+e/, "$1e") : significant;
  let [coefficient, exponent = ""] = raw.split("e");
  exponent = exponent.replace(/^\+/, "");
  return { sign, significand: coefficient, exponent, text: exponent ? `${sign}${coefficient} × ${base}^${exponent}` : `${sign}${coefficient}`, full: String(number) };
}

function renderValue(value, base, precision, notation) {
  if (value.kind === "large") {
    const significand = value.significand.slice(0, Math.max(8, precision - 16));
    if (notation === "engineering") {
      const rounded = Math.floor(Number(value.exponent) / 3) * 3;
      return { sign: value.sign, significand, exponent: String(rounded), text: `${value.sign}${significand} × ${base}^${rounded}`, full: value.full };
    }
    if (base === 2) return { sign: value.sign, significand: "0b1.101011…", exponent: value.exponent, text: `${value.sign}0b1.101011… × 2^${value.exponent}`, full: value.full };
    if (base === 16) return { sign: value.sign, significand: "0x1.FD0C…", exponent: value.exponent, text: `${value.sign}0x1.FD0C… × 16^${value.exponent}`, full: value.full };
    return { sign: value.sign, significand: `${significand}…`, exponent: value.exponent, text: `${value.sign}${significand}… × 10^${value.exponent}`, full: value.full };
  }
  return { ...formatNumber(value.number, base, precision, notation), full: value.full };
}

function evaluateSimple(expression, references) {
  let normalized = expression;
  references.forEach((value, token) => { normalized = normalized.replaceAll(token, value); });
  normalized = normalized.replace(/(\d+(?:\.\d+)?)!/g, "factorial($1)").replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-").replaceAll("π", "Math.PI").replaceAll("τ", "(2*Math.PI)").replace(/\be\b/g, "Math.E").replaceAll("^", "**").replaceAll("√", "Math.sqrt").replaceAll("log", "Math.log10").replaceAll("ln", "Math.log").replaceAll("sin", "Math.sin").replaceAll("cos", "Math.cos").replaceAll("tan", "Math.tan").replaceAll("abs", "Math.abs").replaceAll("mod", "%");
  if (!/^[0-9+\-*/().,\sA-Za-z*]+$/.test(normalized)) throw new Error("unsupported");
  const number = Function(`"use strict"; const factorial = (n) => { let r = 1; for (let i = 2; i <= n; i += 1) r *= i; return r; }; return (${normalized})`)();
  return { kind: "number", number, full: String(number) };
}

export const placeholderEngine = {
  parse(expression) { return { expression, kind: "placeholder" }; },
  evaluate(expression, references = new Map()) { return evaluateSimple(expression, references); },
  format(value, options = {}) { return renderValue(value, options.base ?? 10, options.precision ?? 48, options.notation ?? "scientific"); },
  inspect(value, options = {}) { const rendered = this.format(value, options); return { ...rendered, precision: options.precision ?? 48, representation: value.kind === "large" ? "layer-1 placeholder" : "native number", exactness: "placeholder approximation" }; },
  convertBase(value, base) { return this.format(value, { base }); },
};

const tokenPattern = /\s*(\d+(?:\.\d*)?(?:e[+-]?\d+)?|@history\(\d+\)|[A-Za-z][A-Za-z0-9]*|↑+|\^+|[()+\-*/%!×÷−πτφ√])/gy;
const maximumExpressionLength = 12000;
const maximumTokenCount = 2400;
const maximumTetrationHeight = 10000000;
const maximumDecimalDisplayLength = 1000;

function tokenize(source) {
  if (source.length > maximumExpressionLength) throw new Error("expression is too long");
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    if (!source.slice(index).trim()) break;
    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(source);
    if (!match) throw new Error("unsupported expression");
    tokens.push(match[1]);
    if (tokens.length > maximumTokenCount) throw new Error("expression is too complex");
    index = tokenPattern.lastIndex;
  }
  const functions = new Set(["sqrt", "sin", "cos", "tan", "ln", "log", "abs", "exp", "fib", "lucas", "prime", "primepi", "partition", "catalan", "bell", "triangular", "harmonic", "jacobsthal", "stirling2", "binomial", "fgh1", "fgh2", "fgh3"]);
  const endsAtom = (token) => /^\d/.test(token) || token.startsWith("@history") || ["π", "τ", "φ", "e", "pi", "tau", "phi", ")", "!"].includes(token.toLowerCase());
  const startsAtom = (token) => /^\d/.test(token) || token.startsWith("@history") || ["π", "τ", "φ", "e", "pi", "tau", "phi", "("].includes(token.toLowerCase()) || functions.has(token.toLowerCase());
  const expanded = [];
  tokens.forEach((token) => { if (expanded.length && endsAtom(expanded[expanded.length - 1]) && startsAtom(token)) expanded.push("*"); expanded.push(token); });
  return expanded;
}

function factorialValue(value, Ctor) {
  if (Ctor === BreakDecimal) return value.factorial();
  if (!value.isInteger() || value.isNegative() || value.gt(10000)) throw new Error("factorial requires a non-negative integer <= 10000");
  let result = new Ctor(1);
  for (let i = 2; i <= value.toNumber(); i += 1) result = result.mul(i);
  return result;
}

function engineConstant(name, Ctor) {
  if (Ctor === BreakDecimal) {
    return new Ctor(name === "pi" ? "3.141592653589793" : name === "e" ? "2.718281828459045" : name === "phi" ? "1.618033988749895" : "6.283185307179586");
  }
  if (name === "pi") return Ctor.acos(new Ctor(-1));
  if (name === "e") return Ctor.exp(new Ctor(1));
  if (name === "phi") return Ctor.sqrt(new Ctor(5)).add(1).div(2);
  if (name === "tau") return Ctor.acos(new Ctor(-1)).mul(2);
  throw new Error("unknown constant");
}

function naturalArgument(value, label, maximum = 10000) {
  const number = value.toNumber();
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) throw new Error(`${label} requires a non-negative integer <= ${maximum.toLocaleString()}`);
  return number;
}

function bigIntegerSequence(name, args, Ctor) {
  const n = naturalArgument(args[0], name, name === "prime" ? 100000 : name === "harmonic" ? 10000 : 2000);
  const asCtor = (value) => new Ctor(value.toString());
  if (name === "fib" || name === "lucas" || name === "jacobsthal") {
    let a = name === "lucas" ? 2n : 0n;
    let b = 1n;
    for (let index = 0; index < n; index += 1) [a, b] = [b, name === "jacobsthal" ? b + (2n * a) : a + b];
    return asCtor(a);
  }
  if (name === "triangular") return asCtor((BigInt(n) * BigInt(n + 1)) / 2n);
  if (name === "catalan") { let result = 1n; for (let index = 2; index <= n; index += 1) result = (result * BigInt(n + index)) / BigInt(index); return asCtor(result); }
  if (name === "binomial") { const k = naturalArgument(args[1], "binomial", n); if (k > n) throw new Error("binomial requires k <= n"); let result = 1n; for (let index = 1; index <= Math.min(k, n - k); index += 1) result = (result * BigInt(n - index + 1)) / BigInt(index); return asCtor(result); }
  if (name === "stirling2") { const k = naturalArgument(args[1], "stirling2", n); const rows = Array(k + 1).fill(0n); rows[0] = 1n; for (let row = 1; row <= n; row += 1) for (let column = Math.min(row, k); column >= 1; column -= 1) rows[column] = rows[column - 1] + (BigInt(column) * rows[column]); return asCtor(rows[k]); }
  if (name === "partition") { const values = Array(n + 1).fill(0n); values[0] = 1n; for (let part = 1; part <= n; part += 1) for (let total = part; total <= n; total += 1) values[total] += values[total - part]; return asCtor(values[n]); }
  if (name === "bell") { let row = [1n]; for (let index = 1; index <= n; index += 1) { const next = [row.at(-1)]; for (let column = 1; column <= index; column += 1) next.push(next[column - 1] + row[column - 1]); row = next; } return asCtor(row[0]); }
  if (name === "harmonic") { let result = new Ctor(0); for (let index = 1; index <= n; index += 1) result = result.add(new Ctor(1).div(index)); return result; }
  if (name === "prime" || name === "primepi") { const bound = name === "prime" ? Math.max(20, Math.ceil(n * (Math.log(Math.max(n, 2)) + Math.log(Math.log(Math.max(n, 3))) + 3))) : n; const sieve = new Uint8Array(bound + 1); let count = 0; for (let candidate = 2; candidate <= bound; candidate += 1) { if (sieve[candidate]) continue; count += 1; if (name === "prime" && count === n) return new Ctor(candidate); for (let multiple = candidate * candidate; multiple <= bound; multiple += candidate) sieve[multiple] = 1; } return new Ctor(count); }
  throw new Error("unknown sequence");
}

function wainerFinite(level, argument, Ctor) {
  if (level === 1) return argument.mul(2);
  if (level === 2) return argument.mul(new Ctor(2).pow(argument));
  const iterations = naturalArgument(argument, `F${level}`, 4);
  let result = argument;
  for (let index = 0; index < iterations; index += 1) result = wainerFinite(level - 1, result, Ctor);
  return result;
}

function tetrateDecimal(base, height, Ctor) {
  if (!height.isInteger() || height.isNegative() || height.gt(100)) throw new Error("tetration height must be a non-negative integer <= 100");
  let result = new Ctor(1);
  for (let index = 0; index < height.toNumber(); index += 1) {
    result = base.pow(result);
    if (!result.isFinite()) throw new Error("engine range exceeded");
  }
  return result;
}

function tetrateBreak(base, height) {
  const numericHeight = height.toNumber();
  const integralHeight = Math.round(numericHeight);
  const roundingTolerance = Math.max(1e-9, Math.abs(numericHeight) * 1e-12);
  if (!Number.isSafeInteger(integralHeight) || integralHeight < 0 || Math.abs(numericHeight - integralHeight) > roundingTolerance) throw new Error("tetration height must be a non-negative safe integer");
  if (integralHeight > maximumTetrationHeight) throw new Error("tetration height exceeds the current safety budget");
  return base.tetrate(integralHeight);
}

function evaluateBreak(expression, references = new Map(), Ctor = BreakDecimal, kind = "break-eternity") {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const valueFor = (token) => {
    if (references.has(token)) {
      const reference = references.get(token);
      return reference && typeof reference.add === "function" ? reference : new Ctor(String(reference));
    }
    if (/^@history/.test(token)) throw new Error("unknown history reference");
    if (/^\d/.test(token)) return new Ctor(token);
    if (token === "π" || token.toLowerCase() === "pi") return engineConstant("pi", Ctor);
    if (token === "τ" || token.toLowerCase() === "tau") return engineConstant("tau", Ctor);
    if (token === "φ" || token.toLowerCase() === "phi") return engineConstant("phi", Ctor);
    if (token === "e") return engineConstant("e", Ctor);
    throw new Error("unknown value");
  };
  const primary = () => {
    const token = take();
    if (token === "(") { const result = addSub(); if (take() !== ")") throw new Error("missing parenthesis"); return result; }
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(token) && peek() === "(") {
      take();
      const args = [addSub()];
      while (peek() === ",") { take(); args.push(addSub()); }
      if (take() !== ")") throw new Error("missing parenthesis");
      const funcs = { sqrt: "sqrt", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log10", abs: "abs", exp: "exp" };
      const fn = funcs[token.toLowerCase()];
      if (fn) return args[0][fn]();
      if (["fib", "lucas", "prime", "primepi", "partition", "catalan", "bell", "triangular", "harmonic", "jacobsthal", "stirling2", "binomial"].includes(token.toLowerCase())) return bigIntegerSequence(token.toLowerCase(), args, Ctor);
      if (/^fgh[1-3]$/.test(token.toLowerCase())) return wainerFinite(Number(token.at(-1)), args[0], Ctor);
      throw new Error("unknown function");
    }
    return valueFor(token);
  };
  const unary = () => { if (peek() === "−" || peek() === "-") { take(); return unary().neg(); } if (peek() === "+") { take(); return unary(); } if (peek() === "√") { take(); return unary().sqrt(); } let result = primary(); while (peek() === "!") { take(); result = factorialValue(result, Ctor); } return result; };
  const power = () => { const left = unary(); if (peek() === "^" || peek() === "↑") { take(); return left.pow(power()); } if (typeof peek() === "string" && /^(?:↑{2,}|\^{2,})$/.test(peek())) { const arrows = take(); const height = power(); if (arrows.length === 2) return Ctor === BreakDecimal ? tetrateBreak(left, height) : tetrateDecimal(left, height, Ctor); throw new Error("hyper-operation not available in this backend"); } return left; };
  const mulDiv = () => { let result = power(); while (["*", "×", "/", "÷", "%", "mod"].includes(peek())) { const op = take(); const right = power(); result = op === "/" || op === "÷" ? result.div(right) : op === "%" || op === "mod" ? result.mod(right) : result.mul(right); } return result; };
  function addSub() { let result = mulDiv(); while (["+", "−", "-"].includes(peek())) { const op = take(); const right = mulDiv(); result = op === "+" ? result.add(right) : result.sub(right); } return result; }
  let result = addSub();
  if (position !== tokens.length) throw new Error("unexpected token");
  if (typeof result.isFinite === "function" && !result.isFinite()) throw new Error("engine range exceeded");
  const knuthMatch = expression.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*(↑{2,}|\^{2,})\s*([0-9]+(?:\.[0-9]+)?)\s*$/);
  return { kind, decimal: result, full: result.toString(), knuth: knuthMatch ? { base: knuthMatch[1], arrows: knuthMatch[2].replaceAll("^", "↑"), height: knuthMatch[3] } : null };
}

function scientificParts(magnitude, precision, engineering = false) {
  const rounded = magnitude.toSignificantDigits(Math.max(1, Math.min(precision, 1000)));
  let [coefficient, exponent = ""] = rounded.toExponential().split("e");
  let numericExponent = Number(exponent || 0);
  if (engineering && Number.isFinite(numericExponent)) {
    const targetExponent = Math.floor(numericExponent / 3) * 3;
    const shift = numericExponent - targetExponent;
    const digits = coefficient.replace(".", "");
    coefficient = `${digits.slice(0, 1 + shift)}${digits.length > 1 + shift ? `.${digits.slice(1 + shift)}` : ""}`;
    numericExponent = targetExponent;
    exponent = String(targetExponent);
  }
  coefficient = coefficient.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  return { coefficient, exponent: exponent.replace(/^\+/, ""), numericExponent };
}

function engineeringFromParts(coefficient, exponent) {
  const numericExponent = Number(exponent || 0);
  if (!Number.isFinite(numericExponent)) return { coefficient, exponent };
  const targetExponent = Math.floor(numericExponent / 3) * 3;
  const shift = numericExponent - targetExponent;
  const digits = coefficient.replace(".", "");
  const shifted = `${digits.slice(0, 1 + shift)}${digits.length > 1 + shift ? `.${digits.slice(1 + shift)}` : ""}`;
  return { coefficient: shifted.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, ""), exponent: String(targetExponent) };
}

function formatBreak(value, base = 10, precision = 48, notation = "scientific") {
  const decimal = value.decimal;
  const sign = decimal.sign < 0 ? "−" : "";
  const full = decimal.toString();
  if (decimal.sign === 0) return { sign: "", significand: "0", exponent: "", text: "0", full: "0" };
  if (value.knuth?.arrows) {
    const { base: knuthBase, arrows, height } = value.knuth;
    return { sign, significand: `${knuthBase} ${arrows} ${height}`, exponent: "", knuth: true, knuthBase, knuthArrows: arrows, knuthHeight: height, text: `${sign}${knuthBase} ${arrows} ${height}`, full };
  }
  if (decimal.layer === 0) {
    const raw = decimal.toString();
    let [coefficient, exponent = ""] = raw.split("e");
    exponent = exponent.replace(/^\+/, "");
    const cleanCoefficient = coefficient.replace(/^[+-]/, "").replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
    const numericExponent = Number(exponent || 0);
    const plain = notation === "auto" && numericExponent >= -6 && numericExponent <= 15;
    if (plain && exponent) {
      const digits = cleanCoefficient.replace(".", "");
      const point = cleanCoefficient.indexOf(".") < 0 ? cleanCoefficient.length : cleanCoefficient.indexOf(".");
      const target = point + numericExponent;
      const expanded = target <= 0 ? `0.${"0".repeat(-target)}${digits}` : target >= digits.length ? `${digits}${"0".repeat(target - digits.length)}` : `${digits.slice(0, target)}.${digits.slice(target)}`;
      return { sign, significand: expanded, exponent: "", text: `${sign}${expanded}`, full };
    }
    if (notation === "engineering" && exponent) {
      const parts = engineeringFromParts(cleanCoefficient, exponent);
      return { sign, significand: parts.coefficient, exponent: parts.exponent, text: `${sign}${parts.coefficient} × ${base}^${parts.exponent}`, full };
    }
    return { sign, significand: cleanCoefficient, exponent, text: `${sign}${cleanCoefficient}${exponent ? ` × ${base}^${exponent}` : ""}`, full };
  }
  if (decimal.layer === 1) {
    const exponent = String(decimal.mag);
    return { sign, significand: "1", exponent, text: `${sign}1 × ${base}^${exponent}`, full };
  }
  const arrowCount = decimal.layer;
  const dense = arrowCount > 3;
  const magnitude = String(decimal.mag);
  // Rendering is a separate safety boundary.  Never build an expanded tower
  // merely to discard it for compact notation: layer can be astronomically big.
  let expanded = magnitude;
  if (!dense) for (let index = 0; index < arrowCount; index += 1) expanded = `10^(${expanded})`;
  const collapsed = `10⟦${arrowCount}⟧${magnitude}`;
  return { sign, significand: dense ? collapsed : expanded, exponent: `layer ${arrowCount}`, tower: true, towerDepth: arrowCount, towerMagnitude: magnitude, towerExpanded: !dense && arrowCount <= 3, arrowCount, denseArrowCount: dense ? arrowCount : null, layer: arrowCount, magnitude, precisionLost: true, text: `${sign}${dense ? `10⟦${arrowCount}⟧^${magnitude}` : expanded}`, full };
}

export const breakEternityEngine = {
  id: "break_eternity.js",
  label: "BreakEternity · wide range",
  parse(expression) { return { expression, kind: "break-eternity" }; },
  evaluate(expression, references = new Map()) { return evaluateBreak(expression, references); },
  format(value, options = {}) { return value.kind === "break-eternity" ? formatBreak(value, options.base, options.precision, options.notation) : placeholderEngine.format(value, options); },
  inspect(value, options = {}) { return { ...this.format(value, options), representation: value.kind === "break-eternity" ? `layer ${value.decimal.layer}` : "placeholder", exactness: "wide-range approximation", precision: "~15 significant digits" }; },
  digitCount(value, base = 10) {
    const absolute = value.decimal.abs();
    if (absolute.sign === 0 || absolute.lt(1)) return { value: { kind: "break-eternity", decimal: new BreakDecimal(1), full: "1" }, certainty: "exact" };
    const logarithm = base === 10 ? absolute.log10() : absolute.log(base);
    const digits = logarithm.floor().add(1);
    return {
      value: { kind: "break-eternity", decimal: digits, full: digits.toString() },
      certainty: value.decimal.layer > 0 ? "magnitude-only" : "estimated",
    };
  },
  convertBase(value, base) { return this.format(value, { base }); },
};

function decimalExpandedLength(value) {
  const digits = value.sd();
  if (value.e >= 0) {
    const wholeDigits = value.e + 1;
    return Math.max(wholeDigits, digits) + (digits > wholeDigits ? 1 : 0);
  }
  return 2 + (-value.e - 1) + digits;
}

function formatDecimal(value, base = 10, precision = 48, notation = "auto") {
  const decimal = value.decimal;
  const sign = decimal.isNegative() ? "−" : "";
  const magnitude = decimal.abs();
  if (magnitude.isZero()) return { sign: "", significand: "0", exponent: "", text: "0", full: "0" };
  if (base === 2) return { sign, significand: magnitude.toBinary(Math.min(precision, 1000)), exponent: "", text: `${sign}${magnitude.toBinary(Math.min(precision, 1000))}`, full: `${sign}${magnitude.toString()}` };
  if (base === 16) return { sign, significand: magnitude.toHex(Math.min(precision, 1000)), exponent: "", text: `${sign}${magnitude.toHex(Math.min(precision, 1000))}`, full: `${sign}${magnitude.toString()}` };
  const digits = Math.max(1, Math.min(precision, 1000));
  const rounded = magnitude.toSignificantDigits(digits);
  const displayWasRounded = magnitude.sd() > digits;
  const showDecimal = notation === "decimal" && decimalExpandedLength(rounded) <= maximumDecimalDisplayLength;
  const raw = notation === "scientific" || notation === "engineering" ? rounded.toExponential() : showDecimal ? rounded.toFixed() : rounded.toString();
  let [coefficient, exponent = ""] = raw.split("e");
  exponent = exponent.replace(/^\+/, "");
  const cleanCoefficient = coefficient.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  const numericExponent = Number(exponent || 0);
  if ((notation === "auto" && numericExponent >= -6 && numericExponent <= 15) || showDecimal) {
    let plain = rounded.toFixed().replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
    // A display precision cap must not manufacture a long tail of apparent
    // significant zeroes.  Keep the meaningful prefix and mark the omission.
    if (displayWasRounded && !plain.includes(".")) plain = `${plain.replace(/0+$/, "")}…`;
    return { sign, significand: plain, exponent: "", text: `${sign}${plain}`, full: `${sign}${magnitude.toString()}`, truncated: displayWasRounded };
  }
  if (notation === "engineering" && exponent) {
    const parts = scientificParts(magnitude, precision, true);
    return { sign, significand: parts.coefficient, exponent: parts.exponent, text: `${sign}${parts.coefficient} × 10^${parts.exponent}`, full: `${sign}${magnitude.toString()}` };
  }
  return { sign, significand: cleanCoefficient, exponent, text: `${sign}${cleanCoefficient}${exponent ? ` × 10^${exponent}` : ""}`, full: `${sign}${magnitude.toString()}` };
}

export const decimalEngine = {
  id: "decimal.js",
  label: "Decimal · high precision",
  capabilities: { maxExponent: 9e15, precision: "configurable", layered: false, hyper: false },
  parse(expression) { return { expression, kind: "decimal.js" }; },
  evaluate(expression, references = new Map(), options = {}) {
    const Ctor = Decimal.clone({ precision: 1000, maxE: 9e15, minE: -9e15 });
    return evaluateBreak(expression, references, Ctor, "decimal.js");
  },
  format(value, options = {}) { return value.kind === "decimal.js" ? formatDecimal(value, options.base, options.precision, options.notation) : breakEternityEngine.format(value, options); },
  inspect(value, options = {}) { return { ...this.format(value, options), engine: "decimal.js", representation: "arbitrary-precision decimal", exactness: value.exactInteger ? "exact integer" : "rounded to 1,000 significant digits", precision: "1,000 significant digits internal" }; },
  digitCount(value, base = 10) {
    const absolute = value.decimal.abs();
    if (absolute.isZero() || absolute.lt(1)) return { value: { kind: "decimal.js", decimal: new Decimal(1), full: "1" }, certainty: "exact" };
    if (base === 10 && Number.isSafeInteger(absolute.e)) {
      const digits = new Decimal(absolute.e).add(1);
      return { value: { kind: "decimal.js", decimal: digits, full: digits.toString() }, certainty: "exact" };
    }
    const digits = absolute.log(base).floor().add(1);
    return { value: { kind: "decimal.js", decimal: digits, full: digits.toString() }, certainty: "estimated" };
  },
  convertBase(value, base) { return this.format(value, { base }); },
};

function looksBeyondDecimal(expression) {
  return /↑{3,}|\^\^\^|\b(?:iteratedexp|iteratedlog|slog|pent)\b/i.test(expression) || /(?:\^|e)\s*[+-]?\d{16,}/i.test(expression);
}

export const engineRegistry = [decimalEngine, breakEternityEngine];

// Decimal.js intentionally rounds arithmetic to its configured precision.  For
// primality, "looks like an integer" is not enough: we only classify values we
// can rebuild with native arbitrary-size integer arithmetic.
const exactIntegerDigitLimit = 1000;
const exactIntegerBitLimit = 4096;

function exactIntegerExpression(expression, references = new Map()) {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const guard = (integer) => {
    if (integer.toString().replace("-", "").length > exactIntegerDigitLimit || integer.toString(2).length > exactIntegerBitLimit) throw new Error("exact integer is outside the primality range");
    return integer;
  };
  const referencedInteger = (token) => {
    const reference = references.get(token);
    if (reference && typeof reference === "object" && /^-?\d+$/.test(reference.exactInteger ?? "")) return BigInt(reference.exactInteger);
    throw new Error("history value is not an exact integer");
  };
  const primary = () => {
    const token = take();
    if (token === "(") { const result = addSub(); if (take() !== ")") throw new Error("missing parenthesis"); return result; }
    if (token?.startsWith("@history")) return referencedInteger(token);
    if (/^\d+$/.test(token)) return BigInt(token);
    throw new Error("not an integer-only expression");
  };
  const unary = () => {
    if (peek() === "−" || peek() === "-") { take(); return -unary(); }
    if (peek() === "+") { take(); return unary(); }
    let result = primary();
    while (peek() === "!") {
      take();
      if (result < 0n || result > 449n) throw new Error("factorial outside exact primality range");
      let factorial = 1n;
      for (let index = 2n; index <= result; index += 1n) factorial *= index;
      result = guard(factorial);
    }
    return result;
  };
  const power = () => {
    const left = unary();
    if (peek() === "^" || peek() === "↑") {
      take();
      const right = power();
      if (right < 0n || right > 4096n) throw new Error("power outside exact primality range");
      return guard(left ** right);
    }
    return left;
  };
  const mulDiv = () => {
    let result = power();
    while (["*", "×", "/", "÷", "%", "mod"].includes(peek())) {
      const operation = take(); const right = power();
      if (right === 0n) throw new Error("division by zero");
      if (operation === "/" || operation === "÷") { if (result % right !== 0n) throw new Error("not an exact integer"); result /= right; }
      else if (operation === "%" || operation === "mod") result %= right;
      else result = guard(result * right);
    }
    return result;
  };
  function addSub() {
    let result = mulDiv();
    while (["+", "−", "-"].includes(peek())) { const operation = take(); const right = mulDiv(); result = guard(operation === "+" ? result + right : result - right); }
    return result;
  }
  const result = guard(addSub());
  if (position !== tokens.length) throw new Error("not an integer-only expression");
  return result;
}

function attachExactInteger(value, expression, references) {
  if (value.kind !== "decimal.js" || !value.decimal.isInteger()) return value;
  try {
    const exactInteger = exactIntegerExpression(expression, references).toString();
    if (value.decimal.toFixed() !== exactInteger) return value;
    return { ...value, exactInteger };
  } catch { return value; }
}

export function evaluateAutomatically(expression, references = new Map(), options = {}) {
  const structuralHierarchy = expression.trim().match(/^fgh([3-5])\(\s*(\d+)\s*\)$/i);
  if (structuralHierarchy) {
    const level = Number(structuralHierarchy[1]);
    const argument = structuralHierarchy[2];
    if (level >= 4 || Number(argument) > 4) return { kind: "hierarchy", level, argument, full: `F_${level}(${argument})`, engineId: "wainer-structural", engineLabel: "Wainer hierarchy · structural" };
  }
  const ordered = looksBeyondDecimal(expression) ? [breakEternityEngine, decimalEngine] : engineRegistry;
  let lastError;
  for (const engine of ordered) {
    try {
      const value = engine.evaluate(expression, references, options);
      return attachExactInteger({ ...value, engineId: engine.id ?? "placeholder", engineLabel: engine.label ?? "Wide range" }, expression, references);
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("No compatible engine");
}

export function formatAutomatically(value, options = {}) {
  if (value.kind === "hierarchy") return { sign: "", significand: `F${value.level}(${value.argument})`, exponent: "", text: `F${value.level}(${value.argument})`, full: value.full, hierarchy: true };
  const formatted = value.kind === "decimal.js"
    ? decimalEngine.format(value, options)
    : value.kind === "break-eternity"
      ? breakEternityEngine.format(value, options)
      : placeholderEngine.format(value, options);
  if (!options.groupDigits || options.base !== 10 || formatted.exponent || formatted.tower || formatted.knuth || !/^\d+(?:\.\d+)?$/.test(formatted.significand)) return formatted;
  const [whole, fraction] = formatted.significand.split(".");
  const grouped = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
  return { ...formatted, significand: grouped, text: `${formatted.sign}${grouped}` };
}

// Clipboard output is a deliberate representation choice, rather than an
// accidental Decimal.js toString() serialization.  Use the engine/display
// ceiling while preserving the user's selected base and notation.
export function formatForCopy(value, options = {}) {
  return formatAutomatically(value, { ...options, precision: 1000, groupDigits: options.groupDigits ?? false }).text;
}

export function inspectAutomatically(value, options = {}) {
  if (value.kind === "hierarchy") return { ...formatAutomatically(value, options), engine: "Wainer hierarchy", representation: `F${value.level} structural form`, exactness: "symbolic exact", precision: "not expanded" };
  if (value.kind === "decimal.js") return decimalEngine.inspect(value, options);
  if (value.kind === "break-eternity") return { ...breakEternityEngine.inspect(value, options), engine: value.engineLabel ?? "break_eternity.js" };
  return placeholderEngine.inspect(value, options);
}

export function digitCountAutomatically(value, base = 10) {
  try {
    if (value.kind === "decimal.js") return decimalEngine.digitCount(value, base);
    if (value.kind === "break-eternity") return breakEternityEngine.digitCount(value, base);
  } catch { /* An unsupported alternate engine simply omits this optional inspection detail. */ }
  return null;
}

function modularPower(base, exponent, modulus) {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) { if (power & 1n) result = (result * factor) % modulus; factor = (factor * factor) % modulus; power >>= 1n; }
  return result;
}

function millerRabin(integer, bases) {
  if (integer < 2n) return false;
  for (const prime of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { if (integer === prime) return true; if (integer % prime === 0n) return false; }
  let oddPart = integer - 1n; let twos = 0;
  while (oddPart % 2n === 0n) { oddPart /= 2n; twos += 1; }
  for (const rawBase of bases) {
    const base = rawBase % integer;
    if (base < 2n) continue;
    let witness = modularPower(base, oddPart, integer);
    if (witness === 1n || witness === integer - 1n) continue;
    let passed = false;
    for (let step = 1; step < twos; step += 1) { witness = (witness * witness) % integer; if (witness === integer - 1n) { passed = true; break; } }
    if (!passed) return false;
  }
  return true;
}

export function analyzePrimality(value) {
  if (!value?.exactInteger || !/^-?\d+$/.test(value.exactInteger)) return null;
  const integer = BigInt(value.exactInteger);
  if (integer < 2n) return { kind: "not-prime", certainty: "verified", method: "integer definition" };
  const uint64Limit = 18446744073709551616n;
  if (integer < uint64Limit) {
    const prime = millerRabin(integer, [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n]);
    return { kind: prime ? "prime" : "composite", certainty: "verified", method: "deterministic Miller–Rabin (< 2⁶⁴)" };
  }
  if (value.exactInteger.length > exactIntegerDigitLimit) return null;
  const prime = millerRabin(integer, [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n]);
  return { kind: prime ? "prime" : "composite", certainty: prime ? "probable" : "verified", method: prime ? "16-round Miller–Rabin" : "Miller–Rabin witness" };
}

export function evaluateWithAnalysis(expression, references = new Map(), options = {}) {
  const value = evaluateAutomatically(expression, references, options);
  const primality = analyzePrimality(value);
  return primality ? { ...value, primality } : value;
}

// Browser storage holds plain JSON, so preserve the engine value as a string and
// rebuild the appropriate numeric object when a calculator session is restored.
export function serializeValue(value) {
  if (!value) return null;
  if (value.kind === "decimal.js" || value.kind === "break-eternity") {
    return { ...value, decimal: value.decimal?.toString?.() ?? value.full };
  }
  return value;
}

export function deserializeValue(value) {
  if (!value) return null;
  if (value.kind === "decimal.js") return { ...value, decimal: new Decimal(value.decimal) };
  if (value.kind === "break-eternity") return { ...value, decimal: new BreakDecimal(value.decimal) };
  return value;
}
