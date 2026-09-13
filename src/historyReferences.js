import { tokenizeExpression } from "./expressionLanguage.js";

function requestedTokens(expression) {
  if (expression === undefined || expression === null) return null;
  try {
    return new Set(tokenizeExpression(expression).filter((token) => token.type === "reference").map((token) => token.value));
  } catch {
    // The evaluator remains responsible for reporting incomplete syntax. An
    // invalid preview must not cause an unrelated History scan.
    return new Set();
  }
}

// Return only the values an expression can actually read. When no expression
// is supplied, retain the complete map for notebook recalculation workflows.
export function historyReferenceEntries(items, { expression, ordinal = items.length + 1 } = {}) {
  const requested = requestedTokens(expression);
  const include = (token) => requested === null || requested.has(token);
  const entries = [];
  for (const [index, item] of items.entries()) {
    const stable = `@history(${item.id})`;
    const relative = `@history(-${index + 1})`;
    if (include(stable)) entries.push([stable, item.value]);
    if (include(relative)) entries.push([relative, item.value]);
  }
  if (include("@n")) entries.push(["@n", String(ordinal)]);
  return entries;
}
