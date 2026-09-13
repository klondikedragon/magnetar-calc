import { astToExpression, parseExpression } from "./expressionLanguage.js";

const number = (raw) => ({ type: "number", raw: String(raw) });
const reference = (token) => ({ type: "reference", token, implementationId: token === "@n" ? "history-position" : "history-previous" });
const binary = (left, operator, right) => ({ type: "binary", left, operator, right });
const call = (name, ...args) => ({ type: "call", name, args });

function sourceFromSeedAst(ast) {
  const source = astToExpression(ast);
  // The AST builder constrains the seed vocabulary; parsing the rendered
  // source keeps the seed coupled to the public calculator grammar too.
  parseExpression(source);
  return source;
}

const mersenne19937 = binary(binary(number(2), "^", number(19937)), "-", number(1));
const fibonacciAtPosition = call("fib", binary(reference("@n"), "-", number(1)));

export const defaultExpression = sourceFromSeedAst(mersenne19937);
export const defaultHistoryExpression = sourceFromSeedAst(fibonacciAtPosition);

function createSeedHistory() {
  return Array.from({ length: 10 }, (_, index) => {
    const position = index + 1;
    return {
      id: position,
      expression: defaultHistoryExpression,
    };
  }).reverse();
}

// Seeds are deliberately declarative. Importing this module must never run the
// calculator engine: the app paints first, then sends these expressions through
// the same preview and History worker paths used for every other calculation.
const defaultHistory = createSeedHistory();

export function createDefaultWorkspace() {
  return {
    expression: defaultExpression,
    history: defaultHistory.map((item) => ({ ...item })),
    nextId: defaultHistory.length + 1,
  };
}
