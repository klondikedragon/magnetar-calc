// Extended scientific scale values keep a bounded significand alongside an
// arbitrary-size *integer* base-10 scale. They deliberately do not claim to
// solve the harder case where the scale itself is a non-integral magnitude.
import Decimal from "decimal.js";
import { exactInteger, exactParts, isExactValue, tryEvaluateExact } from "./exactValues.js";

export const decimalExponentLimit = 9_000_000_000_000_000n;
const defaultWorkingDigits = 1_000;
const scientificScaleSources = Object.freeze([{
  id: "dlmf-logarithm-identities",
  title: "NIST Digital Library of Mathematical Functions, §4.8(i)",
  url: "https://dlmf.nist.gov/4.8.i",
}]);

class UnsupportedExtendedScaleError extends Error {}

function unsupported() { throw new UnsupportedExtendedScaleError(); }

function workingDigits(options = {}) {
  const requested = Number.isInteger(options.calculationPrecision) ? options.calculationPrecision : defaultWorkingDigits;
  return Math.max(32, Math.min(defaultWorkingDigits, requested));
}

function constructorFor(options) {
  return Decimal.clone({ precision: workingDigits(options), maxE: 9e15, minE: -9e15 });
}

function cleanCoefficient(decimal, digits) {
  return decimal.toSignificantDigits(digits).toFixed().replace(/(\.[0-9]*?)0+$/, "$1").replace(/\.$/, "");
}

function scaleText(scale) { return BigInt(scale).toString(); }

function makeValue(sign, coefficient, scale, options = {}, { exactCoefficient = false, discardedAddend = null } = {}) {
  const Ctor = coefficient.constructor;
  if (sign === 0 || coefficient.isZero()) {
    return {
      kind: "extended-scale",
      sign: 0,
      significand: new Ctor(0),
      scale: 0n,
      exactCoefficient: true,
      engineId: "extended-scale",
      engineLabel: "Extended scale · arbitrary exponent",
      quality: { certainty: "exact", representation: "extended scientific scale", retainedDigits: "zero" },
    };
  }
  const digits = workingDigits(options);
  const normalized = coefficient.abs().toSignificantDigits(digits);
  const exponent = normalized.e;
  if (!Number.isSafeInteger(exponent)) unsupported();
  const significand = normalized.div(new Ctor(10).pow(exponent));
  const certainty = exactCoefficient && !discardedAddend ? "exact" : "rounded";
  return {
    kind: "extended-scale",
    sign: sign < 0 ? -1 : 1,
    significand,
    scale: BigInt(scale) + BigInt(exponent),
    exactCoefficient: Boolean(exactCoefficient && !discardedAddend),
    discardedAddend,
    engineId: "extended-scale",
    engineLabel: "Extended scale · arbitrary exponent",
    quality: {
      certainty,
      representation: "extended scientific scale",
      retainedDigits: certainty === "exact" ? "exact significand and scale" : `${digits.toLocaleString()} significant digits`,
      workingDigits: digits,
      ...(discardedAddend ? { discardedAddend: "below retained precision" } : {}),
    },
  };
}

function exactIntegerValue(value) {
  if (!isExactValue(value)) return null;
  const { numerator, denominator } = exactParts(value);
  return denominator === 1n ? numerator : null;
}

function fromExact(value, options = {}) {
  const integer = exactIntegerValue(value);
  if (integer === null) unsupported();
  const Ctor = constructorFor(options);
  if (integer === 0n) return makeValue(0, new Ctor(0), 0n, options, { exactCoefficient: true });
  const absolute = integer < 0n ? -integer : integer;
  const digits = absolute.toString();
  const retained = workingDigits(options);
  const coefficientText = digits.length <= retained
    ? `${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ""}`
    : `${digits[0]}.${digits.slice(1, retained)}`;
  return makeValue(integer < 0n ? -1 : 1, new Ctor(coefficientText), BigInt(digits.length - 1), options, {
    exactCoefficient: digits.length <= retained,
  });
}

function asExtended(value, options) {
  if (isExtendedScale(value)) return value;
  if (isExactValue(value)) return fromExact(value, options);
  unsupported();
}

function add(left, right, options, subtract = false) {
  const a = asExtended(left, options);
  const b = asExtended(right, options);
  const rightSign = subtract ? -b.sign : b.sign;
  if (a.sign === 0) return { ...b, sign: rightSign };
  if (b.sign === 0) return a;
  const difference = a.scale - b.scale;
  const absoluteDifference = difference < 0n ? -difference : difference;
  const threshold = BigInt(workingDigits(options) + 24);
  if (absoluteDifference > threshold) {
    const winner = difference >= 0n ? a : { ...b, sign: rightSign };
    return makeValue(winner.sign, winner.significand, winner.scale, options, {
      discardedAddend: scaleText(difference >= 0n ? b.scale : a.scale),
    });
  }
  const Ctor = constructorFor(options);
  const commonScale = difference >= 0n ? a.scale : b.scale;
  const leftShift = Number(commonScale - a.scale);
  const rightShift = Number(commonScale - b.scale);
  const combined = a.sign * new Ctor(a.significand.toString()).mul(new Ctor(10).pow(leftShift))
    .add(rightSign * new Ctor(b.significand.toString()).mul(new Ctor(10).pow(rightShift)));
  return makeValue(combined.isNegative() ? -1 : combined.isZero() ? 0 : 1, combined.abs(), commonScale, options);
}

function multiply(left, right, options, divide = false) {
  const a = asExtended(left, options);
  const b = asExtended(right, options);
  if (divide && b.sign === 0) throw new Error("division by zero");
  if (a.sign === 0) return makeValue(0, new (constructorFor(options))(0), 0n, options, { exactCoefficient: true });
  const Ctor = constructorFor(options);
  const coefficient = divide
    ? new Ctor(a.significand.toString()).div(b.significand.toString())
    : new Ctor(a.significand.toString()).mul(b.significand.toString());
  return makeValue(divide ? a.sign * b.sign : a.sign * b.sign, coefficient, divide ? a.scale - b.scale : a.scale + b.scale, options);
}

function power(base, exponent, options) {
  const exponentInteger = exactIntegerValue(exponent);
  if (exponentInteger === null) unsupported();
  if (isExactValue(base) && exactIntegerValue(base) === 10n && (exponentInteger > decimalExponentLimit || exponentInteger < -decimalExponentLimit)) {
    const Ctor = constructorFor(options);
    return makeValue(1, new Ctor(1), exponentInteger, options, { exactCoefficient: true });
  }
  // A finite exact base raised to a merely large exponent belongs either to
  // the exact-expansion lane or the structural-power lane. This engine only
  // raises values that are already extended scales, apart from the exact
  // power-of-ten construction above.
  if (!isExtendedScale(base)) unsupported();
  const value = base;
  if (exponentInteger === 0n) return fromExact(exactInteger(1n), options);
  if (value.significand.eq(1) && value.exactCoefficient) {
    const sign = value.sign < 0 && exponentInteger % 2n !== 0n ? -1 : 1;
    return makeValue(sign, value.significand, value.scale * exponentInteger, options, { exactCoefficient: true });
  }
  if (exponentInteger < -10_000n || exponentInteger > 10_000n) unsupported();
  const Ctor = constructorFor(options);
  const magnitude = exponentInteger < 0n ? -exponentInteger : exponentInteger;
  const coefficient = new Ctor(value.significand.toString()).pow(magnitude.toString());
  const reciprocal = exponentInteger < 0n;
  const result = reciprocal ? new Ctor(1).div(coefficient) : coefficient;
  const sign = value.sign < 0 && magnitude % 2n !== 0n ? -1 : 1;
  return makeValue(sign, result, value.scale * exponentInteger, options);
}

function evaluateNode(node, references, options) {
  const exact = tryEvaluateExact(node, references);
  if (exact) return exact;
  if (node.type === "group") return evaluateNode(node.value, references, options);
  if (node.type === "reference") {
    const reference = references.get(node.token);
    if (isExtendedScale(reference)) return reference;
    unsupported();
  }
  if (node.type !== "binary") unsupported();
  const left = evaluateNode(node.left, references, options);
  const right = evaluateNode(node.right, references, options);
  if (node.implementationId === "arithmetic-add") return add(left, right, options);
  if (node.implementationId === "arithmetic-subtract") return add(left, right, options, true);
  if (node.implementationId === "arithmetic-multiply") return multiply(left, right, options);
  if (node.implementationId === "arithmetic-divide") return multiply(left, right, options, true);
  if (node.implementationId === "arithmetic-power" || node.implementationId === "hyperoperation-knuth-up") return power(left, right, options);
  unsupported();
}

export function isExtendedScale(value) { return value?.kind === "extended-scale"; }

export function tryEvaluateExtendedScale(ast, references = new Map(), options = {}) {
  try {
    const value = evaluateNode(ast, references, options);
    return isExtendedScale(value) ? value : null;
  } catch (error) {
    if (error instanceof UnsupportedExtendedScaleError) return null;
    throw error;
  }
}

export function formatExtendedScale(value, options = {}) {
  const digits = Math.max(1, Math.min(value.quality?.workingDigits ?? defaultWorkingDigits, Math.max(1, options.precision ?? 48)));
  if (value.sign === 0) return { sign: "", significand: "0", exponent: "", text: "0", full: "0", radix: 10, extendedScale: true };
  const coefficient = cleanCoefficient(value.significand, digits);
  const sign = value.sign < 0 ? "−" : "";
  const exponent = scaleText(value.scale);
  const text = `${sign}${coefficient} × 10^${exponent}`;
  return { sign, significand: coefficient, exponent, text, full: text, radix: 10, extendedScale: true };
}

export function inspectExtendedScale(value, options = {}) {
  const formatted = formatExtendedScale(value, options);
  const exact = value.quality?.certainty === "exact";
  const facts = [{
    id: "extended-scale",
    label: "base-10 scale",
    value: scaleText(value.scale),
    certainty: "derived exact",
    ruleId: "scale.normalized-scientific",
    detail: "The normalized significand is multiplied by ten raised to this exact integer scale.",
  }];
  if (exact && value.significand.isInteger() && value.scale >= 0n) facts.push({
    id: "extended-scale-digits",
    label: "base-10 digits",
    value: scaleText(value.scale + 1n),
    certainty: "derived exact",
    ruleId: "digits.normalized-scientific",
    detail: "A normalized exact integer significand has scale + 1 decimal digits.",
  });
  if (value.discardedAddend) facts.push({
    id: "extended-scale-discarded-addend",
    label: "discarded addend scale",
    value: value.discardedAddend,
    certainty: "rounded",
    ruleId: "scale.precision-window",
    detail: "The addend lay beyond the retained significand precision window and could not affect stored digits.",
  });
  return {
    ...formatted,
    engine: "Extended scale",
    representation: "normalized significand with arbitrary integer decimal scale",
    exactness: exact ? "exact scientific scale" : `rounded to ${value.quality?.workingDigits ?? defaultWorkingDigits} significant digits`,
    precision: exact ? "exact significand and scale" : `${value.quality?.workingDigits ?? defaultWorkingDigits} significant digits internal`,
    facts,
    provenance: facts.map((fact) => ({
      claim: `${fact.label}: ${fact.value}`,
      certainty: fact.certainty,
      ruleId: fact.ruleId,
      rule: fact.ruleId === "scale.precision-window" ? "Retained-precision window" : "Normalized scientific scale",
      approach: fact.detail,
      inputs: { significand: value.significand.toString(), scale: scaleText(value.scale) },
      sources: scientificScaleSources,
    })),
  };
}

export function digitCountExtendedScale(value) {
  if (value.sign === 0 || value.scale < 0n || value.quality?.certainty !== "exact" || !value.significand.isInteger()) return null;
  try {
    const digits = value.scale + 1n;
    return { value: exactInteger(digits), certainty: "exact" };
  } catch { return null; }
}

export function serializeExtendedScale(value) {
  if (!isExtendedScale(value)) return value;
  return { ...value, significand: value.significand.toString(), scale: scaleText(value.scale) };
}

export function deserializeExtendedScale(value) {
  if (!isExtendedScale(value)) return value;
  return { ...value, significand: new Decimal(value.significand), scale: BigInt(value.scale) };
}
