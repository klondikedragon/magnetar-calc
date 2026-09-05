import { functionCatalog } from "./functionCatalog.js";

const maximumExpressionLength = 12_000;
const maximumTokenCount = 2_400;

// This registry is the bridge between the catalog and the evaluator.  The
// parser only understands generic expression forms; extensions own names,
// operators, precedence, and engine implementation ids.
export const expressionImplementations = [
  ["constant-pi", { atoms: ["pi", "π"], kind: "constant", value: "pi" }],
  ["constant-e", { atoms: ["e"], kind: "constant", value: "e" }],
  ["constant-tau", { atoms: ["tau", "τ"], kind: "constant", value: "tau" }],
  ["constant-phi", { atoms: ["phi", "φ"], kind: "constant", value: "phi" }],
  ["history-previous", { atoms: ["@history"], kind: "reference" }],
  ["history-position", { atoms: ["@n"], kind: "reference" }],
  ["arithmetic-sqrt", { calls: ["sqrt"], prefix: ["√"], kind: "unary" }],
  ["arithmetic-abs", { calls: ["abs"], kind: "unary" }],
  ["arithmetic-min", { calls: ["min"], kind: "variadic" }],
  ["arithmetic-max", { calls: ["max"], kind: "variadic" }],
  ["arithmetic-power", { infix: ["^", "↑"], precedence: 30, associativity: "right", kind: "power" }],
  ["arithmetic-square", { kind: "template" }],
  ["arithmetic-factorial", { postfix: ["!"], precedence: 50, kind: "factorial" }],
  ["arithmetic-nth-root", { kind: "template" }],
  ["exponential-ten", { kind: "template" }],
  ["exponential-e", { kind: "template" }],
  ["exponential-exp", { calls: ["exp"], kind: "unary" }],
  ["logarithm-natural", { calls: ["ln"], kind: "unary" }],
  ["logarithm-base-ten", { calls: ["log"], kind: "unary" }],
  ["trigonometry-sin", { calls: ["sin"], kind: "unary" }],
  ["trigonometry-cos", { calls: ["cos"], kind: "unary" }],
  ["trigonometry-tan", { calls: ["tan"], kind: "unary" }],
  ["sequence-fibonacci", { calls: ["fib"], kind: "sequence" }],
  ["sequence-lucas", { calls: ["lucas"], kind: "sequence" }],
  ["sequence-nth-prime", { calls: ["prime"], kind: "sequence" }],
  ["sequence-prime-count", { calls: ["primepi"], kind: "sequence" }],
  ["sequence-partition", { calls: ["partition"], kind: "sequence" }],
  ["sequence-catalan", { calls: ["catalan"], kind: "sequence" }],
  ["sequence-bell", { calls: ["bell"], kind: "sequence" }],
  ["sequence-triangular", { calls: ["triangular"], kind: "sequence" }],
  ["sequence-harmonic", { calls: ["harmonic"], kind: "sequence" }],
  ["sequence-jacobsthal", { calls: ["jacobsthal"], kind: "sequence" }],
  ["combinatorics-stirling-second", { calls: ["stirling2"], kind: "sequence" }],
  ["combinatorics-binomial", { calls: ["binomial"], kind: "sequence" }],
  ["hierarchy-fgh1", { calls: ["fgh1"], kind: "hierarchy" }],
  ["hierarchy-fgh2", { calls: ["fgh2"], kind: "hierarchy" }],
  ["hierarchy-fgh3", { calls: ["fgh3"], kind: "hierarchy" }],
  ["hyperoperation-knuth-up", { infix: ["↑"], precedence: 30, associativity: "right", kind: "power" }],
  ["hyperoperation-knuth-double", { infix: ["↑↑", "^^"], precedence: 30, associativity: "right", kind: "tetration" }],
  ["arithmetic-modulo", { infix: ["mod", "%"], precedence: 20, associativity: "left", kind: "modulo" }],
];

const implementationMap = new Map(expressionImplementations);
const atomMap = new Map();
const callMap = new Map();
const prefixMap = new Map();
const postfixMap = new Map();
const infixMap = new Map();
for (const [id, definition] of expressionImplementations) {
  for (const token of definition.atoms ?? []) atomMap.set(token.toLowerCase(), { id, ...definition });
  for (const token of definition.calls ?? []) callMap.set(token.toLowerCase(), { id, ...definition });
  for (const token of definition.prefix ?? []) prefixMap.set(token, { id, ...definition });
  for (const token of definition.postfix ?? []) postfixMap.set(token, { id, ...definition });
  for (const token of definition.infix ?? []) infixMap.set(token, { id, ...definition });
}

export function implementationForCall(name) { return callMap.get(name.toLowerCase()); }
export function implementationForAtom(token) { return atomMap.get(token.toLowerCase()); }
export function implementationForInfix(token) {
  if (/^(?:\^+|↑+)$/.test(token) && token.length > 2) return { id: "hyperoperation-unavailable", kind: "unavailable-hyper", precedence: 30, associativity: "right" };
  return infixMap.get(token);
}
export function implementationForPrefix(token) { return prefixMap.get(token); }
export function implementationForPostfix(token) { return postfixMap.get(token); }
export function catalogImplementationIssues() {
  const missing = functionCatalog.filter((entry) => !implementationMap.has(entry.id)).map((entry) => entry.id);
  const orphaned = expressionImplementations.filter(([id]) => !functionCatalog.some((entry) => entry.id === id)).map(([id]) => id);
  return { missing, orphaned };
}

export function tokenizeExpression(source) {
  if (source.length > maximumExpressionLength) throw new Error("expression is too long");
  const tokens = [];
  let index = 0;
  const push = (type, value, start, end) => {
    tokens.push({ type, value, start, end });
    if (tokens.length > maximumTokenCount) throw new Error("expression is too complex");
  };
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) { index += 1; continue; }
    const start = index;
    if (character === "@") {
      const match = source.slice(index).match(/^@history\(-?\d+\)|^@n/);
      if (!match) throw new Error(`unsupported expression at character ${start + 1}`);
      index += match[0].length;
      push("reference", match[0], start, index);
      continue;
    }
    if (/\d/.test(character)) {
      const match = source.slice(index).match(/^\d+(?:\.\d*)?(?:e[+-]?\d+)?/i);
      index += match[0].length;
      push("number", match[0], start, index);
      continue;
    }
    if (/[A-Za-z]/.test(character)) {
      const match = source.slice(index).match(/^[A-Za-z][A-Za-z0-9]*/);
      index += match[0].length;
      push("identifier", match[0], start, index);
      continue;
    }
    if (character === "↑" || character === "^") {
      while (source[index] === character) index += 1;
      push("operator", source.slice(start, index), start, index);
      continue;
    }
    if ("(),+-*/%!×÷−πτφ√".includes(character)) {
      index += 1;
      push("symbol", character, start, index);
      continue;
    }
    throw new Error(`unsupported expression at character ${start + 1}`);
  }
  tokens.push({ type: "eof", value: "", start: source.length, end: source.length });
  return tokens;
}

const binaryOperators = new Map([
  ["+", { id: "arithmetic-add", kind: "add", precedence: 10, associativity: "left" }],
  ["-", { id: "arithmetic-subtract", kind: "subtract", precedence: 10, associativity: "left" }],
  ["−", { id: "arithmetic-subtract", kind: "subtract", precedence: 10, associativity: "left" }],
  ["*", { id: "arithmetic-multiply", kind: "multiply", precedence: 20, associativity: "left" }],
  ["×", { id: "arithmetic-multiply", kind: "multiply", precedence: 20, associativity: "left" }],
  ["/", { id: "arithmetic-divide", kind: "divide", precedence: 20, associativity: "left" }],
  ["÷", { id: "arithmetic-divide", kind: "divide", precedence: 20, associativity: "left" }],
]);
const implicitMultiply = { id: "arithmetic-multiply", kind: "multiply", precedence: 20, associativity: "left", implicit: true };

class PrattParser {
  constructor(tokens) { this.tokens = tokens; this.position = 0; }
  peek(offset = 0) { return this.tokens[this.position + offset]; }
  take() { return this.tokens[this.position++]; }
  expect(value, message = "unexpected token") { const token = this.take(); if (token.value !== value) throw new Error(message); return token; }
  beginsAtom(token) { return ["number", "reference", "identifier"].includes(token.type) || ["(", "π", "τ", "φ", "√"].includes(token.value); }
  infixFor(token) {
    if (token.type === "identifier" && token.value.toLowerCase() === "mod") return implementationForInfix("mod");
    return binaryOperators.get(token.value) ?? implementationForInfix(token.value);
  }
  parse() { const result = this.expression(0); if (this.peek().type !== "eof") throw new Error("unexpected token"); return result; }
  expression(minimum) {
    let left = this.prefix();
    while (true) {
      const postfix = implementationForPostfix(this.peek().value);
      if (postfix && postfix.precedence >= minimum) {
        const token = this.take();
        left = { type: "postfix", implementationId: postfix.id, operator: token.value, value: left, start: left.start, end: token.end };
        continue;
      }
      const explicit = this.infixFor(this.peek());
      const implicit = !explicit && this.beginsAtom(this.peek());
      const operation = explicit ?? (implicit ? implicitMultiply : null);
      if (!operation || operation.precedence < minimum) break;
      const token = implicit ? null : this.take();
      const right = this.expression(operation.associativity === "right" ? operation.precedence : operation.precedence + 1);
      left = { type: "binary", implementationId: operation.id, operator: token?.value ?? "*", left, right, implicit, start: left.start, end: right.end };
    }
    return left;
  }
  prefix() {
    const token = this.take();
    if (["+", "-", "−"].includes(token.value)) return { type: "unary", implementationId: token.value === "+" ? "arithmetic-positive" : "arithmetic-negative", operator: token.value, value: this.expression(40), start: token.start, end: this.peek(-1)?.end ?? token.end };
    const prefix = implementationForPrefix(token.value);
    if (prefix) { const value = this.expression(40); return { type: "unary", implementationId: prefix.id, operator: token.value, value, start: token.start, end: value.end }; }
    if (token.type === "number") return { type: "number", raw: token.value, start: token.start, end: token.end };
    if (token.type === "reference") return { type: "reference", token: token.value, implementationId: token.value === "@n" ? "history-position" : "history-previous", start: token.start, end: token.end };
    if (token.value === "(") { const value = this.expression(0); const close = this.expect(")", "missing parenthesis"); return { type: "group", value, start: token.start, end: close.end }; }
    const atom = implementationForAtom(token.value);
    if (atom) return { type: "atom", name: atom.value, implementationId: atom.id, start: token.start, end: token.end };
    if (token.type === "identifier") {
      if (this.peek().value !== "(") throw new Error("unknown value");
      this.take();
      const args = [];
      if (this.peek().value !== ")") {
        args.push(this.expression(0));
        while (this.peek().value === ",") { this.take(); args.push(this.expression(0)); }
      }
      const close = this.expect(")", "missing parenthesis");
      const implementation = implementationForCall(token.value);
      return { type: "call", name: token.value.toLowerCase(), implementationId: implementation?.id ?? null, args, start: token.start, end: close.end };
    }
    throw new Error("unexpected token");
  }
}

export function parseExpression(source) {
  return new PrattParser(tokenizeExpression(source)).parse();
}

export function astToExpression(ast) {
  if (ast.type === "number") return ast.raw;
  if (ast.type === "reference") return ast.token;
  if (ast.type === "atom") return ast.name;
  if (ast.type === "group") return `(${astToExpression(ast.value)})`;
  if (ast.type === "unary") return `${ast.operator}${astToExpression(ast.value)}`;
  if (ast.type === "postfix") return `${astToExpression(ast.value)}${ast.operator}`;
  if (ast.type === "call") return `${ast.name}(${ast.args.map(astToExpression).join(", ")})`;
  return `${astToExpression(ast.left)} ${ast.operator} ${astToExpression(ast.right)}`;
}
