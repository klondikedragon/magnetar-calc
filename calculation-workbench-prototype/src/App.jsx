import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, RotateCcw, Save } from "lucide-react";
import { VirtuosoGrid } from "react-virtuoso";
import { deserializeValue, digitCountAutomatically, evaluateWithAnalysis, exportPrecision, formatAutomatically, formatDigitCountForInspector, formatForHighPrecisionExport, inspectAutomatically, serializeValue } from "./engine";
import { createNotebook, validateNotebook } from "./notebook";
import { exampleWorkbenches } from "./exampleWorkbenches";
import { filterFunctionCatalog, functionCategories, functionInsertion } from "./functionCatalog";
import { useDismissiblePopover } from "./useDismissiblePopover";

const initialHistory = [
  { id: 3, expression: "√(2) + π / 7", value: { kind: "number", number: 1.862012077376797, full: "1.862012077376796985004668721836731291106586140266324758279159345760390983" } },
  { id: 2, expression: "prior ÷ (log₁₀(10^64) + 1)", value: { kind: "large", sign: "", significand: "3.057294822950537", exponent: "1022", full: "3.057294822950537259286373091729847192504187759103445218936482103664918764203795018624 × 10^1022" } },
  { id: 1, expression: "(τ × 10^512) ^ φ", value: { kind: "large", sign: "", significand: "1.987241634917849218536142", exponent: "1024", full: "1.987241634917849218536142897624451906847214981320447218049332918764303781920784391825304816973420198 × 10^1024" } },
];

const modes = ["Calculator", "Scientific", "Trigonometry", "Number theory", "Sequences", "Ordinal / hierarchy", "Programmer"];
const keys = [
  ["AC", "⌫", "(·)", "Ans", "f(x)", "="],
  ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ"],
  ["sin", "cos", "tan", "ln", "log", "!"],
  ["π", "e", "τ", "abs", "mod", "%"],
  ["7", "8", "9", "÷", "×", "−"],
  ["4", "5", "6", "+", "(", ")"],
  ["1", "2", "3", ".", "0", "="],
];
const numberTheoryKeys = keys.map((row, index) => index === 3 ? ["π", "e", "τ", "↑", "↑↑", "mod"] : row);
const sequenceKeys = keys.map((row, index) => index === 1 ? ["Fₙ", "Lₙ", "pₙ", "π(n)", "P(n)", "Cₙ"] : index === 2 ? ["Bₙ", "Tₙ", "Hₙ", "Jₙ", "S(n,k)", "nCr"] : index === 3 ? ["φ", "@n", "min", "max", "Custom 1", "Custom 2"] : row);
const ordinalKeys = keys.map((row, index) => index === 1 ? ["F₁(n)", "F₂(n)", "F₃(n)", "F₄(n)", "F₅(n)", "Fω(n)"] : index === 2 ? ["ω", "ω²", "ω^ω", "ε₀", "α", "Ordinal…"] : index === 3 ? ["π", "e", "φ", "↑", "↑↑", "mod"] : row);
const sequenceHelp = {
  "Fₙ": "Fibonacci sequence — each term is the sum of the two preceding terms.", "Lₙ": "Lucas sequence — Fibonacci's companion sequence beginning 2, 1.", "pₙ": "Nth prime — exact for a practical finite range.", "π(n)": "Prime-counting function — number of primes less than or equal to n.", "P(n)": "Partition number — ways to write n as a sum of positive integers.", "Cₙ": "Catalan number — counts many recursively nested combinatorial structures.", "Bₙ": "Bell number — number of partitions of a set of n elements.", "Tₙ": "Triangular number — 1 + 2 + … + n.", "Hₙ": "Harmonic number — 1 + 1/2 + … + 1/n.", "Jₙ": "Jacobsthal sequence — J(n)=J(n−1)+2J(n−2).", "S(n,k)": "Stirling number of the second kind — partitions n labeled objects into k nonempty sets.", nCr: "Binomial coefficient — ways to choose r items from n.", φ: "Golden ratio — (1 + √5) / 2; the limiting ratio of Fibonacci terms.", "@n": "Sequence position — the next entry’s 1-based position from the start of History.", min: "Minimum of two or more values — min(a, b, …).", max: "Maximum of two or more values — max(a, b, …).", "Custom 1": "Reserved for a future custom sequence.", "Custom 2": "Reserved for a future custom sequence.",
};
const ordinalHelp = { "F₁(n)": "Wainer fast-growing hierarchy: F1(n)=2n.", "F₂(n)": "Wainer fast-growing hierarchy: F2(n)=n·2ⁿ.", "F₃(n)": "Wainer fast-growing hierarchy: iterate F2, n times, starting at n.", "F₄(n)": "Wainer fast-growing hierarchy — shown structurally until the ordinal engine is available.", "F₅(n)": "Wainer fast-growing hierarchy — shown structurally until the ordinal engine is available.", "Fω(n)": "Diagonal Wainer function Fω(n)=Fn(n); reserved for the ordinal engine.", ω: "First infinite ordinal; ordinal notation support is forthcoming.", "ω²": "Ordinal omega squared; ordinal notation support is forthcoming.", "ω^ω": "Ordinal omega to omega; ordinal notation support is forthcoming.", "ε₀": "Epsilon nought; ordinal notation support is forthcoming.", α: "Ordinal parameter; ordinal notation support is forthcoming.", "Ordinal…": "Reserved for ordinal notation tools." };
const storageKey = "elephant-calc/workbench/v1";
const savePickerCancelled = Symbol("save-picker-cancelled");
const maximumDisplayPrecision = 10_000;
const precisionSliderSteps = 1000;
const precisionToSlider = (digits) => digits <= 0 ? 0 : Math.round((Math.log10(Math.min(digits, maximumDisplayPrecision) + 1) / Math.log10(maximumDisplayPrecision + 1)) * precisionSliderSteps);
const sliderToPrecision = (position) => position <= 0 ? 0 : Math.round((10 ** ((position / precisionSliderSteps) * Math.log10(maximumDisplayPrecision + 1))) - 1);
const keyLabels = { AC: "Clear expression", "⌫": "Backspace", "(·)": "Wrap selected text, or the whole expression, in parentheses", Ans: "Insert latest History result — @history(-1)", "f(x)": "Browse and insert a function", "=": "Calculate and save to History", "x²": "Square", "xʸ": "Raise to a power", "√x": "Square root", "ⁿ√x": "Nth root", "10ˣ": "Ten to a power", "eˣ": "Euler's number to a power", "π": "Insert pi", "τ": "Insert tau", "↑": "Insert Knuth up arrow", "↑↑": "Insert Knuth double up arrow", "−": "Subtract", "×": "Multiply", "÷": "Divide", "@n": "Insert the next sequence position", min: "Insert minimum function", max: "Insert maximum function" };

function isEditableElement(target) {
  return target instanceof HTMLElement && (target.matches("textarea, input, select, [contenteditable='true']") || target.isContentEditable);
}

function calculationErrorMessage(message) {
  if (message === "engine range exceeded") return "Outside the current engine range";
  if (message?.includes("safety budget")) return "Tetration exceeds the current safety budget";
  if (message?.includes("expression is too long") || message?.includes("expression is too complex")) return "Expression exceeds the current safety budget";
  return "Check this expression";
}

function readStoredWorkspace() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function historyReferences(items) {
  return [...items.flatMap((item, index) => {
    const value = serializeValue(item.value);
    return [[`@history(${item.id})`, value], [`@history(-${index + 1})`, value]];
  }), ["@n", String(items.length + 1)]];
}

export function App() {
  const [storedWorkspace] = useState(readStoredWorkspace);
  const [expression, setExpression] = useState(() => storedWorkspace?.expression ?? "√(2) + π / 7");
  const [base, setBase] = useState(() => storedWorkspace?.view?.base ?? storedWorkspace?.base ?? 10);
  const [precision, setPrecision] = useState(() => storedWorkspace?.view?.precision ?? storedWorkspace?.precision ?? 48);
  const [notation, setNotation] = useState(() => storedWorkspace?.view?.notation ?? storedWorkspace?.notation ?? "auto");
  const [groupDigits, setGroupDigits] = useState(() => storedWorkspace?.view?.groupDigits ?? true);
  const [activeMode, setActiveMode] = useState(() => storedWorkspace?.view?.activeMode ?? storedWorkspace?.activeMode ?? "Calculator");
  const [history, setHistory] = useState(() => storedWorkspace?.history?.map((item) => ({ ...item, value: deserializeValue(item.value) })) ?? initialHistory);
  const [nextId, setNextId] = useState(() => storedWorkspace?.nextId ?? 4);
  const [memory, setMemory] = useState(() => storedWorkspace?.memory ? { ...storedWorkspace.memory, value: deserializeValue(storedWorkspace.memory.value) } : null);
  const [previewValue, setPreviewValue] = useState(() => deserializeValue(storedWorkspace?.previewValue) ?? initialHistory[0].value);
  const [calculation, setCalculation] = useState({ status: "idle", commitOnSuccess: false, startedAt: 0 });
  const [showCalculating, setShowCalculating] = useState(false);
  const [toast, setToast] = useState("");
  const [expressionError, setExpressionError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportAnswers, setExportAnswers] = useState("none");
  const [exportView, setExportView] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [functionBrowserOpen, setFunctionBrowserOpen] = useState(false);
  const [functionQuery, setFunctionQuery] = useState("");
  const [functionCategory, setFunctionCategory] = useState("All");
  const [functionView, setFunctionView] = useState("compact");
  const [pendingImport, setPendingImport] = useState(null);
  const [transferStatus, setTransferStatus] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [expressionLines, setExpressionLines] = useState(1);
  const expressionRef = useRef(null);
  const memoryFeedbackTimer = useRef(null);
  const memoryDialogRef = useRef(null);
  const memoryCloseRef = useRef(null);
  const priorFocusRef = useRef(null);
  const jobCounterRef = useRef(0);
  const workerRef = useRef(null);
  const exportWorkerRef = useRef(null);
  const notebookOperationRef = useRef(null);
  const importInputRef = useRef(null);
  const examplesMenuRef = useRef(null);
  const examplesButtonRef = useRef(null);
  const functionSearchRef = useRef(null);
  const functionPriorFocusRef = useRef(null);
  const functionSelectionRef = useRef({ start: 0, end: 0 });
  const commitOnSuccessRef = useRef(false);
  const completedExpressionRef = useRef("");
  useDismissiblePopover(examplesOpen, () => setExamplesOpen(false), examplesMenuRef, examplesButtonRef);
  const focusExpression = () => requestAnimationFrame(() => expressionRef.current?.focus());
  function sizeExpression(input = expressionRef.current) {
    if (!input) return;
    input.style.height = "auto";
    const style = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(style.lineHeight) || 28;
    const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const height = Math.min(input.scrollHeight, (8 * lineHeight) + verticalPadding);
    input.style.height = `${height}px`;
    setExpressionLines(Math.max(1, Math.ceil((height - verticalPadding) / lineHeight)));
  }
  useEffect(() => { requestAnimationFrame(() => sizeExpression()); }, [expression, expressionLines]);
  useEffect(() => {
    const strip = document.querySelector(".memory-strip");
    const returnFocus = (event) => { if (!event.target.closest(".memory-chip")) focusExpression(); };
    strip?.addEventListener("click", returnFocus);
    return () => strip?.removeEventListener("click", returnFocus);
  }, []);
  useEffect(() => {
    examplesMenuRef.current = document.querySelector(".examples-menu");
    examplesButtonRef.current = document.querySelector(".examples-button");
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        expression, nextId,
        view: { base, precision, notation, groupDigits, activeMode },
        previewValue: serializeValue(previewValue),
        history: history.map((item) => ({ ...item, value: serializeValue(item.value) })),
        memory: memory ? { ...memory, value: serializeValue(memory.value) } : null,
      }));
    } catch { /* Storage is optional; the calculator remains usable without it. */ }
  }, [expression, base, precision, notation, groupDigits, activeMode, nextId, previewValue, history, memory]);
  const precisionLabel = useMemo(() => precision.toLocaleString(), [precision]);
  const paletteKeys = activeMode === "Number theory" ? numberTheoryKeys : activeMode === "Sequences" ? sequenceKeys : activeMode === "Programmer" ? keys : activeMode === "Trigonometry" ? keys : activeMode === "Scientific" ? keys : activeMode === "Ordinal / hierarchy" ? ordinalKeys : keys;
  const paletteHelp = activeMode === "Sequences" ? sequenceHelp : activeMode === "Ordinal / hierarchy" ? ordinalHelp : {};
  const preview = formatAutomatically(previewValue, { base, precision, notation, groupDigits });
  const inspection = inspectAutomatically(previewValue, { base, precision, notation });
  const digitCount = digitCountAutomatically(previewValue, base);
  const filteredFunctions = useMemo(() => filterFunctionCatalog(functionQuery, functionCategory), [functionQuery, functionCategory]);

  const referenceValues = useMemo(() => new Map([...history.flatMap((item, index) => {
    const value = item.value.kind === "number" ? String(item.value.number) : item.value.decimal?.toString?.() ?? "1e308";
    return [[`@history(${item.id})`, value], [`@history(-${index + 1})`, value]];
  }), ["@n", String(history.length + 1)]]), [history]);
  // Primality annotations are presentation metadata, not calculation inputs.
  // Keep the calculation worker stable when an asynchronous badge arrives.
  const historyReferenceKey = history.map((item) => `${item.id}:${item.value.kind}:${item.value.decimal?.toString?.() ?? item.value.number ?? item.value.full}:${item.value.exactInteger ?? ""}`).join("|");
  const workerReferences = useMemo(() => historyReferences(history), [historyReferenceKey]);

  function updatePreview(nextExpression) {
    commitOnSuccessRef.current = false;
    setExpression(nextExpression);
    setExpressionError("");
  }

  useEffect(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    const source = expression.trim();
    if (!source) { setCalculation({ status: "idle", commitOnSuccess: false, startedAt: 0 }); return undefined; }
    const jobId = ++jobCounterRef.current;
    setCalculation({ status: "debouncing", commitOnSuccess: commitOnSuccessRef.current, startedAt: Date.now() });
    const debounce = setTimeout(() => {
      const worker = new Worker(new URL("./calculation-worker.js", import.meta.url), { type: "module" });
      workerRef.current = worker;
      setCalculation((current) => ({ ...current, status: "computing" }));
      const deadline = setTimeout(() => { worker.terminate(); if (jobId === jobCounterRef.current) setCalculation((current) => ({ ...current, status: "timed-out" })); }, 10000);
      worker.onmessage = ({ data }) => {
        clearTimeout(deadline);
        if (jobId !== jobCounterRef.current) return;
        worker.terminate(); workerRef.current = null;
        if (data.type === "error") { setExpressionError(calculationErrorMessage(data.message)); setCalculation({ status: "failed", commitOnSuccess: false, startedAt: 0 }); return; }
        const value = deserializeValue(data.value);
        setPreviewValue(value);
        completedExpressionRef.current = source;
        const shouldCommit = commitOnSuccessRef.current;
        setCalculation({ status: "completed", commitOnSuccess: false, startedAt: 0 });
        if (shouldCommit) { commitOnSuccessRef.current = false; setNextId((id) => { setHistory((items) => [{ id, expression: source, value }, ...items]); return id + 1; }); setToast("Saved to History"); setTimeout(() => setToast(""), 1500); }
      };
      worker.postMessage({ jobId, expression: source, references: workerReferences, options: { precision } });
    }, 120);
    return () => { clearTimeout(debounce); workerRef.current?.terminate(); };
  }, [expression, precision, workerReferences]);
  useEffect(() => () => { exportWorkerRef.current?.terminate(); notebookOperationRef.current?.worker?.terminate(); }, []);
  useEffect(() => {
    if (!["debouncing", "computing"].includes(calculation.status)) { setShowCalculating(false); return undefined; }
    const timer = setTimeout(() => setShowCalculating(true), 300);
    return () => clearTimeout(timer);
  }, [calculation.status]);

  function commit() {
    if (!expression.trim()) return;
    if (completedExpressionRef.current !== expression) { commitOnSuccessRef.current = true; setCalculation((current) => ({ ...current, commitOnSuccess: true })); return; }
    try {
      const value = previewValue;
      setHistory((items) => [{ id: nextId, expression, value }, ...items]);
      setNextId((id) => id + 1);
      setToast("Saved to History");
      setTimeout(() => setToast(""), 1500);
    } catch (error) { setExpressionError(calculationErrorMessage(error?.message)); setToast("Expression not saved"); }
  }

  function cancelCalculation() {
    jobCounterRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    commitOnSuccessRef.current = false;
    setCalculation({ status: "cancelled", commitOnSuccess: false, startedAt: 0 });
  }

  function addToMemory() {
    const showMemoryFeedback = (message) => {
      setToast(message);
      clearTimeout(memoryFeedbackTimer.current);
      memoryFeedbackTimer.current = setTimeout(() => setToast(""), 1800);
    };
    if (!expression.trim()) { showMemoryFeedback("Nothing to add to memory"); return; }
    if (expressionError) { showMemoryFeedback("Fix expression before adding to memory"); return; }
    try {
      const nextExpression = memory?.expression ? `(${memory.expression}) + (${expression})` : expression;
      const nextValue = evaluateWithAnalysis(nextExpression, referenceValues, { precision });
      setMemory({ expression: nextExpression, value: nextValue });
      showMemoryFeedback("Added to memory");
    } catch { showMemoryFeedback("Memory could not be updated"); }
  }

  function appendKey(key) {
    if (key === "f(x)") { openFunctionBrowser(); return; }
    if (key === "=") { commit(); focusExpression(); return; }
    if (key === "AC") { setExpression(""); setToast(""); focusExpression(); return; }
    if (key === "⌫") {
      const start = expressionRef.current?.selectionStart ?? expression.length;
      const end = expressionRef.current?.selectionEnd ?? start;
      const caret = start !== end ? start : Math.max(0, start - 1);
      updatePreview(start !== end ? `${expression.slice(0, start)}${expression.slice(end)}` : `${expression.slice(0, caret)}${expression.slice(end)}`);
      requestAnimationFrame(() => { expressionRef.current?.focus(); expressionRef.current?.setSelectionRange(caret, caret); });
      return;
    }
    if (key === "Ans") {
      if (!history.length) { setToast("No History result available"); setTimeout(() => setToast(""), 1600); focusExpression(); return; }
      updatePreview(`${expression}@history(-1)`);
      focusExpression();
      return;
    }
    if (key === "M+") { addToMemory(); focusExpression(); return; }
    if (key.startsWith("Custom") || ["Fω(n)", "ω", "ω²", "ω^ω", "ε₀", "α", "Ordinal…"].includes(key)) { setToast("Reserved for the upcoming custom/ordinal engine"); setTimeout(() => setToast(""), 1600); focusExpression(); return; }
    const input = expressionRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    const selected = expression.slice(start, end);
    const replaceSelection = (insert, caret = insert.length) => {
      const next = `${expression.slice(0, start)}${insert}${expression.slice(end)}`;
      updatePreview(next);
      requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + caret, start + caret); });
    };
    if (key === "(·)") {
      if (selected) return replaceSelection(`(${selected})`, selected.length + 2);
      const next = expression ? `(${expression})` : "()";
      const caret = expression ? next.length : 1;
      updatePreview(next);
      requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(caret, caret); });
      return;
    }
    if (key === "(") return replaceSelection(selected ? `(${selected})` : "()", selected ? selected.length + 2 : 1);
    if (key === ")") return replaceSelection(")");
    const unary = { "√x": "√", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log", abs: "abs", "Fₙ": "fib", "Lₙ": "lucas", "pₙ": "prime", "π(n)": "primepi", "P(n)": "partition", "Cₙ": "catalan", "Bₙ": "bell", "Tₙ": "triangular", "Hₙ": "harmonic", "Jₙ": "jacobsthal", "F₁(n)": "fgh1", "F₂(n)": "fgh2", "F₃(n)": "fgh3", "F₄(n)": "fgh4", "F₅(n)": "fgh5" }[key];
    if (unary) return replaceSelection(`${unary}(${selected})`, unary.length + 1 + selected.length);
    if (key === "x²") return replaceSelection(selected ? `(${selected})^2` : "^2", selected ? selected.length + 4 : 2);
    if (key === "!") return replaceSelection(selected ? `(${selected})!` : "!", selected ? selected.length + 3 : 1);
    if (key === "min" || key === "max") return replaceSelection(selected ? `${key}(${selected}, )` : `${key}(, )`, selected ? key.length + selected.length + 3 : key.length + 1);
    const insert = { "xʸ": "^", "ⁿ√x": "^(1/", "10ˣ": "10^", "eˣ": "e^", φ: "phi", "S(n,k)": "stirling2(, )", nCr: "binomial(, )" }[key] ?? key;
    replaceSelection(insert);
  }

  function selectableContainer(target) {
    if (target instanceof Element) return target.closest(".selectable-output, .selectable-text");
    const anchorParent = window.getSelection()?.anchorNode?.parentElement;
    return anchorParent?.closest(".selectable-output, .selectable-text") ?? null;
  }

  function hasTextSelection() { return Boolean(window.getSelection?.()?.toString()); }

  function selectContainerText(element) {
    const selection = window.getSelection();
    if (!selection || !element) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  useEffect(() => {
    const routeKeyboard = (event) => {
      if (memoryOpen || functionBrowserOpen || isEditableElement(event.target)) return;
      const selectable = selectableContainer(event.target);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (selectable) return selectContainerText(selectable);
        expressionRef.current?.focus();
        expressionRef.current?.setSelectionRange(0, expression.length);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      if (!/^[0-9A-Za-z.()+\-*/%^!πτ↑]$/.test(event.key)) return;
      event.preventDefault();
      const wasEditingExpression = document.activeElement === expressionRef.current;
      expressionRef.current?.focus();
      if (!wasEditingExpression) expressionRef.current?.setSelectionRange(expression.length, expression.length);
      appendKey({ "*": "×", "/": "÷", "-": "−" }[event.key] ?? event.key);
    };
    window.addEventListener("keydown", routeKeyboard);
    return () => window.removeEventListener("keydown", routeKeyboard);
  }, [expression, memoryOpen, functionBrowserOpen]);

  useEffect(() => {
    if (!memoryOpen) return;
    const trapFocus = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeMemory(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(memoryDialogRef.current?.querySelectorAll("button, [href], textarea, input, select, [tabindex]:not([tabindex='-1'])") ?? [])].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const current = document.activeElement;
      const index = focusable.indexOf(current);
      if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    };
    requestAnimationFrame(() => memoryCloseRef.current?.focus());
    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [memoryOpen]);

  useEffect(() => {
    if (!functionBrowserOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeFunctionBrowser();
    };
    requestAnimationFrame(() => functionSearchRef.current?.focus());
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [functionBrowserOpen]);

  async function copyDisplayed(value) {
    try { await navigator.clipboard.writeText(formatAutomatically(value, { base, precision, notation, groupDigits }).text); setToast("Displayed result copied"); setTimeout(() => setToast(""), 1500); }
    catch { setToast("Copy is available in the browser"); }
  }

  function cancelHighPrecisionExport() {
    exportWorkerRef.current?.terminate();
    exportWorkerRef.current = null;
    setExportStatus("High-precision export cancelled");
    setTimeout(() => setExportStatus(""), 1800);
  }

  function exportHighPrecision(sourceExpression) {
    if (!sourceExpression?.trim() || exportWorkerRef.current) return;
    setExportStatus("Recalculating up to 10M digits…");
    const worker = new Worker(new URL("./calculation-worker.js", import.meta.url), { type: "module" });
    exportWorkerRef.current = worker;
    const deadline = setTimeout(() => {
      worker.terminate();
      if (exportWorkerRef.current === worker) {
        exportWorkerRef.current = null;
        setExportStatus("10M-digit export reached its time budget");
      }
    }, 10000);
    worker.onmessage = async ({ data }) => {
      clearTimeout(deadline);
      if (exportWorkerRef.current !== worker) return;
      worker.terminate();
      exportWorkerRef.current = null;
      if (data.type === "error") {
        setExportStatus(data.message === "engine range exceeded" ? "This expression requires the wide-range engine" : "10M-digit export could not be calculated");
        return;
      }
      try {
        const value = deserializeValue(data.value);
        await navigator.clipboard.writeText(formatForHighPrecisionExport(value, { base, groupDigits }));
        setExportStatus("Up to 10M digits copied");
      } catch { setExportStatus("Copy is available in the browser"); }
      setTimeout(() => setExportStatus(""), 2200);
    };
    worker.postMessage({ expression: sourceExpression, references: workerReferences, options: { calculationPrecision: exportPrecision, forceDecimal: true } });
  }

  async function requestNotebookSaveHandle() {
    if (typeof window.showSaveFilePicker !== "function") return null;
    try {
      return await window.showSaveFilePicker({
        suggestedName: "elephant-calc-notebook.json",
        types: [{ description: "Calculation notebook", accept: { "application/json": [".json"] } }],
      });
    } catch (error) {
      return error?.name === "AbortError" ? savePickerCancelled : null;
    }
  }

  async function downloadNotebook(notebook, saveHandle = null) {
    const text = JSON.stringify(notebook, null, 2);
    if (saveHandle) {
      const writable = await saveHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "elephant-calc-notebook.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function startNotebookOperation(status) {
    const operation = { cancelled: false, worker: null };
    notebookOperationRef.current = operation;
    setTransferStatus(status);
    return operation;
  }

  function cancelNotebookOperation() {
    const operation = notebookOperationRef.current;
    if (!operation) return;
    operation.cancelled = true;
    operation.worker?.terminate();
    operation.reject?.(new Error("cancelled"));
    notebookOperationRef.current = null;
    setTransferStatus("Notebook operation cancelled");
    setTimeout(() => setTransferStatus(""), 1800);
  }

  function calculateNotebookExpression(operation, source, references, options = {}) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./calculation-worker.js", import.meta.url), { type: "module" });
      operation.worker = worker;
      operation.reject = reject;
      const deadline = setTimeout(() => {
        worker.terminate();
        if (operation.worker === worker) { operation.worker = null; operation.reject = null; }
        reject(new Error("calculation reached its time budget"));
      }, 10000);
      worker.onmessage = ({ data }) => {
        clearTimeout(deadline);
        worker.terminate();
        if (operation.cancelled || notebookOperationRef.current !== operation) { reject(new Error("cancelled")); return; }
        operation.worker = null;
        operation.reject = null;
        if (data.type === "error") { reject(new Error(data.message ?? "calculation failed")); return; }
        resolve(deserializeValue(data.value));
      };
      worker.postMessage({ expression: source, references, options });
    });
  }

  async function recomputeNotebookHistory(operation, entries, options = {}) {
    let recomputed = [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (operation.cancelled) throw new Error("cancelled");
      const entry = entries[index];
      setTransferStatus(`Recomputing History ${entries.length - index} of ${entries.length}…`);
      try {
        const value = await calculateNotebookExpression(operation, entry.expression, historyReferences(recomputed), options);
        recomputed = [{ id: entry.id, expression: entry.expression, value }, ...recomputed];
      } catch (error) {
        if (error.message === "cancelled") throw error;
        throw new Error(`@history(${entry.id}) could not be recalculated: ${calculationErrorMessage(error.message)}`);
      }
    }
    return recomputed;
  }

  function currentViewSettings() { return { base, precision, notation, groupDigits, activeMode }; }

  function openExportDialog() {
    setExportAnswers("none");
    setExportView(false);
    setExportDialogOpen(true);
  }

  async function exportNotebook() {
    const includeAnswers = exportAnswers !== "none";
    const highPrecision = exportAnswers === "10m";
    const saveHandle = await requestNotebookSaveHandle();
    if (saveHandle === savePickerCancelled) return;
    setExportDialogOpen(false);
    if (!highPrecision) {
      try {
        await downloadNotebook(createNotebook({ expression, previewValue, includeActiveAnswer: completedExpressionRef.current === expression, history, nextId, view: currentViewSettings(), includeView: exportView, includeAnswers }), saveHandle);
        setToast(includeAnswers ? "Notebook with answers downloaded" : "Notebook expressions downloaded");
      } catch { setToast("Notebook could not be saved"); }
      setTimeout(() => setToast(""), 1800);
      return;
    }
    const operation = startNotebookOperation("Preparing 10M-digit notebook export…");
    try {
      const recalculatedHistory = await recomputeNotebookHistory(operation, history, { calculationPrecision: exportPrecision });
      let activeValue = null;
      if (expression.trim()) {
        setTransferStatus("Recomputing active expression…");
        activeValue = await calculateNotebookExpression(operation, expression, historyReferences(recalculatedHistory), { calculationPrecision: exportPrecision });
      }
      if (operation.cancelled) throw new Error("cancelled");
      await downloadNotebook(createNotebook({ expression, previewValue: activeValue, includeActiveAnswer: Boolean(activeValue), history: recalculatedHistory, nextId, view: currentViewSettings(), includeView: exportView, includeAnswers: true, highPrecision: true }), saveHandle);
      setTransferStatus("10M-digit notebook downloaded");
      setTimeout(() => setTransferStatus(""), 2200);
    } catch (error) {
      if (error.message !== "cancelled") { setTransferStatus(error.message || "Notebook export could not be completed"); setTimeout(() => setTransferStatus(""), 3000); }
    } finally {
      if (notebookOperationRef.current === operation) notebookOperationRef.current = null;
    }
  }

  function applyImportedView(view) {
    if (!view) return;
    if ([2, 10, 16].includes(view.base)) setBase(view.base);
    if (Number.isInteger(view.precision) && view.precision >= 0 && view.precision <= maximumDisplayPrecision) setPrecision(view.precision);
    if (["auto", "decimal", "scientific", "engineering", "expanded"].includes(view.notation)) setNotation(view.notation);
    if (typeof view.groupDigits === "boolean") setGroupDigits(view.groupDigits);
    if (modes.includes(view.activeMode)) setActiveMode(view.activeMode);
  }

  function queueNotebookImport(candidate, label) {
    try {
      setPendingImport({ notebook: validateNotebook(candidate), label });
      setExamplesOpen(false);
    } catch (error) {
      setToast(error.message || "Notebook could not be read");
      setTimeout(() => setToast(""), 2200);
    }
  }

  async function confirmNotebookImport() {
    const pending = pendingImport;
    if (!pending) return;
    setPendingImport(null);
    const operation = startNotebookOperation(`Importing ${pending.label}…`);
    try {
      const recalculatedHistory = await recomputeNotebookHistory(operation, pending.notebook.history);
      if (operation.cancelled) throw new Error("cancelled");
      setHistory(recalculatedHistory);
      setNextId(pending.notebook.nextId);
      setExpression(pending.notebook.expression);
      setPreviewValue(recalculatedHistory[0]?.value ?? previewValue);
      completedExpressionRef.current = "";
      setExpressionError("");
      setInspectorOpen(false);
      applyImportedView(pending.notebook.view);
      setTransferStatus(`Imported and recalculated ${recalculatedHistory.length} History entries`);
      setTimeout(() => setTransferStatus(""), 2400);
      focusExpression();
    } catch (error) {
      if (error.message !== "cancelled") { setTransferStatus(error.message || "Notebook import could not be completed"); setTimeout(() => setTransferStatus(""), 3200); }
    } finally {
      if (notebookOperationRef.current === operation) notebookOperationRef.current = null;
    }
  }

  async function readNotebookFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { queueNotebookImport(JSON.parse(await file.text()), file.name); }
    catch { setToast("That file is not valid JSON"); setTimeout(() => setToast(""), 2200); }
  }

  function openFunctionBrowser() {
    const input = expressionRef.current;
    functionPriorFocusRef.current = document.activeElement;
    functionSelectionRef.current = {
      start: input?.selectionStart ?? expression.length,
      end: input?.selectionEnd ?? expression.length,
    };
    setFunctionQuery("");
    setFunctionCategory("All");
    setFunctionBrowserOpen(true);
  }

  function closeFunctionBrowser() {
    setFunctionBrowserOpen(false);
    requestAnimationFrame(() => {
      const input = expressionRef.current;
      input?.focus();
      const { start, end } = functionSelectionRef.current;
      input?.setSelectionRange(start, end);
    });
  }

  function insertCatalogFunction(entry) {
    const { start, end } = functionSelectionRef.current;
    const selected = expression.slice(start, end);
    const inserted = functionInsertion(entry, selected);
    const next = `${expression.slice(0, start)}${inserted.text}${expression.slice(end)}`;
    updatePreview(next);
    setFunctionBrowserOpen(false);
    requestAnimationFrame(() => {
      expressionRef.current?.focus();
      const caret = start + inserted.caret;
      expressionRef.current?.setSelectionRange(caret, caret);
    });
  }

  function useHistory(item) {
    updatePreview(item.expression);
    requestAnimationFrame(() => expressionRef.current?.focus());
  }

  function openMemory() { priorFocusRef.current = document.activeElement; setMemoryOpen(true); }
  function closeMemory() { setMemoryOpen(false); requestAnimationFrame(() => (priorFocusRef.current instanceof HTMLElement ? priorFocusRef.current : expressionRef.current)?.focus()); }
  function copyResult(value) { if (!hasTextSelection()) copyDisplayed(value); }
  function toggleInspector() { if (!hasTextSelection()) setInspectorOpen((open) => !open); }
  function resultLabel(formatted, action) {
    if (formatted.tower) return `${action}: ten, layer ${formatted.towerDepth}, magnitude ${formatted.towerMagnitude}; magnitude-only approximation`;
    if (formatted.knuth) return `${action}: ${formatted.knuthBase}, ${formatted.knuthArrows.length} Knuth up arrows, ${formatted.knuthHeight}`;
    return `${action}: ${formatted.text}`;
  }

  function primalityLabel(value) {
    const primality = value?.primality;
    if (!value?.exactInteger) return null;
    if (!primality) return null;
    if (primality.kind === "prime") return primality.certainty === "verified" ? "prime" : "probable prime";
    return primality.kind === "composite" ? "composite" : "not prime";
  }

  function renderResult(value) { return formatAutomatically(value, { base, precision, notation, groupDigits }); }

  const memoryDisplay = memory ? renderResult(memory.value) : null;
  const memoryInspection = memory ? inspectAutomatically(memory.value, { base, precision, notation }) : null;
  const memoryDigitCount = memory ? digitCountAutomatically(memory.value, base) : null;
  const formatOptions = { base, notation, groupDigits };
  const previewTooltip = formatAutomatically(previewValue, { base, precision, notation, groupDigits }).text;
  const memoryTooltip = memory ? formatAutomatically(memory.value, { base, precision, notation, groupDigits }).text : "";
  const renderResultContent = (formatted) => {
    if (formatted.knuth) return <><span className="sign">{formatted.sign}</span><span className="knuth-output">{formatted.knuthBase} {formatted.knuthArrows} {formatted.knuthHeight}</span></>;
    if (formatted.tower) {
      if (formatted.towerExpanded) return <><span className="sign">{formatted.sign}</span><span className="tower-expanded">{formatted.significand}</span></>;
      return <><span className="sign">{formatted.sign}</span>{formatted === preview ? <span className="tower-detail"><span>10</span><sup className="tower-depth">⟦{formatted.towerDepth}⟧<sup className="tower-magnitude">{formatted.towerMagnitude}</sup></sup></span> : <span className="tower-compact"><span>10⟦{formatted.towerDepth}⟧</span><sup>{formatted.towerMagnitude}</sup></span>}</>;
    }
    return <><span className="sign">{formatted.sign}</span><span>{formatted.significand}</span>{formatted.exponent && <span className="result-exponent">× {base === 10 ? "10" : base}<sup>{formatted.exponent}</sup></span>}</>;
  };
  const InspectionDetails = ({ value, data, digits, sourceExpression }) => <div className="inspector inspection-details"><div><span>engine</span><b>{data.engine ?? value.engineLabel ?? "placeholder"}</b></div><div><span>representation</span><b>{data.representation ?? "native"}</b></div><div><span>precision</span><b>{data.precision ?? `${precisionLabel} digits`}</b></div><div><span>status</span><b>{data.precisionLost ? "magnitude-only" : data.exactness ?? "approximate"}</b></div>{value.exactInteger && <div><span>integer</span><b>exact</b></div>}{primalityLabel(value) && <div><span>primality</span><b>{primalityLabel(value)}{value.primality?.method && <small> · {value.primality.method}</small>}</b></div>}{digits?.value && <div className="digit-count"><span>base-{base} digits</span><b>{formatDigitCountForInspector(digits, { groupDigits })}</b><small>{digits.certainty}</small></div>}<div className="inspector-actions"><button onClick={() => copyDisplayed(value)} title="Copy the result in the current display format">Copy</button><button onClick={() => exportHighPrecision(sourceExpression)} disabled={Boolean(exportWorkerRef.current)} title="Recalculate this expression with up to 10,000,000 significant digits, then copy it">Copy (10M digits)</button></div></div>;
  function recallMemory() { if (memory?.expression) { updatePreview(`${expression}${expression ? " " : ""}(${memory.expression})`); requestAnimationFrame(() => expressionRef.current?.focus()); setMemoryOpen(false); } }
  return <main className="app-shell">
    <section className={`workbench ${expressionLines >= 5 ? "expression-tall" : ""}`}>
      <section className="calculation-stage" aria-label="Current calculation">
        <div className="stage-topline"><span>ACTIVE EXPRESSION</span><span className={expressionError ? "stage-hint expression-warning" : "stage-hint"}>{expressionError ? `⚠ ${expressionError}` : "Enter to save to History"}</span></div>
        <textarea ref={expressionRef} rows="1" aria-label="Expression" value={expression} onChange={(event) => updatePreview(event.target.value)} onInput={(event) => sizeExpression(event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); updatePreview(""); } }} />
        <div className="result-line"><div className="result-wrap"><button className="equals-button" aria-label="Calculate expression" title="Calculate and save to History" onClick={commit}>=</button><button className="number-result selectable-output" aria-label={resultLabel(preview, "Inspect result")} title={previewTooltip} onClick={toggleInspector}>{renderResultContent(preview)}</button></div>{(showCalculating || calculation.commitOnSuccess) ? <span className="calculation-status" role="status">◌ Computing exact result {calculation.commitOnSuccess && "↳ History"}<button onClick={cancelCalculation}>Cancel</button></span> : calculation.status === "timed-out" ? <span className="toast">Exact calculation reached its time budget</span> : toast && <span className="toast" role="status">{toast}</span>}</div>
        {inspectorOpen && <InspectionDetails value={previewValue} data={inspection} digits={digitCount} sourceExpression={expression} />}
        <div className="result-meta"><span>sign <b className="selectable-text">{preview.sign || "+"}</b></span><span>exponent <b className="selectable-text">{preview.exponent || "0"}</b></span><span>{previewValue.engineLabel ?? "placeholder engine"}</span>{primalityLabel(previewValue) && <span className={`primality-meta ${previewValue.primality.kind}`} title={previewValue.primality.method}>{primalityLabel(previewValue)}</span>}<span>click result to inspect</span></div>
        {exportStatus && <span className="export-status" role="status">{exportStatus}{exportWorkerRef.current && <button onClick={cancelHighPrecisionExport}>Cancel</button>}</span>}
        <span className="sr-only" role="status" aria-live="polite">{expressionError || toast || exportStatus}</span>
      </section>
      <section className="control-strip" aria-label="Display controls"><div className="control"><label>DISPLAY BASE</label><div className="segmented">{[10, 2, 16].map((item) => <button key={item} onClick={() => setBase(item)} className={base === item ? "selected" : ""}>{item === 10 ? "Decimal" : item === 2 ? "Binary" : "Hex"}</button>)}</div></div><div className="control precision"><label>DISPLAY PRECISION <strong>{precisionLabel} places</strong></label><input aria-label="Display precision" title="Logarithmic scale from 0 to 10,000 fractional places" type="range" min="0" max={precisionSliderSteps} step="1" value={precisionToSlider(precision)} onChange={(event) => setPrecision(sliderToPrecision(Number(event.target.value)))} /><div><span>0</span><span>10,000</span></div></div><div className="control notation"><div className="control-label-row"><label>NOTATION</label><button className={`grouping-toggle ${groupDigits ? "selected" : ""}`} aria-label="Group expanded decimal digits" aria-pressed={groupDigits} title="Group expanded decimal digits" onClick={() => setGroupDigits((enabled) => !enabled)}>,</button></div><select value={notation} onChange={(event) => setNotation(event.target.value)}><option value="auto">Auto</option><option value="decimal">Decimal</option><option value="scientific">Scientific</option><option value="engineering">Engineering</option><option value="expanded">Expanded</option></select></div></section>
      <section className="desk"><div className="keypad-panel"><div className="panel-heading"><div><p className="eyebrow">INPUT PALETTE</p><select className="mode-select" aria-label="Input mode" value={activeMode} onChange={(event) => setActiveMode(event.target.value)}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</select></div><div className="memory-strip">{memoryDisplay && <button className="memory-chip selectable-output" aria-label={resultLabel(memoryDisplay, "Open memory")} title={`${memoryTooltip} · click to inspect memory`} onClick={openMemory}>M {memoryDisplay.sign}{memoryDisplay.significand}{memoryDisplay.exponent && ` × 10^${memoryDisplay.exponent}`}</button>}<button aria-label="Clear memory" onClick={() => setMemory(null)}>MC</button><button aria-label="Add active expression to memory" onClick={addToMemory}>M+</button><button aria-label="Recall memory into expression" onClick={recallMemory}>MR</button></div></div><div className="keypad">{paletteKeys.flat().map((key, index) => <button key={`${key || "future"}-${index}`} aria-hidden={key === ""} tabIndex={key === "" ? -1 : undefined} disabled={key === ""} aria-label={paletteHelp[key] ?? keyLabels[key] ?? `Insert ${key}`} title={paletteHelp[key]} className={key === "" ? "key placeholder" : key === "=" ? "key equal" : ["AC", "⌫"].includes(key) ? "key utility" : ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ", "sin", "cos", "tan", "ln", "log", "!", "π", "e", "τ", "φ", "abs", "mod", "%", "↑", "↑↑", "@n", "min", "max", "Fₙ", "Lₙ", "pₙ", "π(n)", "P(n)", "Cₙ", "Bₙ", "Tₙ", "Hₙ", "Jₙ", "S(n,k)", "nCr", "F₁(n)", "F₂(n)", "F₃(n)", "F₄(n)", "F₅(n)"].includes(key) ? "key function" : "key"} onClick={() => appendKey(key)}>{key}</button>)}</div><div className="shortcut-row"><span>Enter <b>save</b></span><span>Esc <b>clear</b></span><span>result click <b>inspect</b></span></div></div><div className="trail-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORY</p><h2>{history.length} calculations</h2></div><div className="history-toolbar"><div className="examples-menu"><button className="quiet examples-button" aria-expanded={examplesOpen} aria-haspopup="menu" title="Load an example history" onClick={() => setExamplesOpen((open) => !open)}>Examples</button>{examplesOpen && <div className="examples-popover" role="menu">{Object.entries(exampleWorkbenches).map(([key, example]) => <button key={key} role="menuitem" onClick={() => queueNotebookImport(example, example.title)}><b>{example.title}</b><small>{example.description}</small></button>)}</div>}</div><button className="history-icon" aria-label="Download History notebook" title="Download History notebook" onClick={openExportDialog}><Save aria-hidden="true" /></button><button className="history-icon" aria-label="Import History notebook" title="Import History notebook" onClick={() => importInputRef.current?.click()}><FolderOpen aria-hidden="true" /></button><button className="history-icon reset-history" aria-label="Reset History" title="Reset History" onClick={() => { setHistory([]); setNextId(1); }}><RotateCcw aria-hidden="true" /></button><input ref={importInputRef} className="file-input" type="file" accept="application/json,.json" onChange={readNotebookFile} /></div></div>{transferStatus && <div className="transfer-status" role="status">{transferStatus}{notebookOperationRef.current && <button onClick={cancelNotebookOperation}>Cancel</button>}</div>}<div className="history-list">{history.map((item) => { const itemResult = renderResult(item.value); const itemPrimality = primalityLabel(item.value); const itemTooltip = formatAutomatically(item.value, { base, precision, notation, groupDigits }).text; return <article className="history-item" key={item.id}><div className="history-top"><span className="history-id selectable-text" aria-label={`History item ${item.id}`}>@history({item.id})</span><span className="history-actions"><button className="use-button" aria-label={`Use History item ${item.id} in the active expression`} onClick={() => useHistory(item)}>Use</button><button className="delete-history" aria-label={`Delete History item ${item.id}`} title={`Delete @history(${item.id})`} onClick={() => setHistory((items) => items.filter((entry) => entry.id !== item.id))}>×</button></span></div><p className="history-expression selectable-text" aria-label={`History expression: ${item.expression}`}>{item.expression}</p><button className="history-result selectable-output" aria-label={resultLabel(itemResult, "Copy History result")} title={`${itemTooltip} · click to copy`} onClick={() => copyResult(item.value)}>{renderResultContent(itemResult)}{item.value.primality?.kind === "prime" && <span className={`prime-badge ${item.value.primality.certainty}`} title={itemPrimality === "prime" ? "Verified prime" : "Probable prime"} aria-label={itemPrimality === "prime" ? "Verified prime" : "Probable prime"}>P{item.value.primality.certainty === "probable" ? "?" : ""}</span>}</button></article>; })}{!history.length && <p className="empty">History is clear. New committed calculations will appear here.</p>}</div></div></section>
    </section>
    {exportDialogOpen && <div className="notebook-overlay" role="dialog" aria-modal="true" aria-label="Download notebook"><div className="notebook-card"><div className="panel-heading"><div><p className="eyebrow">DOWNLOAD NOTEBOOK</p><h2>Choose what to include</h2></div><button className="quiet" onClick={() => setExportDialogOpen(false)}>Close</button></div><fieldset className="export-options"><legend>History contents</legend><label><input type="radio" name="answers" checked={exportAnswers === "none"} onChange={() => setExportAnswers("none")} /> Expressions only</label><label><input type="radio" name="answers" checked={exportAnswers === "current"} onChange={() => setExportAnswers("current")} /> With answers</label><label><input type="radio" name="answers" checked={exportAnswers === "10m"} onChange={() => setExportAnswers("10m")} /> With answers (10M digits)</label></fieldset><label className="export-view-option"><input type="checkbox" checked={exportView} onChange={(event) => setExportView(event.target.checked)} /> Include current view settings</label><p className="notebook-note">Imported notebooks always recalculate expressions; saved answers are archival metadata.</p><div className="notebook-actions"><button className="quiet" onClick={() => setExportDialogOpen(false)}>Cancel</button><button className="download-button" onClick={exportNotebook}>Download JSON</button></div></div></div>}
    {pendingImport && <div className="notebook-overlay" role="dialog" aria-modal="true" aria-label="Confirm notebook import"><div className="notebook-card"><p className="eyebrow">IMPORT NOTEBOOK</p><h2>Replace the current workbench?</h2><p className="notebook-note"><b>{pendingImport.label}</b> has {pendingImport.notebook.history.length} History entries. Every expression will be recalculated; saved answers are never trusted.</p>{pendingImport.notebook.view && <p className="notebook-note">Its saved view settings will also be applied.</p>}<div className="notebook-actions"><button className="quiet" onClick={() => setPendingImport(null)}>Cancel</button><button className="download-button" onClick={confirmNotebookImport}>Import and recalculate</button></div></div></div>}
    {memoryOpen && memory && <div className="memory-overlay" role="dialog" aria-modal="true" aria-label="Memory details"><div className="memory-card" ref={memoryDialogRef}><div className="panel-heading"><div><p className="eyebrow">MEMORY</p><h2>Accumulated expression</h2></div><button className="quiet" ref={memoryCloseRef} onClick={closeMemory}>Close</button></div><p className="memory-expression selectable-text">{memory.expression}</p><button className="memory-answer selectable-output" aria-label={resultLabel(memoryDisplay, "Memory result")} title={memoryTooltip} onClick={() => { if (!hasTextSelection()) closeMemory(); }}>{renderResultContent(memoryDisplay)}</button><InspectionDetails value={memory.value} data={memoryInspection} digits={memoryDigitCount} sourceExpression={memory.expression} /><div className="memory-actions"><button className="use-button" onClick={recallMemory}>Recall into expression</button><button className="quiet" onClick={() => { setMemory(null); closeMemory(); }}>Clear memory</button></div></div></div>}
    {functionBrowserOpen && <div className="function-browser-overlay" role="dialog" aria-modal="true" aria-labelledby="function-browser-title"><section className={`function-browser-card ${functionView === "rich" ? "rich" : ""}`}><div className="panel-heading"><div><p className="eyebrow">FUNCTION LIBRARY</p><h2 id="function-browser-title">Insert a function</h2></div><button className="quiet" onClick={closeFunctionBrowser}>Close</button></div><input ref={functionSearchRef} className="function-search" type="search" aria-label="Search functions" placeholder="Search names, syntax, categories, and descriptions" value={functionQuery} onChange={(event) => setFunctionQuery(event.target.value)} /><div className="function-browser-controls"><label>Category <select value={functionCategory} onChange={(event) => setFunctionCategory(event.target.value)}>{functionCategories.map((category) => <option key={category}>{category}</option>)}</select></label><span className="function-count">{filteredFunctions.length} functions</span><div className="function-view-switch" aria-label="Function browser view"><button aria-pressed={functionView === "compact"} onClick={() => setFunctionView("compact")}>Compact</button><button aria-pressed={functionView === "rich"} onClick={() => setFunctionView("rich")}>Rich</button></div></div><div className="function-results" aria-label="Matching functions"><VirtuosoGrid data={filteredFunctions} computeItemKey={(_, entry) => entry.id} listClassName="function-grid" itemClassName="function-grid-item" increaseViewportBy={240} itemContent={(_, entry) => <button className="function-card" onClick={() => insertCatalogFunction(entry)} aria-label={`Insert ${entry.signature}: ${entry.name}`}><span className="function-signature">{entry.signature}</span><span className="function-name">{entry.name}</span>{functionView === "rich" && <><span className="function-category">{entry.category}</span><span className="function-description">{entry.description}</span>{entry.url && <a href={entry.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Learn more</a>}</>}</button>} /></div><p className="function-browser-note">Search terms are combined; quote a phrase to keep its words together. Selecting expression text before opening the library wraps it when the chosen function accepts x.</p></section></div>}
  </main>;
}
