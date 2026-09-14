import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Decimal from "decimal.js";
import { evaluateAutomatically } from "../src/engine.js";
import { exampleCatalog } from "../src/exampleCatalog.js";
import { validateNotebook } from "../src/notebook.js";

const oraclePath = fileURLToPath(new URL("./oracles/math_oracle.py", import.meta.url));
const oracleCases = [
  { id: "factorial-50", expression: "50!", kind: "exact", operation: "factorial", arguments: ["50"] },
  { id: "power-2-500", expression: "2^500", kind: "exact", operation: "power", arguments: ["2", "500"] },
  { id: "binomial-100-50", expression: "binomial(100, 50)", kind: "exact", operation: "binomial", arguments: ["100", "50"] },
  { id: "fibonacci-200", expression: "fib(200)", kind: "exact", operation: "fibonacci", arguments: ["200"] },
  { id: "lucas-100", expression: "lucas(100)", kind: "exact", operation: "lucas", arguments: ["100"] },
  { id: "recaman-250", expression: "recaman(250)", kind: "exact", operation: "recaman", arguments: ["250"] },
  { id: "stern-100000", expression: "stern(100000)", kind: "exact", operation: "stern", arguments: ["100000"] },
  { id: "catalan-50", expression: "catalan(50)", kind: "exact", operation: "catalan", arguments: ["50"] },
  { id: "bell-20", expression: "bell(20)", kind: "exact", operation: "bell", arguments: ["20"] },
  { id: "stirling-15-6", expression: "stirling2(15, 6)", kind: "exact", operation: "stirling2", arguments: ["15", "6"] },
  { id: "pi", expression: "pi", kind: "transcendental", operation: "pi", digits: 90 },
  { id: "e", expression: "e", kind: "transcendental", operation: "e", digits: 90 },
  { id: "sqrt-2", expression: "sqrt(2)", kind: "transcendental", operation: "sqrt", arguments: ["2"], digits: 90 },
  { id: "ln-2", expression: "ln(2)", kind: "transcendental", operation: "ln", arguments: ["2"], digits: 90 },
  { id: "log10-2", expression: "log(2)", kind: "transcendental", operation: "log10", arguments: ["2"], digits: 90 },
  { id: "sin-pi-sevenths", expression: "sin(pi / 7)", kind: "transcendental", operation: "sin", arguments: ["pi/7"], digits: 90 },
  { id: "cos-pi-sevenths", expression: "cos(pi / 7)", kind: "transcendental", operation: "cos", arguments: ["pi/7"], digits: 90 },
  { id: "atan-1", expression: "atan(1)", kind: "transcendental", operation: "atan", arguments: ["1"], digits: 90 },
  { id: "exp-1", expression: "exp(1)", kind: "transcendental", operation: "exp", arguments: ["1"], digits: 90 },
];

const exampleSequenceCases = [
  ["fibonacci", "fibonacci"],
  ["lucas", "lucas"],
  ["pell", "pell"],
  ["tribonacci", "tribonacci"],
  ["padovan", "padovan"],
  ["recaman", "recaman"],
  ["stern", "stern"],
  ["yellowstone", "yellowstone"],
  ["kangaroo", "kangaroo"],
].flatMap(([id, operation]) => Array.from({ length: 100 }, (_, index) => ({
  id: `${id}-${index}`,
  kind: "exact",
  operation,
  arguments: [String(id === "fibonacci" || id === "kangaroo" ? index + 1 : index)],
})));

function runOracle(cases) {
  try {
    return JSON.parse(execFileSync("py", ["-3", oraclePath], {
      encoding: "utf8",
      input: JSON.stringify(cases),
      windowsHide: true,
    }));
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    throw new Error(`Python oracle unavailable. Install test-only requirements with: py -3 -m pip install -r tests/oracles/requirements.txt${output ? `\n${output}` : ""}`);
  }
}

function calculatorDecimal(expression, calculationPrecision = 120) {
  const value = evaluateAutomatically(expression, new Map(), { calculationPrecision });
  assert.equal(value.kind, "decimal.js", `${expression} should stay in the Decimal engine`);
  return value.decimal;
}

test("matches SymPy exact integer and sequence results", () => {
  const cases = oracleCases.filter((item) => item.kind === "exact");
  const oracle = runOracle(cases);
  for (const item of cases) {
    const value = evaluateAutomatically(item.expression, new Map(), { calculationPrecision: 200 });
    assert.equal(value.kind, "exact-integer", `${item.expression} should remain exact`);
    assert.equal(value.exactInteger, oracle[item.id], item.expression);
  }
});

test("matches independent 100-term example sequence generators", () => {
  const oracle = runOracle(exampleSequenceCases);
  const exampleIds = {
    fibonacci: "history.fibonacci-continuation",
    lucas: "sequences.lucas-companion",
    pell: "sequences.pell-silver-ratio",
    tribonacci: "sequences.tribonacci",
    padovan: "sequences.padovan-plastic",
  };
  for (const [name, exampleId] of Object.entries(exampleIds)) {
    const notebook = validateNotebook(exampleCatalog.find((entry) => entry.id === exampleId).notebook);
    const values = [];
    for (const entry of [...notebook.history].reverse()) {
      const references = new Map(values.map((value, index) => [`@history(-${values.length - index})`, value]));
      values.push(evaluateAutomatically(entry.expression, references));
    }
    values.forEach((value, index) => assert.equal(value.exactInteger, oracle[`${name}-${index}`], `${name}-${index}`));
  }
  for (let index = 0; index < 100; index += 1) {
    for (const name of ["recaman", "stern", "yellowstone", "kangaroo"]) {
      const argument = name === "yellowstone" || name === "kangaroo" ? index + 1 : index;
      const value = evaluateAutomatically(`${name}(${argument})`);
      assert.equal(value.exactInteger, oracle[`${name}-${index}`], `${name}-${index}`);
    }
  }
});

test("matches mpmath high-precision transcendental results", () => {
  const cases = oracleCases.filter((item) => item.kind === "transcendental");
  const oracle = runOracle(cases);
  const tolerance = new Decimal("1e-60");
  for (const item of cases) {
    const actual = calculatorDecimal(item.expression);
    const expected = new Decimal(oracle[item.id]);
    const relativeError = actual.minus(expected).abs().div(Decimal.max(expected.abs(), 1));
    assert.ok(relativeError.lte(tolerance), `${item.expression} relative error ${relativeError.toExponential()}`);
  }
});
