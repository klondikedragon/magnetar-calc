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

const tokenPattern = /\s*(\d+(?:\.\d*)?(?:e[+-]?\d+)?|@history\(\d+\)|[A-Za-z]+|↑+|\^+|[()+\-*/%!×÷−πτ√])/gy;

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    if (!source.slice(index).trim()) break;
    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(source);
    if (!match) throw new Error("unsupported expression");
    tokens.push(match[1]);
    index = tokenPattern.lastIndex;
  }
  const functions = new Set(["sqrt", "sin", "cos", "tan", "ln", "log", "abs", "exp"]);
  const endsAtom = (token) => /^\d/.test(token) || token.startsWith("@history") || ["π", "τ", "e", "pi", "tau", ")", "!"].includes(token.toLowerCase());
  const startsAtom = (token) => /^\d/.test(token) || token.startsWith("@history") || ["π", "τ", "e", "pi", "tau", "("].includes(token.toLowerCase()) || functions.has(token.toLowerCase());
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
    return new Ctor(name === "pi" ? "3.141592653589793" : name === "e" ? "2.718281828459045" : "6.283185307179586");
  }
  if (name === "pi") return Ctor.acos(new Ctor(-1));
  if (name === "e") return Ctor.exp(new Ctor(1));
  if (name === "tau") return Ctor.acos(new Ctor(-1)).mul(2);
  throw new Error("unknown constant");
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
    if (token === "e") return engineConstant("e", Ctor);
    throw new Error("unknown value");
  };
  const primary = () => {
    const token = take();
    if (token === "(") { const result = addSub(); if (take() !== ")") throw new Error("missing parenthesis"); return result; }
    if (/^[A-Za-z]+$/.test(token) && peek() === "(") {
      take();
      const arg = addSub();
      if (take() !== ")") throw new Error("missing parenthesis");
      const funcs = { sqrt: "sqrt", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log10", abs: "abs", exp: "exp" };
      const fn = funcs[token.toLowerCase()];
      if (!fn) throw new Error("unknown function");
      return arg[fn]();
    }
    return valueFor(token);
  };
  const unary = () => { if (peek() === "−" || peek() === "-") { take(); return unary().neg(); } if (peek() === "+") { take(); return unary(); } if (peek() === "√") { take(); return unary().sqrt(); } let result = primary(); while (peek() === "!") { take(); result = factorialValue(result, Ctor); } return result; };
  const power = () => { const left = unary(); if (peek() === "^" || peek() === "↑") { take(); return left.pow(power()); } if (typeof peek() === "string" && /^(?:↑{2,}|\^{2,})$/.test(peek())) { const arrows = take(); const height = power(); if (arrows.length === 2) return typeof left.tetrate === "function" ? left.tetrate(height.toNumber()) : tetrateDecimal(left, height, Ctor); throw new Error("hyper-operation not available in this backend"); } return left; };
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
  const arrows = "↑".repeat(Math.min(arrowCount, 20));
  const dense = arrowCount > 20;
  const magnitude = String(decimal.mag);
  let expanded = magnitude;
  for (let index = 0; index < arrowCount; index += 1) expanded = `10^(${expanded})`;
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
  convertBase(value, base) { return this.format(value, { base }); },
};

function formatDecimal(value, base = 10, precision = 48, notation = "auto") {
  const decimal = value.decimal;
  const sign = decimal.isNegative() ? "−" : "";
  const magnitude = decimal.abs();
  if (magnitude.isZero()) return { sign: "", significand: "0", exponent: "", text: "0", full: "0" };
  if (base === 2) return { sign, significand: magnitude.toBinary(Math.min(precision, 1000)), exponent: "", text: `${sign}${magnitude.toBinary(Math.min(precision, 1000))}`, full: `${sign}${magnitude.toString()}` };
  if (base === 16) return { sign, significand: magnitude.toHex(Math.min(precision, 1000)), exponent: "", text: `${sign}${magnitude.toHex(Math.min(precision, 1000))}`, full: `${sign}${magnitude.toString()}` };
  const digits = Math.max(1, Math.min(precision, 1000));
  const rounded = magnitude.toSignificantDigits(digits);
  const raw = notation === "scientific" || notation === "engineering" ? rounded.toExponential() : rounded.toString();
  let [coefficient, exponent = ""] = raw.split("e");
  exponent = exponent.replace(/^\+/, "");
  const cleanCoefficient = coefficient.replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
  const numericExponent = Number(exponent || 0);
  if (notation === "auto" && numericExponent >= -6 && numericExponent <= 15) {
    const plain = rounded.toFixed().replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
    return { sign, significand: plain, exponent: "", text: `${sign}${plain}`, full: `${sign}${magnitude.toString()}` };
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
  inspect(value, options = {}) { return { ...this.format(value, options), engine: "decimal.js", representation: "arbitrary-precision decimal", exactness: "rounded to configured precision", precision: `${options.precision ?? 48} significant digits` }; },
  convertBase(value, base) { return this.format(value, { base }); },
};

function looksBeyondDecimal(expression) {
  return /↑{3,}|\^\^\^|\b(?:iteratedexp|iteratedlog|slog|pent)\b/i.test(expression) || /(?:\^|e)\s*[+-]?\d{16,}/i.test(expression);
}

export const engineRegistry = [decimalEngine, breakEternityEngine];

export function evaluateAutomatically(expression, references = new Map(), options = {}) {
  const ordered = looksBeyondDecimal(expression) ? [breakEternityEngine, decimalEngine] : engineRegistry;
  let lastError;
  for (const engine of ordered) {
    try {
      const value = engine.evaluate(expression, references, options);
      return { ...value, engineId: engine.id ?? "placeholder", engineLabel: engine.label ?? "Wide range" };
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("No compatible engine");
}

export function formatAutomatically(value, options = {}) {
  if (value.kind === "decimal.js") return decimalEngine.format(value, options);
  if (value.kind === "break-eternity") return breakEternityEngine.format(value, options);
  return placeholderEngine.format(value, options);
}

export function inspectAutomatically(value, options = {}) {
  if (value.kind === "decimal.js") return decimalEngine.inspect(value, options);
  if (value.kind === "break-eternity") return { ...breakEternityEngine.inspect(value, options), engine: value.engineLabel ?? "break_eternity.js" };
  return placeholderEngine.inspect(value, options);
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
