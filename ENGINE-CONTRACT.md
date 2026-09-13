# Placeholder number-engine contract

The interactive prototype deliberately separates arithmetic from presentation. The temporary implementation only evaluates ordinary JavaScript-sized calculations; the production engine should fulfill this interface without changing the surrounding UX.

```ts
type NumberHandle = { id: string };
type NumberParts = {
  sign: -1 | 0 | 1;
  coefficient: { digits: string; radix: number };
  exponent: NumberHandle;
  classification: "finite" | "infinity" | "nan" | "ordinal";
};

type RenderedNumber = {
  compact: string;       // Fits the available display width.
  fullText: string;      // Lossless copy/tooltip representation.
  accessibleText: string;
  parts: NumberParts;    // Used by the coefficient/exponent inspector.
  truncation: { hiddenDigits: number; hiddenExponentDigits: number };
};

interface MagnitudeEngine {
  parse(expression: string, context: { defaultInputBase: number }): NumberHandle;
  evaluate(expression: string, references: Map<string, NumberHandle>): NumberHandle;
  render(value: NumberHandle, options: {
    displayBase: number;
    significantDigits: number;
    availableWidthPx: number;
    notation: "scientific" | "engineering" | "expanded";
  }): RenderedNumber;
  parts(value: NumberHandle): NumberParts;
  serialize(value: NumberHandle, options: { base: number; lossless: true }): string;
  convertDisplay(value: NumberHandle, displayBase: number): RenderedNumber;
}
```

## UX implications

- `@history(n)` is a stable reference token, never a pasted truncated number. IDs increase monotonically from 1 and reset only when History is reset. It keeps the active expression compact and lets an engine preserve a number whose exponent cannot fit native numeric types.
- Every visible result needs both `compact` and `fullText`: compact is width-aware; full text drives the hover inspector and Copy full precision action.
- Changing display base, notation, or precision calls `convertDisplay`/`render`, not `evaluate`. The underlying `NumberHandle` remains unchanged, including for every visible History row.
- Mixed-base input belongs to `parse` (for example `0xFF + base(7, 346)`); rendering is independently controlled by `displayBase`.
- The future work trail stores `NumberHandle` values and result-reference ids, not formatted strings.
