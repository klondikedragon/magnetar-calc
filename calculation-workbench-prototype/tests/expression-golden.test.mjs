import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatically } from "../src/engine.js";

// This suite is the compatibility contract for the expression language.  New
// parser/extension work must add a case here before it changes supported syntax.
const successfulExpressions = [
  ["operator precedence", "2 + 3 * 4", "14"],
  ["right-associative powers", "2^3^2", "512"],
  ["Knuth single up-arrow", "2↑3", "8"],
  ["Knuth double up-arrow", "2↑↑3", "16"],
  ["double caret tetration alias", "2^^3", "16"],
  ["unicode root", "√(81)", "9"],
  ["named square root", "sqrt(81)", "9"],
  ["factorial", "5!", "120"],
  ["implicit multiplication with pi", "5pi", { prefix: "15.707963267948966192313216916397514420985846996875" }],
  ["natural logarithm", "ln(e)", { fixed: "1", places: 30 }],
  ["common logarithm", "log(100)", "2"],
  ["natural exponential", "exp(0)", "1"],
  ["trigonometry", "sin(0) + cos(0) + tan(0)", "1"],
  ["absolute value", "abs(-7)", "7"],
  ["minimum", "min(8, 3, 12)", "3"],
  ["maximum", "max(8, 3, 12)", "12"],
  ["modulo word operator", "9 mod 4", "1"],
  ["modulo symbol operator", "9 % 4", "1"],
  ["Fibonacci", "fib(10)", "55"],
  ["Lucas", "lucas(10)", "123"],
  ["nth prime", "prime(10)", "29"],
  ["prime counting", "primepi(100)", "25"],
  ["partition", "partition(5)", "7"],
  ["Catalan", "catalan(5)", "42"],
  ["Bell", "bell(5)", "52"],
  ["triangular", "triangular(10)", "55"],
  ["harmonic", "harmonic(3)", { prefix: "1.8333333333333333333333333333333333333333333333333" }],
  ["Jacobsthal", "jacobsthal(10)", "341"],
  ["Stirling second kind", "stirling2(5, 2)", "15"],
  ["binomial", "binomial(10, 3)", "120"],
  ["Wainer F1", "fgh1(8)", "16"],
  ["Wainer F2", "fgh2(3)", "24"],
  ["Wainer F3", "fgh3(2)", "2048"],
  ["history reference", "@history(-1) + @history(4)", "12", new Map([["@history(-1)", "5"], ["@history(4)", "7"]])],
  ["sequence position", "@n^2", "49", new Map([["@n", "7"]])],
];

const rejectedExpressions = [
  ["unknown reference", "@history(-1)", /unknown history reference/],
  ["missing closing parenthesis", "sqrt(4", /missing parenthesis/],
  ["unknown function", "doesnotexist(1)", /unknown function/],
  ["unsafe tetration", "3↑↑3↑↑3", /tetration height exceeds the current safety budget/],
  ["unsupported character", "2 & 3", /unsupported expression/],
];

for (const [name, expression, expected, references] of successfulExpressions) {
  test(`evaluates ${name}`, () => {
    const value = evaluateAutomatically(expression, references);
    const actual = value.decimal?.toString?.() ?? value.number?.toString();
    if (typeof expected === "string") assert.equal(actual, expected);
    else if (expected.prefix) assert.ok(actual.startsWith(expected.prefix));
    else assert.equal(value.decimal.toDecimalPlaces(expected.places).toString(), expected.fixed);
  });
}

for (const [name, expression, error] of rejectedExpressions) {
  test(`rejects ${name}`, () => {
    assert.throws(() => evaluateAutomatically(expression), error);
  });
}
