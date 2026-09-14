function hasWholeOuterParentheses(expression) {
  if (!expression.startsWith("(") || !expression.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "(") depth += 1;
    else if (expression[index] === ")") depth -= 1;
    if (depth === 0 && index < expression.length - 1) return false;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function wrapExpressionForContinuation(expression) {
  const source = expression.trim();
  if (!source || hasWholeOuterParentheses(source)) return source;
  return `(${source})`;
}
