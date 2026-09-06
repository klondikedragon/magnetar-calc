// Engine boundary. The UI should only depend on these methods; alternate
// arbitrary-precision and logarithmic backends can be added behind this API.
import BreakDecimal from "break_eternity.js";
import Decimal from "decimal.js";
import { astToExpression, parseExpression, tokenizeExpression } from "./expressionLanguage.js";
import { deserializeExactValue, exactParts, isExactValue, serializeExactValue, tryEvaluateExact } from "./exactValues.js";
import {
  deserializeStructuralValue,
  formatStructuralPower,
  isStructuralPower,
  serializeStructuralValue,
  structuralPowerFacts,
  structuralPowerProvenance,
  tryEvaluateStructuralPower,
} from "./structuralValues.js";
import {
  deserializeExtendedScale,
  digitCountExtendedScale,
  formatExtendedScale,
  inspectExtendedScale,
  isExtendedScale,
  serializeExtendedScale,
  tryEvaluateExtendedScale,
} from "./extendedScale.js";

function formatNumber(number, base, precision = 48, notation = "auto") {
  if (!Number.isFinite(number)) return { sign: "", significand: "Not a finite number", exponent: "", text: "Not a finite number", full: String(number) };
  const sign = number < 0 ? "−" : "";
  const absolute = Math.abs(number);
  if (precision === 0 && base === 10) {
    const rounded = Math.round(absolute);
    const raw = notation === "scientific" || notation === "engineering" || rounded >= 1e9 ? rounded.toExponential(0) : String(rounded);
    const [significand, exponent = ""] = raw.split("e");
    return { sign, significand, exponent: exponent.replace(/^\+/, ""), text: `${sign}${significand}${exponent ? ` × 10^${exponent.replace(/^\+/, "")}` : ""}`, full: String(number) };
  }
  if (base === 2 && Number.isInteger(number)) return { sign, significand: `0b${absolute.toString(2)}`, exponent: "", text: `${sign}0b${absolute.toString(2)}`, full: `${sign}0b${absolute.toString(2)}` };
  if (base === 16 && Number.isInteger(number)) return { sign, significand: `0x${absolute.toString(16).toUpperCase()}`, exponent: "", text: `${sign}0x${absolute.toString(16).toUpperCase()}`, full: `${sign}0x${absolute.toString(16).toUpperCase()}` };
  const significant = Number(absolute.toPrecision(Math.min(16, precision))).toString();
  const raw = notation === "scientific" || notation === "engineering" || absolute >= 1e9 || (absolute > 0 && absolute < 1e-6) ? absolute.toExponential(Math.min(15, Math.max(1, precision - 1))).replace(/(\.[0-9]*?)0+e/, "$1e") : significant;
  let [coefficient, exponent = ""] = raw.split("e");
  exponent = exponent.replace(/^\+/, "");
  return { sign, significand: coefficient, exponent, text: exponent ? `${sign}${coefficient} × ${base}^${exponent}` : `${sign}${coefficient}`, full: String(number) };
}

function formatExactInteger(value, base = 10, precision = 48, notation = "auto") {
  const integer = exactParts(value).numerator;
  const sign = integer < 0n ? "−" : "";
  const digits = (integer < 0n ? -integer : integer).toString(base).toUpperCase();
  const shouldCompact = base === 10 && digits.length > maximumDecimalDisplayLength;
  if (base !== 10 || (!["scientific", "engineering"].includes(notation) && !shouldCompact) || digits === "0") {
    return { sign, significand: digits, exponent: "", text: `${sign}${digits}`, full: `${sign}${digits}`, exactIntegerDisplay: true };
  }
  const scientificExponent = digits.length - 1;
  const displayDigits = Math.max(1, Math.min(digits.length, Math.max(1, precision + 1)));
  let coefficient = digits.slice(0, displayDigits);
  if (coefficient.length > 1) coefficient = `${coefficient[0]}.${coefficient.slice(1)}`;
  let exponent = scientificExponent;
  if (notation === "engineering") {
    const shift = scientificExponent % 3;
    const engineeringDigits = Math.max(1, Math.min(digits.length, displayDigits + shift));
    coefficient = digits.slice(0, engineeringDigits);
    if (coefficient.length > shift + 1) coefficient = `${coefficient.slice(0, shift + 1)}.${coefficient.slice(shift + 1)}`;
    exponent -= shift;
  }
  const truncated = digits.length > displayDigits;
  if (truncated) coefficient = `${coefficient}…`;
  return { sign, significand: coefficient, exponent: String(exponent), text: `${sign}${coefficient} × 10^${exponent}`, full: `${sign}${digits}`, truncated };
}

function formatExactRational(value, base = 10, precision = 48, notation = "auto") {
  const { numerator, denominator } = exactParts(value);
  if (denominator === 1n) return formatExactInteger(value, base, precision, notation);
  if (base !== 10) {
    const sign = numerator < 0n ? "−" : "";
    const top = (numerator < 0n ? -numerator : numerator).toString(base).toUpperCase();
    const bottom = denominator.toString(base).toUpperCase();
    return { sign, significand: `${top}/${bottom}`, exponent: "", text: `${sign}${top}/${bottom}`, full: `${numerator}/${denominator}`, exactRationalDisplay: true };
  }
  const calculationPrecision = Math.max(48, Math.min(defaultCalculationPrecision, Math.max(precision + 20, 80)));
  const Ctor = Decimal.clone({ precision: calculationPrecision, maxE: 9e15, minE: -9e15 });
  const decimal = new Ctor(numerator.toString()).div(denominator.toString());
  return { ...formatDecimal({ kind: "decimal.js", decimal }, base, precision, notation), full: `${numerator}/${denominator}`, exactRationalDisplay: true };
}

function formatExact(value, options = {}) {
  if (value.kind === "exact-integer") return formatExactInteger(value, options.base ?? 10, options.precision ?? 48, options.notation ?? "auto");
  return formatExactRational(value, options.base ?? 10, options.precision ?? 48, options.notation ?? "auto");
}

// Compatibility numeric shadow for existing calculation paths. The exact
// BigInt components remain authoritative; this Decimal is never used to claim
// that a rational has become exact.
function hydrateExactValue(value) {
  if (!isExactValue(value) || value.decimal) return value;
  const { numerator, denominator } = exactParts(value);
  const Ctor = Decimal.clone({ precision: defaultCalculationPrecision, maxE: 9e15, minE: -9e15 });
  return { ...value, decimal: new Ctor(numerator.toString()).div(denominator.toString()) };
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

const maximumTetrationHeight = 10000000;
export const defaultCalculationPrecision = 1_000;
// Decimal.js ships a finite π constant for trigonometric reduction. When
// its guard digits exhaust that constant, retry in its verified 500-digit
// range instead of silently falling through to the ~15-digit wide-range engine.
const maximumDecimalTrigonometricPrecision = 500;
// The view can request a wider display range, but normal calculations never
// manufacture digits beyond the stored 1,000-digit Decimal value.
const maximumDecimalDisplayLength = 10_000;
const maximumAutoExpandedLength = 64;
export const exportPrecision = 10_000_000;

function decimalPrecisionPlan(expression, options = {}) {
  const maximumDigits = Number.isInteger(options.calculationPrecision)
    ? Math.max(1, Math.min(options.calculationPrecision, 1e9))
    : defaultCalculationPrecision;
  const targetDigits = Number.isInteger(options.targetPrecision)
    ? Math.max(1, Math.min(options.targetPrecision, maximumDigits))
    : maximumDigits;
  // Subtraction and mixed addition are the first places where cancellation can
  // erase leading digits. The caller's calculationPrecision remains a hard
  // ceiling; a future UI may request fewer target digits while retaining this
  // small, deterministic guard band.
  const cancellationSites = (expression.match(/[+\-−]/g) ?? []).length;
  const guardDigits = Math.min(64, 16 + (cancellationSites * 4));
  const workingDigits = Math.min(maximumDigits, targetDigits + guardDigits);
  return { targetDigits, guardDigits: workingDigits > targetDigits ? guardDigits : 0, workingDigits, maximumDigits };
}

function tokenize(source) {
  return tokenizeExpression(source).filter((token) => token.type !== "eof").map((token) => token.value);
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
  if (name === "catalan") { let result = 1n; for (let index = 0; index < n; index += 1) result = (result * BigInt(2 * ((2 * index) + 1))) / BigInt(index + 2); return asCtor(result); }
  if (name === "binomial") { const k = naturalArgument(args[1], "binomial", n); if (k > n) throw new Error("binomial requires k <= n"); let result = 1n; for (let index = 1; index <= Math.min(k, n - k); index += 1) result = (result * BigInt(n - index + 1)) / BigInt(index); return asCtor(result); }
  if (name === "stirling2") { const k = naturalArgument(args[1], "stirling2", n); const rows = Array(k + 1).fill(0n); rows[0] = 1n; for (let row = 1; row <= n; row += 1) { for (let column = Math.min(row, k); column >= 2; column -= 1) rows[column] = rows[column - 1] + (BigInt(column) * rows[column]); if (k >= 1) rows[1] = 1n; } return asCtor(rows[k]); }
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

function signedIntegerArgument(value, label, minimum = -10_000, maximum = 10_000) {
  const number = value.toNumber();
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new Error(`${label} requires an integer between ${minimum.toLocaleString()} and ${maximum.toLocaleString()}`);
  return number;
}

function numericMethod(value, method) {
  if (typeof value[method] !== "function") throw new Error(`${method} is outside the current engine range`);
  return value[method]();
}

function roundDecimal(value, places, Ctor) {
  if (typeof value.toDecimalPlaces === "function" && places >= 0) return value.toDecimalPlaces(places);
  const scale = new Ctor(10).pow(Math.abs(places));
  const scaled = places >= 0 ? value.mul(scale) : value.div(scale);
  return numericMethod(scaled, "round").mul(places >= 0 ? new Ctor(1).div(scale) : scale);
}

function evaluateBreakLegacy(expression, references = new Map(), Ctor = BreakDecimal, kind = "break-eternity") {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const valueFor = (token) => {
    if (references.has(token)) {
      const reference = references.get(token);
      // Worker references are restored as calculator value wrappers. Always
      // rebuild them through this evaluation's constructor so Decimal clones
      // and BreakEternity use their own compatible numeric instance.
      if (isExactValue(reference)) {
        const { numerator, denominator } = exactParts(reference);
        return new Ctor(numerator.toString()).div(new Ctor(denominator.toString()));
      }
      const numericReference = reference?.decimal ?? reference;
      return new Ctor(numericReference?.toString?.() ?? String(numericReference));
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
      if (token.toLowerCase() === "min") return args.reduce((lowest, value) => value.lt(lowest) ? value : lowest);
      if (token.toLowerCase() === "max") return args.reduce((highest, value) => value.gt(highest) ? value : highest);
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

function knuthMetadata(ast) {
  if (ast.type !== "binary" || !["hyperoperation-knuth-double", "hyperoperation-unavailable"].includes(ast.implementationId)) return null;
  if (ast.left.type !== "number" || ast.right.type !== "number") return null;
  return { base: ast.left.raw, arrows: ast.operator.replaceAll("^", "↑"), height: ast.right.raw };
}

function evaluateBreak(expression, references = new Map(), Ctor = BreakDecimal, kind = "break-eternity") {
  const ast = parseExpression(expression);
  const valueForReference = (token) => {
    if (!references.has(token)) throw new Error("unknown history reference");
    const reference = references.get(token);
    if (isExactValue(reference)) {
      const { numerator, denominator } = exactParts(reference);
      return new Ctor(numerator.toString()).div(new Ctor(denominator.toString()));
    }
    const numericReference = reference?.decimal ?? reference;
    return new Ctor(numericReference?.toString?.() ?? String(numericReference));
  };
  const evaluateNode = (node) => {
    if (node.type === "group") return evaluateNode(node.value);
    if (node.type === "number") return new Ctor(node.raw);
    if (node.type === "reference") return valueForReference(node.token);
    if (node.type === "atom") return engineConstant(node.name, Ctor);
    if (node.type === "unary") {
      const value = evaluateNode(node.value);
      if (node.implementationId === "arithmetic-negative") return value.neg();
      if (node.implementationId === "arithmetic-positive") return value;
      if (node.implementationId === "arithmetic-sqrt") return value.sqrt();
      throw new Error("unknown unary operation");
    }
    if (node.type === "postfix") {
      if (node.implementationId === "arithmetic-factorial") return factorialValue(evaluateNode(node.value), Ctor);
      throw new Error("unknown postfix operation");
    }
    if (node.type === "binary") {
      const left = evaluateNode(node.left);
      const right = evaluateNode(node.right);
      if (node.implementationId === "arithmetic-add") return left.add(right);
      if (node.implementationId === "arithmetic-subtract") return left.sub(right);
      if (node.implementationId === "arithmetic-multiply") return left.mul(right);
      if (node.implementationId === "arithmetic-divide") return left.div(right);
      if (node.implementationId === "arithmetic-modulo") return left.mod(right);
      if (node.implementationId === "arithmetic-power" || node.implementationId === "hyperoperation-knuth-up") return left.pow(right);
      if (node.implementationId === "hyperoperation-knuth-double") return Ctor === BreakDecimal ? tetrateBreak(left, right) : tetrateDecimal(left, right, Ctor);
      if (node.implementationId === "hyperoperation-unavailable") throw new Error("hyper-operation not available in this backend");
      throw new Error("unknown binary operation");
    }
    if (node.type === "call") {
      if (!node.implementationId) throw new Error("unknown function");
      const args = node.args.map(evaluateNode);
      if (node.implementationId === "arithmetic-sqrt") return args[0].sqrt();
      if (node.implementationId === "trigonometry-sin") return args[0].sin();
      if (node.implementationId === "trigonometry-cos") return args[0].cos();
      if (node.implementationId === "trigonometry-tan") return args[0].tan();
      if (node.implementationId === "logarithm-natural") return args[0].ln();
      if (node.implementationId === "logarithm-base-ten") return Ctor === BreakDecimal ? args[0].log10() : args[0].log(10);
      if (node.implementationId === "arithmetic-abs") return args[0].abs();
      if (node.implementationId === "exponential-exp") return args[0].exp();
      if (node.implementationId === "scientific-floor") return numericMethod(args[0], "floor");
      if (node.implementationId === "scientific-ceil") return numericMethod(args[0], "ceil");
      if (node.implementationId === "scientific-trunc") return numericMethod(args[0], "trunc");
      if (node.implementationId === "scientific-cube-root") return numericMethod(args[0], "cbrt");
      if (node.implementationId === "logarithm-base-two") return numericMethod(args[0], "log2");
      if (node.implementationId === "scientific-round") return roundDecimal(args[0], args.length > 1 ? signedIntegerArgument(args[1], "round places") : 0, Ctor);
      if (node.implementationId === "scientific-round-significant") {
        const digits = signedIntegerArgument(args[1], "significant digits", 1, 10_000);
        if (typeof args[0].toSignificantDigits !== "function") throw new Error("significant-digit rounding is outside the current engine range");
        return args[0].toSignificantDigits(digits);
      }
      if (node.implementationId === "scientific-round-to") {
        if (!args[1] || !args[1].gt(0)) throw new Error("round increment must be positive");
        if (typeof args[0].toNearest === "function") return args[0].toNearest(args[1]);
        return numericMethod(args[0].div(args[1]), "round").mul(args[1]);
      }
      if (node.implementationId === "trigonometry-atan2") {
        if (typeof Ctor.atan2 === "function") return Ctor.atan2(args[0], args[1]);
        if (typeof args[0].atan2 === "function") return args[0].atan2(args[1]);
        throw new Error("atan2 is outside the current engine range");
      }
      if (node.implementationId === "trigonometry-radians") return args[0].mul(engineConstant("pi", Ctor)).div(180);
      if (node.implementationId === "trigonometry-degrees") return args[0].mul(180).div(engineConstant("pi", Ctor));
      const namedMethods = {
        "trigonometry-asin": "asin", "trigonometry-acos": "acos", "trigonometry-atan": "atan",
        "trigonometry-sinh": "sinh", "trigonometry-cosh": "cosh", "trigonometry-tanh": "tanh",
        "trigonometry-asinh": "asinh", "trigonometry-acosh": "acosh", "trigonometry-atanh": "atanh",
      };
      if (namedMethods[node.implementationId]) return numericMethod(args[0], namedMethods[node.implementationId]);
      if (node.implementationId === "arithmetic-min") return args.reduce((lowest, value) => value.lt(lowest) ? value : lowest);
      if (node.implementationId === "arithmetic-max") return args.reduce((highest, value) => value.gt(highest) ? value : highest);
      if (node.implementationId.startsWith("sequence-")) return bigIntegerSequence(node.name, args, Ctor);
      if (node.implementationId === "combinatorics-stirling-second" || node.implementationId === "combinatorics-binomial") return bigIntegerSequence(node.name, args, Ctor);
      if (node.implementationId.startsWith("hierarchy-fgh")) return wainerFinite(Number(node.name.at(-1)), args[0], Ctor);
      throw new Error("unknown function");
    }
    throw new Error("unsupported expression");
  };
  const result = evaluateNode(ast);
  if (typeof result.isFinite === "function" && !result.isFinite()) throw new Error("engine range exceeded");
  return { kind, decimal: result, full: result.toString(), knuth: knuthMetadata(ast) };
}

function scientificParts(magnitude, precision, engineering = false) {
  const rounded = magnitude.toSignificantDigits(Math.max(1, Math.min(precision, defaultCalculationPrecision)));
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
  evaluate(expression, references = new Map()) {
    const value = evaluateBreak(expression, references);
    return {
      ...value,
      quality: {
        certainty: value.decimal.layer > 0 ? "magnitude-only" : "estimated",
        representation: "layered floating point",
        retainedDigits: "~15",
      },
    };
  },
  format(value, options = {}) { return value.kind === "break-eternity" ? formatBreak(value, options.base, options.precision, options.notation) : placeholderEngine.format(value, options); },
  inspect(value, options = {}) { return { ...this.format(value, options), representation: value.kind === "break-eternity" ? `layer ${value.decimal.layer}` : "placeholder", exactness: value.quality?.certainty === "magnitude-only" ? "magnitude-only approximation" : "wide-range approximation", precision: "~15 significant digits" }; },
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
  // Decimal.isInteger alone may merely reflect a rounded value. Only values
  // independently rebuilt as an integer get Auto's full-integer treatment.
  if (value.exactInteger && notation === "auto") {
    const integer = BigInt(value.exactInteger);
    const significand = base === 10 ? integer.toString().replace("-", "") : (integer < 0n ? -integer : integer).toString(base).toUpperCase();
    return { sign, significand, exponent: "", text: `${sign}${significand}`, full: `${sign}${significand}`, exactIntegerDisplay: true };
  }
  if (base === 2 || base === 16) {
    const radixIntegerDigits = Math.max(0, Number(magnitude.log(base).floor().toString()) + 1);
    const digits = Math.min(defaultCalculationPrecision, Math.max(1, radixIntegerDigits + Math.max(0, precision)));
    const significand = base === 2 ? magnitude.toBinary(digits) : magnitude.toHex(digits);
    return { sign, significand, exponent: "", text: `${sign}${significand}`, full: `${sign}${magnitude.toString()}` };
  }
  const decimalPlaces = Math.max(0, Math.min(precision, defaultCalculationPrecision));
  const fixedRounded = magnitude.toDecimalPlaces(decimalPlaces);
  const expandedLength = decimalExpandedLength(fixedRounded);
  const autoExpandedLimit = Math.max(16, Math.min(maximumAutoExpandedLength, decimalPlaces + 2));
  const showDecimal = (notation === "decimal" && expandedLength <= maximumDecimalDisplayLength)
    || (notation === "auto" && expandedLength <= autoExpandedLimit);
  // Auto chooses the more readable expanded form when it fits. Exactness stays
  // in inspection metadata; a rounded Decimal result such as 4 * 6.0 should
  // still read as 24 rather than 2.4 × 10^1.
  const raw = showDecimal ? fixedRounded.toFixed(decimalPlaces) : magnitude.toExponential(decimalPlaces);
  let [coefficient, exponent = ""] = raw.split("e");
  exponent = exponent.replace(/^\+/, "");
  const cleanCoefficient = coefficient.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  if (showDecimal) return { sign, significand: cleanCoefficient, exponent: "", text: `${sign}${cleanCoefficient}`, full: `${sign}${magnitude.toString()}`, truncated: magnitude.decimalPlaces() > decimalPlaces };
  if (notation === "engineering" && exponent) {
    const parts = engineeringFromParts(cleanCoefficient, exponent);
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
    const plan = decimalPrecisionPlan(expression, options);
    const requestedPrecision = plan.workingDigits;
    const hasTrigonometricCall = /\b(?:sin|cos|tan)\s*\(/i.test(expression);
    const evaluateAtPrecision = (calculationPrecision) => {
      const Ctor = Decimal.clone({ precision: calculationPrecision, maxE: 9e15, minE: -9e15 });
      return {
        ...evaluateBreak(expression, references, Ctor, "decimal.js"),
        calculationPrecision,
        quality: {
          certainty: "rounded",
          representation: "decimal",
          targetDigits: plan.targetDigits,
          guardDigits: Math.max(0, calculationPrecision - plan.targetDigits),
          workingDigits: calculationPrecision,
          retainedDigits: calculationPrecision,
        },
      };
    };

    try {
      return evaluateAtPrecision(requestedPrecision);
    } catch (error) {
      if (hasTrigonometricCall && requestedPrecision > maximumDecimalTrigonometricPrecision) {
        return evaluateAtPrecision(maximumDecimalTrigonometricPrecision);
      }
      throw error;
    }
  },
  format(value, options = {}) { return value.kind === "decimal.js" ? formatDecimal(value, options.base, options.precision, options.notation) : breakEternityEngine.format(value, options); },
  inspect(value, options = {}) {
    const calculationPrecision = value.quality?.workingDigits ?? value.calculationPrecision ?? 1000;
    const targetDigits = value.quality?.targetDigits ?? calculationPrecision;
    return {
      ...this.format(value, options),
      engine: "decimal.js",
      representation: "arbitrary-precision decimal",
      exactness: value.quality?.certainty === "exact" || value.exactInteger ? "exact integer" : `rounded to ${calculationPrecision.toLocaleString()} significant digits`,
      precision: calculationPrecision === targetDigits
        ? `${calculationPrecision.toLocaleString()} significant digits internal`
        : `${calculationPrecision.toLocaleString()} working digits; ${targetDigits.toLocaleString()} target`,
    };
  },
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

const steinhausImplementations = new Set([
  "steinhaus-triangle", "steinhaus-square", "steinhaus-pentagon", "steinhaus-circle",
  "steinhaus-polygon", "steinhaus-canonical", "steinhaus-megagon",
]);

function steinhausSides(value) {
  if (value.kind === "mega") return { kind: "named", name: "Mega" };
  return { kind: "integer", value: String(value.value) };
}

function steinhausValue(base, nesting, sides, options = {}) {
  const normalizedBase = String(base);
  const displayedBase = options.parenthesizeBase ? `(${normalizedBase})` : normalizedBase;
  const normalizedNesting = String(nesting);
  const normalizedSides = steinhausSides(sides);
  const canonicalSides = normalizedSides.kind === "named" ? normalizedSides.name : normalizedSides.value;
  const canonical = `SM(${normalizedBase}; ${normalizedNesting}; ${canonicalSides})`;
  const name = options.name ?? null;
  const shape = options.shape ?? (normalizedSides.kind === "integer" ? Number(normalizedSides.value) : "megagon");
  const visual = options.visual ?? (shape === 3 ? "triangle" : shape === 4 ? "square" : shape === 5 ? "pentagon" : shape === "megagon" ? "megagon" : "polygon");
  const short = name ?? (visual === "triangle" ? `△${displayedBase}` : visual === "square" ? `□${displayedBase}` : visual === "circle" ? `○${displayedBase}` : visual === "pentagon" ? `⬠${displayedBase}` : visual === "megagon" ? `Mega-gon(${normalizedBase})` : `P${canonicalSides}(${displayedBase})`);
  const derivation = options.derivation ?? (name === "Mega"
    ? "○2 = □²(2) = □256 = △²⁵⁶(256)"
    : name === "Megiston"
      ? "○10 = □¹⁰(10)"
      : name === "Moser"
        ? "Mega-gon(2) = SM(2; 1; Mega)"
        : visual === "triangle"
          ? `△${normalizedBase} = ${normalizedBase}^${normalizedBase}`
          : visual === "square"
            ? `□${normalizedBase} = △^${normalizedBase}(${normalizedBase})`
            : visual === "circle"
              ? `○${normalizedBase} = □^${normalizedBase}(${normalizedBase})`
              : `P${canonicalSides}(${normalizedBase})`);
  return {
    kind: "steinhaus-moser",
    construction: { base: normalizedBase, nesting: normalizedNesting, sides: normalizedSides },
    name,
    shape,
    visual,
    short,
    canonical,
    derivation,
    full: canonical,
    engineId: "steinhaus-moser-structural",
    engineLabel: "Steinhaus–Moser · structural",
    quality: { certainty: "symbolic-exact", representation: "structural construction", retainedDigits: "not expanded" },
  };
}

function steinhausInteger(ast, references, label, options) {
  // Arguments may be ordinary expressions or a safely reduced inner
  // construction. Route them through the normal dispatcher instead of asking
  // Decimal.js to understand every catalog function itself.
  const value = evaluateAutomatically(astToExpression(ast), references, options);
  if (value.kind === "exact-integer") {
    const integer = exactParts(value).numerator;
    if (integer < 1n) throw new Error(`${label} requires a positive exact integer`);
    if (integer.toString().length > 6) throw new Error(`${label} is outside the structural input range`);
    return integer;
  }
  if (value.kind !== "decimal.js") throw new Error(`${label} requires a positive exact integer`);
  if (!value.decimal.isInteger() || value.decimal.lt(1)) throw new Error(`${label} requires a positive exact integer`);
  const text = value.decimal.toFixed(0);
  if (!/^\d+$/.test(text) || text.length > 6) throw new Error(`${label} is outside the structural input range`);
  return BigInt(text);
}

function structuralSteinhausNotation(ast) {
  if (ast.type === "atom") {
    if (ast.implementationId === "steinhaus-mega") return "Mega";
    if (ast.implementationId === "steinhaus-megiston") return "Megiston";
    if (ast.implementationId === "steinhaus-moser") return "Moser";
    return null;
  }
  if (ast.type !== "call" || !steinhausImplementations.has(ast.implementationId)) return null;
  const base = structuralSteinhausNotation(ast.args[0]) ?? astToExpression(ast.args[0]);
  if (ast.implementationId === "steinhaus-triangle") return `△(${base})`;
  if (ast.implementationId === "steinhaus-square") return `□(${base})`;
  if (ast.implementationId === "steinhaus-pentagon") return `⬠(${base})`;
  if (ast.implementationId === "steinhaus-circle") return `○(${base})`;
  if (ast.implementationId === "steinhaus-megagon") return `Mega-gon(${base})`;
  if (ast.implementationId === "steinhaus-polygon") return `P${astToExpression(ast.args[1])}(${base})`;
  return `SM(${base}; ${astToExpression(ast.args[1])}; ${astToExpression(ast.args[2])})`;
}

function steinhausBase(ast, references, options) {
  try { return { integer: steinhausInteger(ast, references, "Steinhaus–Moser construction", options) }; }
  catch (error) {
    const notation = structuralSteinhausNotation(ast);
    if (notation && /outside the structural input range/.test(error.message)) return { notation };
    throw error;
  }
}

function steinhausSide(ast, references, options) {
  if (ast.type === "atom" && ast.implementationId === "steinhaus-mega") return { kind: "mega" };
  const value = steinhausInteger(ast, references, "polygon sides", options);
  if (value < 3n) throw new Error("polygon sides must be at least 3");
  return { kind: "integer", value };
}

function tryReduceSteinhaus(base, nesting, sides, options) {
  if (sides.kind !== "integer" || nesting !== 1n) return null;
  const sideCount = Number(sides.value);
  if (sideCount === 3 && base <= 300n) return decimalEngine.evaluate(`${base}^${base}`, new Map(), options);
  if (sideCount === 4 && base === 2n) return decimalEngine.evaluate("256", new Map(), options);
  return null;
}

function steinhausFromAst(ast, references, options) {
  if (ast.type === "atom") {
    if (ast.implementationId === "steinhaus-mega") return steinhausValue(2, 1, { kind: "integer", value: 5 }, { name: "Mega", shape: 5, visual: "circle" });
    if (ast.implementationId === "steinhaus-megiston") return steinhausValue(10, 1, { kind: "integer", value: 5 }, { name: "Megiston", shape: 5, visual: "circle" });
    if (ast.implementationId === "steinhaus-moser") return steinhausValue(2, 1, { kind: "mega" }, { name: "Moser", shape: "megagon", visual: "megagon" });
    return null;
  }
  if (ast.type !== "call" || !steinhausImplementations.has(ast.implementationId)) return null;
  const baseInput = steinhausBase(ast.args[0], references, options);
  const base = baseInput.integer;
  let nesting = 1n;
  let sides;
  let visual;
  if (ast.implementationId === "steinhaus-triangle") { sides = { kind: "integer", value: 3n }; visual = "triangle"; }
  if (ast.implementationId === "steinhaus-square") { sides = { kind: "integer", value: 4n }; visual = "square"; }
  if (ast.implementationId === "steinhaus-pentagon") { sides = { kind: "integer", value: 5n }; visual = "pentagon"; }
  if (ast.implementationId === "steinhaus-circle") { sides = { kind: "integer", value: 5n }; visual = "circle"; }
  if (ast.implementationId === "steinhaus-polygon") { if (ast.args.length !== 2) throw new Error("sm_polygon requires a number and side count"); sides = steinhausSide(ast.args[1], references, options); }
  if (ast.implementationId === "steinhaus-megagon") { sides = { kind: "mega" }; visual = "megagon"; }
  if (ast.implementationId === "steinhaus-canonical") {
    if (ast.args.length !== 3) throw new Error("sm requires a number, nesting count, and side count");
    nesting = steinhausInteger(ast.args[1], references, "nesting count", options);
    sides = steinhausSide(ast.args[2], references, options);
  }
  // Keep the well-known named constructions stable no matter which equivalent
  // spelling the user chose. The circle convention is the canonical spelling
  // for Mega, although it is also a pentagon construction.
  if (base && nesting === 1n && sides.kind === "integer" && sides.value === 5n) {
    if (base === 2n) {
      return steinhausValue(base, nesting, sides, {
        name: "Mega",
        shape: 5,
        visual: "circle",
        canonical: "SM(2; 1; 5)",
        derivation: "○2 = □²(2) = □256 = △²⁵⁶(256)",
      });
    }
    if (base === 10n) {
      return steinhausValue(base, nesting, sides, {
        name: "Megiston",
        shape: 5,
        visual: "circle",
        canonical: "SM(10; 1; 5)",
        derivation: "○10, the circle construction on 10",
      });
    }
  }
  if (base && nesting === 1n && sides.kind === "mega" && base === 2n) {
    return steinhausValue(base, nesting, sides, {
      name: "Moser",
      shape: "megagon",
      visual: "megagon",
      canonical: "SM(2; 1; Mega)",
      derivation: "the Mega-gon construction on 2",
    });
  }

  if (baseInput.notation) {
    return steinhausValue(baseInput.notation, nesting, sides, {
      shape: sides.kind === "integer" ? Number(sides.value) : "megagon",
      visual,
      parenthesizeBase: true,
      derivation: `An exact symbolic construction enclosing ${baseInput.notation}; its numeric expansion is intentionally not attempted.`,
    });
  }
  const reduced = tryReduceSteinhaus(base, nesting, sides, options);
  if (reduced) return reduced;
  return steinhausValue(base, nesting, sides, { shape: sides.kind === "integer" ? Number(sides.value) : "megagon", visual });
}

function materializeExactStructuralAst(ast, references, options) {
  if (ast.type === "group" || ast.type === "unary") return { ...ast, value: materializeExactStructuralAst(ast.value, references, options) };
  if (ast.type === "postfix") return { ...ast, value: materializeExactStructuralAst(ast.value, references, options) };
  if (ast.type === "binary") return { ...ast, left: materializeExactStructuralAst(ast.left, references, options), right: materializeExactStructuralAst(ast.right, references, options) };
  if (ast.type !== "call") return ast;

  const candidate = {
    ...ast,
    // Keep a structural base intact until its enclosing construction decides
    // whether it is small enough to reduce or must remain symbolic.
    args: ast.args.map((argument, index) => steinhausImplementations.has(ast.implementationId) && index === 0
      ? argument
      : materializeExactStructuralAst(argument, references, options)),
  };
  const value = steinhausFromAst(candidate, references, options);
  if (value?.kind !== "decimal.js") return candidate;
  return { type: "number", raw: value.decimal.toString(), start: candidate.start, end: candidate.end };
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
    const integer = typeof reference === "string" ? reference : reference?.exactInteger;
    if (/^-?\d+$/.test(integer ?? "")) return BigInt(integer);
    throw new Error("history value is not an exact integer");
  };
  const primary = () => {
    const token = take();
    if (token === "(") { const result = addSub(); if (take() !== ")") throw new Error("missing parenthesis"); return result; }
    if (token?.startsWith("@history") || token === "@n") return referencedInteger(token);
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
    return {
      ...value,
      exactInteger,
      quality: { ...(value.quality ?? {}), certainty: "exact", representation: "integer", retainedDigits: "all" },
    };
  } catch { return value; }
}

export function evaluateAutomatically(expression, references = new Map(), options = {}) {
  const parsedAst = parseExpression(expression);
  const exact = options.forceDecimal ? null : tryEvaluateExact(parsedAst, references);
  if (exact) return hydrateExactValue(exact);
  const extendedScale = options.forceDecimal ? null : tryEvaluateExtendedScale(parsedAst, references, options);
  if (extendedScale) return extendedScale;
  const structuralPower = options.forceDecimal ? null : tryEvaluateStructuralPower(parsedAst, references);
  if (structuralPower) return structuralPower;
  const ast = materializeExactStructuralAst(parsedAst, references, options);
  const normalizedExpression = astToExpression(ast);
  const structural = steinhausFromAst(ast, references, options);
  if (structural) {
    if (structural.kind === "decimal.js") return attachExactInteger({ ...structural, engineId: decimalEngine.id, engineLabel: decimalEngine.label }, normalizedExpression, references);
    return structural;
  }
  if (ast.type === "reference") {
    const reference = references.get(ast.token);
    if (reference?.kind === "steinhaus-moser" || isStructuralPower(reference)) return reference;
  }
  const structuralHierarchy = normalizedExpression.trim().match(/^fgh([3-5])\(\s*(\d+)\s*\)$/i);
  if (structuralHierarchy) {
    const level = Number(structuralHierarchy[1]);
    const argument = structuralHierarchy[2];
    if (level >= 4 || Number(argument) > 4) return { kind: "hierarchy", level, argument, full: `F_${level}(${argument})`, engineId: "wainer-structural", engineLabel: "Wainer hierarchy · structural", quality: { certainty: "symbolic-exact", representation: "hierarchy form", retainedDigits: "not expanded" } };
  }
  const ordered = options.forceDecimal ? [decimalEngine] : looksBeyondDecimal(normalizedExpression) ? [breakEternityEngine, decimalEngine] : engineRegistry;
  let lastError;
  for (const engine of ordered) {
    try {
      const value = engine.evaluate(normalizedExpression, references, options);
      return attachExactInteger({ ...value, engineId: engine.id ?? "placeholder", engineLabel: engine.label ?? "Wide range" }, normalizedExpression, references);
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("No compatible engine");
}

export function formatAutomatically(value, options = {}) {
  if (isExactValue(value)) {
    const formatted = formatExact(value, options);
    if (!options.groupDigits || options.base !== 10 || formatted.exponent || !/^\d+(?:\.\d+)?$/.test(formatted.significand)) return formatted;
    const [whole, fraction] = formatted.significand.split(".");
    const grouped = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
    return { ...formatted, significand: grouped, text: `${formatted.sign}${grouped}` };
  }
  if (value.kind === "steinhaus-moser") return {
    sign: "",
    significand: value.short,
    exponent: "",
    text: value.short,
    full: value.canonical,
    steinhaus: true,
    shape: value.shape,
    visual: value.visual,
    base: value.construction.base,
    canonical: value.canonical,
    derivation: value.derivation,
    name: value.name,
    showSteinhausShape: Boolean(options.showSteinhausShape),
  };
  if (isStructuralPower(value)) return formatStructuralPower(value);
  if (isExtendedScale(value)) return formatExtendedScale(value, options);
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
  return formatAutomatically(value, { ...options, precision: defaultCalculationPrecision, groupDigits: options.groupDigits ?? false }).text;
}

// Export is deliberately separate from normal rendering: it may format a
// worker-produced 10M-digit Decimal without raising the on-screen ceiling.
export function formatForHighPrecisionExport(value, options = {}) {
  if (isExactValue(value)) return value.kind === "exact-integer" ? exactParts(value).numerator.toString() : `${value.numerator}/${value.denominator}`;
  const maximumLength = options.maximumLength ?? exportPrecision;
  if (value?.kind !== "decimal.js" || options.base !== 10) return formatForCopy(value, options);
  const decimal = value.decimal;
  const magnitude = decimal.abs();
  if (magnitude.isZero()) return "0";
  const rounded = magnitude.toSignificantDigits(Math.min(exportPrecision, magnitude.sd()));
  let text;
  if (decimalExpandedLength(rounded) <= maximumLength) {
    text = rounded.toFixed().replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
    if (options.groupDigits) {
      const [whole, fraction] = text.split(".");
      text = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
    }
  } else {
    text = rounded.toExponential().replace(/e\+/, "e");
  }
  return `${decimal.isNegative() ? "-" : ""}${text}`;
}

export function inspectAutomatically(value, options = {}) {
  if (value.kind === "exact-integer") return {
    ...formatAutomatically(value, options),
    engine: "Native exact",
    representation: "arbitrary-size integer",
    exactness: "exact",
    precision: "all digits retained",
  };
  if (value.kind === "exact-rational") return {
    ...formatAutomatically(value, options),
    engine: "Native exact",
    representation: "reduced rational",
    exactness: "exact",
    precision: "exact numerator and denominator",
  };
  if (value.kind === "steinhaus-moser") return {
    ...formatAutomatically(value, options),
    engine: "Steinhaus–Moser",
    representation: "polygon construction",
    exactness: "symbolic exact",
    precision: "not expanded",
    canonical: value.canonical,
    derivation: value.derivation,
  };
  if (isStructuralPower(value)) return {
    ...formatStructuralPower(value),
    engine: "Exact structure · powers",
    representation: "nested power form",
    exactness: "symbolic exact",
    precision: "not expanded",
    canonical: value.canonical,
    derivation: "Preserved before numeric expansion would exceed the exact engine boundary.",
    facts: structuralPowerFacts(value, options.base ?? 10),
    provenance: structuralPowerProvenance(value, options.base ?? 10),
  };
  if (value.kind === "hierarchy") return { ...formatAutomatically(value, options), engine: "Wainer hierarchy", representation: `F${value.level} structural form`, exactness: "symbolic exact", precision: "not expanded" };
  if (isExtendedScale(value)) return inspectExtendedScale(value, options);
  if (value.kind === "decimal.js") return decimalEngine.inspect(value, options);
  if (value.kind === "break-eternity") return { ...breakEternityEngine.inspect(value, options), engine: value.engineLabel ?? "break_eternity.js" };
  return placeholderEngine.inspect(value, options);
}

export function digitCountAutomatically(value, base = 10) {
  try {
    if (value.kind === "exact-integer") {
      const integer = exactParts(value).numerator;
      const digits = (integer < 0n ? -integer : integer).toString(base).length;
      return { value: { kind: "exact-integer", integer: BigInt(digits), exactInteger: String(digits), full: String(digits) }, certainty: "exact" };
    }
    if (isStructuralPower(value)) return null;
    if (isExtendedScale(value)) return digitCountExtendedScale(value);
    if (value.kind === "decimal.js") return decimalEngine.digitCount(value, base);
    if (value.kind === "break-eternity") return breakEternityEngine.digitCount(value, base);
  } catch { /* An unsupported alternate engine simply omits this optional inspection detail. */ }
  return null;
}

function groupWholeDigits(text) {
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function compactDigitCount(decimal) {
  const [coefficient, exponent = ""] = decimal.toExponential(2).split("e");
  const cleanCoefficient = coefficient.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  return `${cleanCoefficient} × 10^${exponent.replace(/^\+/, "")}`;
}

// Digit counts are metadata, so they deliberately do not inherit the result
// notation rules. Small counts are readable whole numbers; vast ones are compact.
export function formatDigitCountForInspector(digitCount, options = {}) {
  if (digitCount?.value?.kind === "exact-integer") {
    const text = digitCount.value.exactInteger ?? digitCount.value.integer.toString();
    return options.groupDigits ? groupWholeDigits(text) : text;
  }
  if (!digitCount?.value?.decimal) return null;
  const decimal = digitCount.value.decimal;
  if (digitCount.value.kind === "decimal.js") {
    const roundedUp = decimal.ceil();
    if (roundedUp.lt(10_000)) {
      const plain = roundedUp.toFixed(0);
      return options.groupDigits ? groupWholeDigits(plain) : plain;
    }
    return compactDigitCount(decimal);
  }
  if (digitCount.value.kind === "break-eternity" && decimal.layer === 0) {
    const roundedUp = decimal.ceil();
    if (roundedUp.lt(10_000)) {
      const plain = roundedUp.toFixed(0);
      return options.groupDigits ? groupWholeDigits(plain) : plain;
    }
    return compactDigitCount(decimal);
  }
  return formatAutomatically(digitCount.value, { base: 10, notation: "scientific", precision: 2 }).text;
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
  if (isExactValue(value)) return serializeExactValue(value);
  if (isStructuralPower(value)) return serializeStructuralValue(value);
  if (isExtendedScale(value)) return serializeExtendedScale(value);
  if (value.kind === "decimal.js" || value.kind === "break-eternity") {
    return { ...value, decimal: value.decimal?.toString?.() ?? value.full };
  }
  return value;
}

export function deserializeValue(value) {
  if (!value) return null;
  if (value.kind === "exact-integer" || value.kind === "exact-rational") return hydrateExactValue(deserializeExactValue(value));
  if (isStructuralPower(value)) return deserializeStructuralValue(value);
  if (isExtendedScale(value)) return deserializeExtendedScale(value);
  if (value.kind === "decimal.js") return { ...value, decimal: new Decimal(value.decimal) };
  if (value.kind === "break-eternity") return { ...value, decimal: new BreakDecimal(value.decimal) };
  return value;
}
