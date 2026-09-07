import Decimal from "decimal.js";
import {
  deserializeExactValue,
  exactInteger,
  exactParts,
  isExactValue,
  serializeExactValue,
  tryEvaluateExact,
} from "./exactValues.js";

// This module owns the first semantic structural-value grammar.  It is kept
// separate from formatting and the numeric engines so a future logarithmic or
// level-index backend can use the same values without reverse-engineering text.
const powerImplementationIds = new Set(["arithmetic-power", "hyperoperation-knuth-up"]);
const factDecimal = Decimal.clone({ precision: 40, maxE: 1e6, minE: -1e6 });

export const structuralPowerRules = Object.freeze({
  "power.structural-preservation": Object.freeze({
    id: "power.structural-preservation",
    title: "Exact power preservation",
    description: "A positive-integer power is retained as a symbolic exact value when expansion would exceed the exact engine boundary.",
    sources: [{
      id: "dlmf-logarithm-powers",
      title: "NIST Digital Library of Mathematical Functions, §4.8",
      url: "https://dlmf.nist.gov/4.8",
    }],
  }),
  "digits.base-power": Object.freeze({
    id: "digits.base-power",
    title: "Positional digit count",
    description: "For a nonzero integer n and base b > 1, the digit count is floor(log_b(|n|)) + 1.",
    sources: [{
      id: "mathworld-number-length",
      title: "Wolfram MathWorld: Number Length",
      url: "https://mathworld.wolfram.com/NumberLength.html",
    }, {
      id: "dlmf-general-logarithm",
      title: "NIST Digital Library of Mathematical Functions, §4.2(ii)",
      url: "https://dlmf.nist.gov/4.2.ii",
    }],
  }),
  "magnitude.repeated-log": Object.freeze({
    id: "magnitude.repeated-log",
    title: "Repeated logarithm identity",
    description: "For positive bases, logarithms turn a power into multiplication and a product into a sum of logarithms.",
    sources: [{
      id: "dlmf-logarithm-identities",
      title: "NIST Digital Library of Mathematical Functions, §4.8(i)",
      url: "https://dlmf.nist.gov/4.8.i",
    }],
  }),
  "magnitude.decimal-digit-interval": Object.freeze({
    id: "magnitude.decimal-digit-interval",
    title: "Decimal digit-count interval",
    description: "A power's decimal digit count is enclosed by rounding a working-precision logarithmic evaluation outward at the displayed precision.",
    sources: [{
      id: "mathworld-number-length",
      title: "Wolfram MathWorld: Number Length",
      url: "https://mathworld.wolfram.com/NumberLength.html",
    }, {
      id: "dlmf-logarithm-powers",
      title: "NIST Digital Library of Mathematical Functions, §4.8",
      url: "https://dlmf.nist.gov/4.8",
    }],
  }),
  "magnitude.decimal-digit-estimate": Object.freeze({
    id: "magnitude.decimal-digit-estimate",
    title: "Decimal digit-count estimate",
    description: "A compact working-precision evaluation of a power's logarithmic digit-count formula.",
    sources: [{
      id: "mathworld-number-length",
      title: "Wolfram MathWorld: Number Length",
      url: "https://mathworld.wolfram.com/NumberLength.html",
    }, {
      id: "dlmf-logarithm-powers",
      title: "NIST Digital Library of Mathematical Functions, §4.8",
      url: "https://dlmf.nist.gov/4.8",
    }],
  }),
  "steinhaus.polygon-reduction": Object.freeze({
    id: "steinhaus.polygon-reduction",
    title: "Steinhaus–Moser polygon reduction",
    description: "A triangle represents n^n; a square represents n nested triangle operations. This rule records a finite, algebraically expanded instance without materializing its decimal digits.",
    sources: [{
      id: "mathworld-steinhaus-moser",
      title: "Wolfram MathWorld: Steinhaus-Moser Notation",
      url: "https://mathworld.wolfram.com/Steinhaus-MoserNotation.html",
    }],
  }),
});

function freeze(value) { return Object.freeze(value); }

function positiveExactInteger(value) {
  if (!isExactValue(value)) return null;
  const { numerator, denominator } = exactParts(value);
  return denominator === 1n && numerator > 0n ? numerator : null;
}

function exactText(value) {
  const { numerator, denominator } = exactParts(value);
  return denominator === 1n ? numerator.toString() : `(${numerator}/${denominator})`;
}

export function isStructuralPower(value) {
  return value?.kind === "structural-power";
}

export function structuralText(value) {
  if (isExactValue(value)) return exactText(value);
  if (isStructuralPower(value)) return `${structuralOperandText(value.base)}^${structuralOperandText(value.exponent)}`;
  return value?.canonical ?? value?.full ?? "?";
}

function structuralOperandText(value) {
  return isStructuralPower(value) ? `(${structuralText(value)})` : structuralText(value);
}

function makePower(base, exponent, context = {}) {
  const canonical = `${structuralOperandText(base)}^${structuralOperandText(exponent)}`;
  const reduction = context.reduction ? freeze({ ...context.reduction }) : null;
  const provenance = [freeze({
    ruleId: "power.structural-preservation",
    certainty: "structural",
    inputs: freeze({ base: structuralText(base), exponent: structuralText(exponent) }),
    conditions: "positive exact integer base greater than one and positive exact-integer or structural exponent",
  })];
  if (reduction) {
    provenance.push(freeze({
      ruleId: "steinhaus.polygon-reduction",
      certainty: "structural",
      inputs: freeze({ construction: reduction.notation, derivation: reduction.derivation }),
      conditions: "a finite Steinhaus–Moser construction with the displayed algebraic reduction",
    }));
  }
  return freeze({
    kind: "structural-power",
    base,
    exponent,
    canonical,
    full: canonical,
    engineId: "structural-power",
    engineLabel: "Exact structure · powers",
    quality: freeze({ certainty: "symbolic-exact", representation: "power form", retainedDigits: "not expanded" }),
    ...(reduction ? { reduction } : {}),
    provenance: freeze(provenance),
  });
}

// A trusted producer for structural powers whose operands are already known
// exact integers. It is intentionally narrow: callers cannot invent a power
// of an inexact value merely to obtain a more attractive display.
export function createStructuralPower(base, exponent, context = {}) {
  const exactBase = isExactValue(base) ? base : exactInteger(base);
  const exactExponent = isExactValue(exponent) ? exponent : exactInteger(exponent);
  if (!positiveExactInteger(exactBase) || !positiveExactInteger(exactExponent)) {
    throw new Error("structural powers require positive exact integers");
  }
  return makePower(exactBase, exactExponent, context);
}

function structuralOperandFromAst(ast, references) {
  const exact = tryEvaluateExact(ast, references);
  if (exact) return exact;
  if (ast.type === "reference" && isStructuralPower(references.get(ast.token))) return references.get(ast.token);
  if (ast.type === "group") return structuralOperandFromAst(ast.value, references);
  if (ast.type !== "binary" || !powerImplementationIds.has(ast.implementationId)) return null;
  const base = structuralOperandFromAst(ast.left, references);
  const exponent = structuralOperandFromAst(ast.right, references);
  if (!base || !exponent || !positiveExactInteger(base)) return null;
  if (!positiveExactInteger(exponent) && !isStructuralPower(exponent)) return null;
  return makePower(base, exponent);
}

// Returns null for any expression whose exact structural meaning is not yet in
// this small grammar. Normal numeric engines remain responsible for those.
export function tryEvaluateStructuralPower(ast, references = new Map()) {
  const value = structuralOperandFromAst(ast, references);
  return isStructuralPower(value) ? value : null;
}

export function serializeStructuralValue(value) {
  if (!isStructuralPower(value)) return value;
  return {
    ...value,
    base: isExactValue(value.base) ? serializeExactValue(value.base) : serializeStructuralValue(value.base),
    exponent: isExactValue(value.exponent) ? serializeExactValue(value.exponent) : serializeStructuralValue(value.exponent),
  };
}

export function deserializeStructuralValue(value) {
  if (!isStructuralPower(value)) return value;
  const restore = (part) => {
    if (part?.kind === "exact-integer" || part?.kind === "exact-rational") return deserializeExactValue(part);
    return deserializeStructuralValue(part);
  };
  return makePower(restore(value.base), restore(value.exponent), { reduction: value.reduction });
}

export function formatStructuralPower(value) {
  return {
    sign: "",
    significand: value.canonical,
    exponent: "",
    text: value.canonical,
    full: value.canonical,
    structuralPower: true,
    canonical: value.canonical,
  };
}

function exactDecimal(value) {
  const { numerator, denominator } = exactParts(value);
  return new factDecimal(numerator.toString()).div(denominator.toString());
}

function compactDecimal(decimal, digits = 8) {
  const [coefficient, rawExponent = "0"] = decimal.toSignificantDigits(digits).toExponential().split("e");
  const exponent = rawExponent.replace(/^\+/, "");
  return Number(exponent) === 0 ? coefficient : `${coefficient} × 10^${exponent}`;
}

function powerDigitFormula(value, base) {
  return `floor((${structuralText(value.exponent)}) × log_${base}(${structuralText(value.base)})) + 1`;
}

function nestedPowerLogLog(value) {
  const outerBase = positiveExactInteger(value.base);
  const inner = value.exponent;
  if (!outerBase || outerBase <= 1n || !isStructuralPower(inner)) return null;
  const innerBase = positiveExactInteger(inner.base);
  const innerExponent = isExactValue(inner.exponent) ? inner.exponent : null;
  if (!innerBase || innerBase <= 1n || !innerExponent) return null;
  try {
    const x = exactDecimal(innerExponent);
    const result = x.mul(new factDecimal(innerBase.toString()).log(10))
      .add(new factDecimal(new factDecimal(outerBase.toString()).log(10)).log(10));
    return result.isFinite() ? result : null;
  } catch { return null; }
}

function outwardDecimalInterval(value, digits = 8) {
  if (!value?.isFinite() || value.lte(0)) return null;
  const unit = new factDecimal(10).pow(value.e - digits + 1);
  const lower = value.div(unit).floor().mul(unit);
  const upper = value.div(unit).ceil().mul(unit).plus(unit);
  return { lower, upper };
}

function formatDecimalInterval(interval) {
  if (!interval) return null;
  return `[${compactDecimal(interval.lower)}, ${compactDecimal(interval.upper)}]`;
}

// This deliberately produces an interval rather than evaluating floor(...).
// The structural formula remains the source of truth; a finite-precision log
// cannot in general establish on which side of an integer boundary it lands.
function decimalDigitEstimate(value) {
  const base = positiveExactInteger(value.base);
  if (!base || base <= 1n || !isExactValue(value.exponent)) return null;
  try {
    const estimate = exactDecimal(value.exponent)
      .mul(new factDecimal(base.toString()).log(10))
      .add(1);
    return estimate.isFinite() && estimate.gt(0) ? estimate : null;
  } catch { return null; }
}

function integerBase(value) {
  const integer = positiveExactInteger(value);
  return integer && integer > 1n ? integer : null;
}

export function structuralPowerFacts(value, displayBase = 10) {
  if (!isStructuralPower(value)) return [];
  const facts = [];
  if (value.reduction) {
    facts.push({
      id: "steinhaus-reduction",
      label: "Steinhaus–Moser reduction",
      value: value.reduction.derivation,
      certainty: "structural exact",
      ruleId: "steinhaus.polygon-reduction",
      detail: `The polygon construction ${value.reduction.notation} has been reduced with the defining finite iteration rule; the resulting power remains unexpanded.`,
    });
  }
  facts.push({
    id: "canonical-power",
    label: "canonical form",
    value: value.canonical,
    certainty: "structural exact",
    ruleId: "power.structural-preservation",
    detail: "The exact power construction is preserved; it has not been expanded into digits.",
  });
  const base = integerBase(value.base);
  const exponentText = structuralText(value.exponent);
  if (!base) return facts;

  const displayBaseInteger = BigInt(displayBase);
  if (base === displayBaseInteger) {
    facts.push({
      id: "matching-base-digits",
      label: `base-${displayBase} digits`,
      value: `${exponentText} + 1`,
      certainty: "derived exact",
      ruleId: "digits.base-power",
      detail: `A positive base-${displayBase} power has one leading digit followed by its exponent many zeros.`,
    });
  } else {
    facts.push({
      id: "base-digit-formula",
      label: `base-${displayBase} digits`,
      value: powerDigitFormula(value, displayBase),
      certainty: "derived exact formula",
      ruleId: "digits.base-power",
      detail: "The count is exact, but its floor has intentionally not been expanded.",
    });
  }

  // Always offer a decimal interval when a finite exact exponent lets us
  // evaluate the logarithmic expression. It complements, rather than replaces,
  // the exact formula above.
  const decimalEstimate = base === 10n ? null : decimalDigitEstimate(value);
  if (decimalEstimate) {
    facts.push({
      id: "decimal-digit-estimate",
      label: "base-10 digit estimate",
      value: `≈ ${compactDecimal(decimalEstimate)}`,
      certainty: "estimate",
      ruleId: "magnitude.decimal-digit-estimate",
      detail: "A compact bounded-precision evaluation of exponent × log₁₀(base) + 1. The adjacent digit-count formula remains exact.",
    });
  }

  const decimalInterval = outwardDecimalInterval(decimalEstimate);
  if (decimalInterval) {
    facts.push({
      id: "decimal-digit-interval",
      label: "base-10 digit interval",
      value: formatDecimalInterval(decimalInterval),
      certainty: "finite-precision interval",
      ruleId: "magnitude.decimal-digit-interval",
      detail: "A working-precision evaluation of exponent × log₁₀(base) + 1, rounded outward at the displayed precision. The adjacent digit-count formula remains exact.",
    });
  }

  if (base % 5n !== 0n) {
    facts.push({
      id: "decimal-trailing-zeroes",
      label: "decimal trailing zeros",
      value: "0",
      certainty: "derived exact",
      ruleId: "power.structural-preservation",
      detail: "A positive power of an integer not divisible by 5 cannot be divisible by 10.",
    });
  }

  const logLog = nestedPowerLogLog(value);
  if (logLog) {
    const logLogInterval = outwardDecimalInterval(logLog);
    facts.push({
      id: "decimal-digit-estimate",
      label: "base-10 digit estimate",
      value: `≈ 10^(${compactDecimal(logLog)})`,
      certainty: "estimate",
      ruleId: "magnitude.repeated-log",
      detail: "A compact repeated-log estimate of the decimal digit count's scale, not leading digits of n.",
    });
    facts.push({
      id: "decimal-digit-interval",
      label: "base-10 digit interval",
      value: logLogInterval ? `[10^(${compactDecimal(logLogInterval.lower)}), 10^(${compactDecimal(logLogInterval.upper)})]` : `≈ 10^(${compactDecimal(logLog)})`,
      certainty: logLogInterval ? "finite-precision interval" : "estimate",
      ruleId: "magnitude.repeated-log",
      detail: `The interval is formed from log₁₀(log₁₀(n)) at bounded working precision. It describes the scale of the decimal digit count, not leading digits of n.`,
    });
  }
  return facts;
}

export function structuralPowerMagnitudeSummary(value) {
  return structuralPowerFacts(value, 10).find((fact) => fact.id === "decimal-digit-estimate")?.value ?? null;
}

export function structuralPowerProvenance(value, displayBase = 10) {
  return structuralPowerFacts(value, displayBase).map((fact) => {
    const rule = structuralPowerRules[fact.ruleId];
    return {
      claim: `${fact.label}: ${fact.value}`,
      certainty: fact.certainty,
      ruleId: fact.ruleId,
      rule: rule?.title ?? fact.ruleId,
      approach: fact.detail,
      inputs: value.provenance?.[0]?.inputs ?? {},
      sources: rule?.sources ?? [],
    };
  });
}
