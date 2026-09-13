export const exampleWorkbenches = {
  fibonacci: {
    title: "Fibonacci continuation",
    description: "Continue the sequence with relative History references.",
    schemaVersion: 1,
    activeExpression: { expression: "@history(-1) + @history(-2)" },
    history: [
      { id: 5, expression: "@history(-1) + @history(-2)" },
      { id: 4, expression: "@history(-1) + @history(-2)" },
      { id: 3, expression: "@history(-1) + @history(-2)" },
      { id: 2, expression: "1" },
      { id: 1, expression: "1" },
    ],
    nextHistoryId: 6,
  },
};
