import { evaluateWithAnalysis } from "./engine.js";
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
      value: evaluateWithAnalysis(defaultHistoryExpression, new Map([["@n", String(position)]])),
    };
  }).reverse();
}

// Fresh workspaces are derived from expressions through the same evaluator the
// app uses, rather than carrying hand-written display values. The Mersenne
// prime is deliberate: its 6,002 digits make the default view a compact
// demonstration of the exact-integer and magnitude inspector paths.
const defaultHistory = createSeedHistory();
const defaultPreviewValue = evaluateWithAnalysis(defaultExpression);

export function createDefaultWorkspace() {
  return {
    expression: defaultExpression,
    history: defaultHistory.map((item) => ({ ...item })),
    nextId: defaultHistory.length + 1,
    previewValue: defaultPreviewValue,
  };
}
