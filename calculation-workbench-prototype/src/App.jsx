import { useEffect, useMemo, useRef, useState } from "react";
import { deserializeValue, digitCountAutomatically, evaluateWithAnalysis, exportPrecision, formatAutomatically, formatForHighPrecisionExport, inspectAutomatically, serializeValue } from "./engine";

const initialHistory = [
  { id: 3, expression: "√(2) + π / 7", value: { kind: "number", number: 1.862012077376797, full: "1.862012077376796985004668721836731291106586140266324758279159345760390983" } },
  { id: 2, expression: "prior ÷ (log₁₀(10^64) + 1)", value: { kind: "large", sign: "", significand: "3.057294822950537", exponent: "1022", full: "3.057294822950537259286373091729847192504187759103445218936482103664918764203795018624 × 10^1022" } },
  { id: 1, expression: "(τ × 10^512) ^ φ", value: { kind: "large", sign: "", significand: "1.987241634917849218536142", exponent: "1024", full: "1.987241634917849218536142897624451906847214981320447218049332918764303781920784391825304816973420198 × 10^1024" } },
];

const modes = ["Calculator", "Scientific", "Trigonometry", "Number theory", "Sequences", "Ordinal / hierarchy", "Programmer"];
const keys = [
  ["AC", "⌫", "(", ")", "Ans", "="],
  ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ"],
  ["sin", "cos", "tan", "ln", "log", "!"],
  ["π", "e", "τ", "abs", "mod", "%"],
  ["7", "8", "9", "÷", "×", "−"],
  ["4", "5", "6", "+", "(", ")"],
  ["1", "2", "3", ".", "0", "="],
];
const numberTheoryKeys = keys.map((row, index) => index === 3 ? ["π", "e", "τ", "↑", "↑↑", "mod"] : row);
const sequenceKeys = keys.map((row, index) => index === 1 ? ["Fₙ", "Lₙ", "pₙ", "π(n)", "P(n)", "Cₙ"] : index === 2 ? ["Bₙ", "Tₙ", "Hₙ", "Jₙ", "S(n,k)", "nCr"] : index === 3 ? ["π", "e", "φ", "Custom 1", "Custom 2", "Custom 3"] : row);
const ordinalKeys = keys.map((row, index) => index === 1 ? ["F₁(n)", "F₂(n)", "F₃(n)", "F₄(n)", "F₅(n)", "Fω(n)"] : index === 2 ? ["ω", "ω²", "ω^ω", "ε₀", "α", "Ordinal…"] : index === 3 ? ["π", "e", "φ", "↑", "↑↑", "mod"] : row);
const sequenceHelp = {
  "Fₙ": "Fibonacci sequence — each term is the sum of the two preceding terms.", "Lₙ": "Lucas sequence — Fibonacci's companion sequence beginning 2, 1.", "pₙ": "Nth prime — exact for a practical finite range.", "π(n)": "Prime-counting function — number of primes less than or equal to n.", "P(n)": "Partition number — ways to write n as a sum of positive integers.", "Cₙ": "Catalan number — counts many recursively nested combinatorial structures.", "Bₙ": "Bell number — number of partitions of a set of n elements.", "Tₙ": "Triangular number — 1 + 2 + … + n.", "Hₙ": "Harmonic number — 1 + 1/2 + … + 1/n.", "Jₙ": "Jacobsthal sequence — J(n)=J(n−1)+2J(n−2).", "S(n,k)": "Stirling number of the second kind — partitions n labeled objects into k nonempty sets.", nCr: "Binomial coefficient — ways to choose r items from n.", φ: "Golden ratio — (1 + √5) / 2; the limiting ratio of Fibonacci terms.", "Custom 1": "Reserved for a future custom sequence.", "Custom 2": "Reserved for a future custom sequence.", "Custom 3": "Reserved for a future custom sequence.",
};
const ordinalHelp = { "F₁(n)": "Wainer fast-growing hierarchy: F1(n)=2n.", "F₂(n)": "Wainer fast-growing hierarchy: F2(n)=n·2ⁿ.", "F₃(n)": "Wainer fast-growing hierarchy: iterate F2, n times, starting at n.", "F₄(n)": "Wainer fast-growing hierarchy — shown structurally until the ordinal engine is available.", "F₅(n)": "Wainer fast-growing hierarchy — shown structurally until the ordinal engine is available.", "Fω(n)": "Diagonal Wainer function Fω(n)=Fn(n); reserved for the ordinal engine.", ω: "First infinite ordinal; ordinal notation support is forthcoming.", "ω²": "Ordinal omega squared; ordinal notation support is forthcoming.", "ω^ω": "Ordinal omega to omega; ordinal notation support is forthcoming.", "ε₀": "Epsilon nought; ordinal notation support is forthcoming.", α: "Ordinal parameter; ordinal notation support is forthcoming.", "Ordinal…": "Reserved for ordinal notation tools." };
const storageKey = "elephant-calc/workbench/v1";
const maximumDisplayPrecision = 10_000;
const precisionSliderSteps = 1000;
const precisionToSlider = (digits) => digits <= 0 ? 0 : Math.round((Math.log10(Math.min(digits, maximumDisplayPrecision) + 1) / Math.log10(maximumDisplayPrecision + 1)) * precisionSliderSteps);
const sliderToPrecision = (position) => position <= 0 ? 0 : Math.round((10 ** ((position / precisionSliderSteps) * Math.log10(maximumDisplayPrecision + 1))) - 1);
const keyLabels = { AC: "Clear expression", "⌫": "Backspace", Ans: "Insert most recent History result", "=": "Calculate and save to History", "x²": "Square", "xʸ": "Raise to a power", "√x": "Square root", "ⁿ√x": "Nth root", "10ˣ": "Ten to a power", "eˣ": "Euler's number to a power", "π": "Insert pi", "τ": "Insert tau", "↑": "Insert Knuth up arrow", "↑↑": "Insert Knuth double up arrow", "−": "Subtract", "×": "Multiply", "÷": "Divide" };

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
  const commitOnSuccessRef = useRef(false);
  const completedExpressionRef = useRef("");
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
  const formattedDigitCount = digitCount?.value ? formatAutomatically(digitCount.value, { base, precision, notation, groupDigits }) : null;

  const referenceValues = useMemo(() => new Map(history.map((item) => [`@history(${item.id})`, item.value.kind === "number" ? String(item.value.number) : item.value.decimal?.toString?.() ?? "1e308"])), [history]);
  // Primality annotations are presentation metadata, not calculation inputs.
  // Keep the calculation worker stable when an asynchronous badge arrives.
  const historyReferenceKey = history.map((item) => `${item.id}:${item.value.kind}:${item.value.decimal?.toString?.() ?? item.value.number ?? item.value.full}:${item.value.exactInteger ?? ""}`).join("|");
  const workerReferences = useMemo(() => history.map((item) => [`@history(${item.id})`, serializeValue(item.value)]), [historyReferenceKey]);

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
  useEffect(() => () => exportWorkerRef.current?.terminate(), []);
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
    if (key === "Ans") { updatePreview(`${expression}@history(${history[0]?.id ?? 1})`); focusExpression(); return; }
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
    if (key === "(") return replaceSelection(selected ? `(${selected})` : "()", selected ? selected.length + 2 : 1);
    if (key === ")") return replaceSelection(")");
    const unary = { "√x": "√", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log", abs: "abs", "Fₙ": "fib", "Lₙ": "lucas", "pₙ": "prime", "π(n)": "primepi", "P(n)": "partition", "Cₙ": "catalan", "Bₙ": "bell", "Tₙ": "triangular", "Hₙ": "harmonic", "Jₙ": "jacobsthal", "F₁(n)": "fgh1", "F₂(n)": "fgh2", "F₃(n)": "fgh3", "F₄(n)": "fgh4", "F₅(n)": "fgh5" }[key];
    if (unary) return replaceSelection(`${unary}(${selected})`, unary.length + 1 + selected.length);
    if (key === "x²") return replaceSelection(selected ? `(${selected})^2` : "^2", selected ? selected.length + 4 : 2);
    if (key === "!") return replaceSelection(selected ? `(${selected})!` : "!", selected ? selected.length + 3 : 1);
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
      if (memoryOpen || isEditableElement(event.target)) return;
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
  }, [expression, memoryOpen]);

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
  const InspectionDetails = ({ value, data, digits, sourceExpression }) => <div className="inspector inspection-details"><div><span>engine</span><b>{data.engine ?? value.engineLabel ?? "placeholder"}</b></div><div><span>representation</span><b>{data.representation ?? "native"}</b></div><div><span>precision</span><b>{data.precision ?? `${precisionLabel} digits`}</b></div><div><span>status</span><b>{data.precisionLost ? "magnitude-only" : data.exactness ?? "approximate"}</b></div>{value.exactInteger && <div><span>integer</span><b>exact</b></div>}{primalityLabel(value) && <div><span>primality</span><b>{primalityLabel(value)}{value.primality?.method && <small> · {value.primality.method}</small>}</b></div>}{digits?.value && <div className="digit-count"><span>base-{base} digits</span><b>{formatAutomatically(digits.value, { base, precision, notation, groupDigits }).text}</b><small>{digits.certainty}</small></div>}<div className="inspector-actions"><button onClick={() => copyDisplayed(value)} title="Copy the result in the current display format">Copy</button><button onClick={() => exportHighPrecision(sourceExpression)} disabled={Boolean(exportWorkerRef.current)} title="Recalculate this expression with up to 10,000,000 significant digits, then copy it">Copy (10M digits)</button></div></div>;
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
      <section className="desk"><div className="keypad-panel"><div className="panel-heading"><div><p className="eyebrow">INPUT PALETTE</p><select className="mode-select" aria-label="Input mode" value={activeMode} onChange={(event) => setActiveMode(event.target.value)}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</select></div><div className="memory-strip">{memoryDisplay && <button className="memory-chip selectable-output" aria-label={resultLabel(memoryDisplay, "Open memory")} title={`${memoryTooltip} · click to inspect memory`} onClick={openMemory}>M {memoryDisplay.sign}{memoryDisplay.significand}{memoryDisplay.exponent && ` × 10^${memoryDisplay.exponent}`}</button>}<button aria-label="Clear memory" onClick={() => setMemory(null)}>MC</button><button aria-label="Add active expression to memory" onClick={addToMemory}>M+</button><button aria-label="Recall memory into expression" onClick={recallMemory}>MR</button></div></div><div className="keypad">{paletteKeys.flat().map((key, index) => <button key={`${key}-${index}`} aria-label={paletteHelp[key] ?? keyLabels[key] ?? `Insert ${key}`} title={paletteHelp[key]} className={key === "=" ? "key equal" : ["AC", "⌫"].includes(key) ? "key utility" : ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ", "sin", "cos", "tan", "ln", "log", "!", "π", "e", "τ", "φ", "abs", "mod", "%", "↑", "↑↑", "Fₙ", "Lₙ", "pₙ", "π(n)", "P(n)", "Cₙ", "Bₙ", "Tₙ", "Hₙ", "Jₙ", "S(n,k)", "nCr", "F₁(n)", "F₂(n)", "F₃(n)", "F₄(n)", "F₅(n)"].includes(key) ? "key function" : "key"} onClick={() => appendKey(key)}>{key}</button>)}</div><div className="shortcut-row"><span>Enter <b>save</b></span><span>Esc <b>clear</b></span><span>result click <b>inspect</b></span></div></div><div className="trail-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORY</p><h2>{history.length} calculations</h2></div><button className="quiet" onClick={() => { setHistory([]); setNextId(1); }}>Reset history</button></div><div className="history-list">{history.map((item) => { const itemResult = renderResult(item.value); const itemPrimality = primalityLabel(item.value); const itemTooltip = formatAutomatically(item.value, { base, precision, notation, groupDigits }).text; return <article className="history-item" key={item.id}><div className="history-top"><span className="history-id selectable-text" aria-label={`History item ${item.id}`}>@history({item.id})</span><span className="history-actions"><button className="use-button" aria-label={`Use History item ${item.id} in the active expression`} onClick={() => useHistory(item)}>Use</button><button className="delete-history" aria-label={`Delete History item ${item.id}`} title={`Delete @history(${item.id})`} onClick={() => setHistory((items) => items.filter((entry) => entry.id !== item.id))}>×</button></span></div><p className="history-expression selectable-text" aria-label={`History expression: ${item.expression}`}>{item.expression}</p><button className="history-result selectable-output" aria-label={resultLabel(itemResult, "Copy History result")} title={`${itemTooltip} · click to copy`} onClick={() => copyResult(item.value)}>{renderResultContent(itemResult)}{item.value.primality?.kind === "prime" && <span className={`prime-badge ${item.value.primality.certainty}`} title={itemPrimality === "prime" ? "Verified prime" : "Probable prime"} aria-label={itemPrimality === "prime" ? "Verified prime" : "Probable prime"}>P{item.value.primality.certainty === "probable" ? "?" : ""}</span>}</button></article>; })}{!history.length && <p className="empty">History is clear. New committed calculations will appear here.</p>}</div></div></section>
    </section>
    {memoryOpen && memory && <div className="memory-overlay" role="dialog" aria-modal="true" aria-label="Memory details"><div className="memory-card" ref={memoryDialogRef}><div className="panel-heading"><div><p className="eyebrow">MEMORY</p><h2>Accumulated expression</h2></div><button className="quiet" ref={memoryCloseRef} onClick={closeMemory}>Close</button></div><p className="memory-expression selectable-text">{memory.expression}</p><button className="memory-answer selectable-output" aria-label={resultLabel(memoryDisplay, "Memory result")} title={memoryTooltip} onClick={() => { if (!hasTextSelection()) closeMemory(); }}>{renderResultContent(memoryDisplay)}</button><InspectionDetails value={memory.value} data={memoryInspection} digits={memoryDigitCount} sourceExpression={memory.expression} /><div className="memory-actions"><button className="use-button" onClick={recallMemory}>Recall into expression</button><button className="quiet" onClick={() => { setMemory(null); closeMemory(); }}>Clear memory</button></div></div></div>}
  </main>;
}
