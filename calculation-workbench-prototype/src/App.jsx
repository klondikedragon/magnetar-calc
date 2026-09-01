import { useEffect, useMemo, useRef, useState } from "react";
import { deserializeValue, digitCountAutomatically, evaluateAutomatically, formatAutomatically, inspectAutomatically, serializeValue } from "./engine";

const initialHistory = [
  { id: 3, expression: "√(2) + π / 7", value: { kind: "number", number: 1.862012077376797, full: "1.862012077376796985004668721836731291106586140266324758279159345760390983" } },
  { id: 2, expression: "prior ÷ (log₁₀(10^64) + 1)", value: { kind: "large", sign: "", significand: "3.057294822950537", exponent: "1022", full: "3.057294822950537259286373091729847192504187759103445218936482103664918764203795018624 × 10^1022" } },
  { id: 1, expression: "(τ × 10^512) ^ φ", value: { kind: "large", sign: "", significand: "1.987241634917849218536142", exponent: "1024", full: "1.987241634917849218536142897624451906847214981320447218049332918764303781920784391825304816973420198 × 10^1024" } },
];

const modes = ["Calculator", "Scientific", "Trigonometry", "Number theory", "Sequences", "Programmer"];
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
const storageKey = "elephant-calc/workbench/v1";
const keyLabels = { AC: "Clear expression", "⌫": "Backspace", Ans: "Insert most recent History result", "=": "Calculate and save to History", "x²": "Square", "xʸ": "Raise to a power", "√x": "Square root", "ⁿ√x": "Nth root", "10ˣ": "Ten to a power", "eˣ": "Euler's number to a power", "π": "Insert pi", "τ": "Insert tau", "↑": "Insert Knuth up arrow", "↑↑": "Insert Knuth double up arrow", "−": "Subtract", "×": "Multiply", "÷": "Divide" };

function isEditableElement(target) {
  return target instanceof HTMLElement && (target.matches("textarea, input, select, [contenteditable='true']") || target.isContentEditable);
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
  const [toast, setToast] = useState("");
  const [expressionError, setExpressionError] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const expressionRef = useRef(null);
  const memoryFeedbackTimer = useRef(null);
  const memoryDialogRef = useRef(null);
  const memoryCloseRef = useRef(null);
  const priorFocusRef = useRef(null);
  const focusExpression = () => requestAnimationFrame(() => expressionRef.current?.focus());
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
  const precisionLabel = useMemo(() => precision >= 1000 ? "1,000" : precision, [precision]);
  const paletteKeys = activeMode === "Number theory" ? numberTheoryKeys : keys;
  const preview = formatAutomatically(previewValue, { base, precision, notation, groupDigits });
  const inspection = inspectAutomatically(previewValue, { base, precision, notation });
  const digitCount = digitCountAutomatically(previewValue, base);
  const formattedDigitCount = digitCount?.value ? formatAutomatically(digitCount.value, { base, precision, notation, groupDigits }) : null;

  const referenceValues = useMemo(() => new Map(history.map((item) => [`@history(${item.id})`, item.value.kind === "number" ? String(item.value.number) : item.value.decimal?.toString?.() ?? "1e308"])), [history]);

  function updatePreview(nextExpression) {
    setExpression(nextExpression);
    if (!nextExpression.trim()) { setExpressionError(""); return; }
    try { setPreviewValue(evaluateAutomatically(nextExpression, referenceValues, { precision })); setExpressionError(""); }
    catch (error) { setExpressionError(error?.message === "engine range exceeded" ? "Outside the current engine range" : "Check this expression"); }
  }

  function commit() {
    if (!expression.trim()) return;
    try {
      const value = evaluateAutomatically(expression, referenceValues, { precision });
      setPreviewValue(value);
      setHistory((items) => [{ id: nextId, expression, value }, ...items]);
      setNextId((id) => id + 1);
      setToast("Saved to History");
      setTimeout(() => setToast(""), 1500);
    } catch (error) { setExpressionError(error?.message === "engine range exceeded" ? "Outside the current engine range" : "Check this expression"); setToast("Expression not saved"); }
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
      const nextValue = evaluateAutomatically(nextExpression, referenceValues, { precision });
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
    const unary = { "√x": "√", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log", abs: "abs" }[key];
    if (unary) return replaceSelection(`${unary}(${selected})`, unary.length + 1 + selected.length);
    if (key === "x²") return replaceSelection(selected ? `(${selected})^2` : "^2", selected ? selected.length + 4 : 2);
    if (key === "!") return replaceSelection(selected ? `(${selected})!` : "!", selected ? selected.length + 3 : 1);
    const insert = { "xʸ": "^", "ⁿ√x": "^(1/", "10ˣ": "10^", "eˣ": "e^" }[key] ?? key;
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

  async function copyFull(full) {
    try { await navigator.clipboard.writeText(full); setToast("Full precision copied"); setTimeout(() => setToast(""), 1500); }
    catch { setToast("Copy is available in the browser"); }
  }

  function useHistory(item) {
    updatePreview(item.expression);
    requestAnimationFrame(() => expressionRef.current?.focus());
  }

  function openMemory() { priorFocusRef.current = document.activeElement; setMemoryOpen(true); }
  function closeMemory() { setMemoryOpen(false); requestAnimationFrame(() => (priorFocusRef.current instanceof HTMLElement ? priorFocusRef.current : expressionRef.current)?.focus()); }
  function copyResult(full) { if (!hasTextSelection()) copyFull(full); }
  function toggleInspector() { if (!hasTextSelection()) setInspectorOpen((open) => !open); }
  function resultLabel(formatted, action) {
    if (formatted.tower) return `${action}: ten, layer ${formatted.towerDepth}, magnitude ${formatted.towerMagnitude}; magnitude-only approximation`;
    if (formatted.knuth) return `${action}: ${formatted.knuthBase}, ${formatted.knuthArrows.length} Knuth up arrows, ${formatted.knuthHeight}`;
    return `${action}: ${formatted.text}`;
  }

  function renderResult(value) { return formatAutomatically(value, { base, precision, notation, groupDigits }); }

  const memoryDisplay = memory ? renderResult(memory.value) : null;
  const renderResultContent = (formatted) => {
    if (formatted.knuth) return <><span className="sign">{formatted.sign}</span><span className="knuth-output">{formatted.knuthBase} {formatted.knuthArrows} {formatted.knuthHeight}</span></>;
    if (formatted.tower) {
      if (formatted.towerExpanded) return <><span className="sign">{formatted.sign}</span><span className="tower-expanded">{formatted.significand}</span></>;
      return <><span className="sign">{formatted.sign}</span>{formatted === preview ? <span className="tower-detail"><span>10</span><sup className="tower-depth">⟦{formatted.towerDepth}⟧<sup className="tower-magnitude">{formatted.towerMagnitude}</sup></sup></span> : <span className="tower-compact"><span>10⟦{formatted.towerDepth}⟧</span><sup>{formatted.towerMagnitude}</sup></span>}</>;
    }
    return <><span className="sign">{formatted.sign}</span><span>{formatted.significand}</span>{formatted.exponent && <span className="result-exponent">× {base === 10 ? "10" : base}<sup>{formatted.exponent}</sup></span>}</>;
  };
  function recallMemory() { if (memory?.expression) { updatePreview(`${expression}${expression ? " " : ""}(${memory.expression})`); requestAnimationFrame(() => expressionRef.current?.focus()); setMemoryOpen(false); } }
  return <main className="app-shell">
    <section className="workbench">
      <section className="calculation-stage" aria-label="Current calculation">
        <div className="stage-topline"><span>ACTIVE EXPRESSION</span><span className={expressionError ? "stage-hint expression-warning" : "stage-hint"}>{expressionError ? `⚠ ${expressionError}` : "Enter to save to History"}</span></div>
        <textarea ref={expressionRef} rows="1" aria-label="Expression" value={expression} onChange={(event) => updatePreview(event.target.value)} onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 8 * 28)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); updatePreview(""); } }} />
        <div className="result-line"><div className="result-wrap"><button className="equals-button" aria-label="Calculate expression" title="Calculate and save to History" onClick={commit}>=</button><button className="number-result selectable-output" aria-label={resultLabel(preview, "Inspect result")} title={preview.full} onClick={toggleInspector}>{renderResultContent(preview)}</button></div>{toast && <span className="toast" role="status">{toast}</span>}</div>
        {inspectorOpen && <div className="inspector"><div><span>engine</span><b>{inspection.engine ?? previewValue.engineLabel ?? "placeholder"}</b></div><div><span>representation</span><b>{inspection.representation ?? "native"}</b></div><div><span>precision</span><b>{inspection.precision ?? `${precisionLabel} digits`}</b></div><div><span>status</span><b>{inspection.precisionLost ? "magnitude-only" : inspection.exactness ?? "approximate"}</b></div>{formattedDigitCount && <div className="digit-count"><span>base-{base} digits</span><b>{renderResultContent(formattedDigitCount)}</b><small>{digitCount.certainty}</small></div>}<button onClick={() => copyFull(preview.full)}>Copy full precision</button></div>}
        <div className="result-meta"><span>significand <b className="selectable-text">{preview.sign || "positive"} {preview.significand}</b></span><span>exponent <b className="selectable-text">{preview.exponent || "0"}</b></span><span>{previewValue.engineLabel ?? "placeholder engine"} · click result to inspect</span></div>
        <span className="sr-only" role="status" aria-live="polite">{expressionError || toast}</span>
      </section>
      <section className="control-strip" aria-label="Display controls"><div className="control"><label>DISPLAY BASE</label><div className="segmented">{[10, 2, 16].map((item) => <button key={item} onClick={() => setBase(item)} className={base === item ? "selected" : ""}>{item === 10 ? "Decimal" : item === 2 ? "Binary" : "Hex"}</button>)}</div></div><div className="control precision"><label>DISPLAY PRECISION <strong>{precisionLabel} digits</strong></label><input aria-label="Display precision" type="range" min="16" max="1000" step="1" value={precision} onChange={(event) => setPrecision(Number(event.target.value))} /><div><span>16</span><span>1,000</span></div></div><div className="control notation"><div className="control-label-row"><label>NOTATION</label><button className={`grouping-toggle ${groupDigits ? "selected" : ""}`} aria-label="Group expanded decimal digits" aria-pressed={groupDigits} title="Group expanded decimal digits" onClick={() => setGroupDigits((enabled) => !enabled)}>,</button></div><select value={notation} onChange={(event) => setNotation(event.target.value)}><option value="auto">Auto</option><option value="scientific">Scientific</option><option value="engineering">Engineering</option><option value="expanded">Expanded</option></select></div></section>
      <section className="desk"><div className="keypad-panel"><div className="panel-heading"><div><p className="eyebrow">INPUT PALETTE</p><select className="mode-select" aria-label="Input mode" value={activeMode} onChange={(event) => setActiveMode(event.target.value)}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</select></div><div className="memory-strip">{memoryDisplay && <button className="memory-chip selectable-output" aria-label={resultLabel(memoryDisplay, "Open memory")} title={`${memoryDisplay.full} · click to inspect memory`} onClick={openMemory}>M {memoryDisplay.sign}{memoryDisplay.significand}{memoryDisplay.exponent && ` × 10^${memoryDisplay.exponent}`}</button>}<button aria-label="Clear memory" onClick={() => setMemory(null)}>MC</button><button aria-label="Add active expression to memory" onClick={addToMemory}>M+</button><button aria-label="Recall memory into expression" onClick={recallMemory}>MR</button></div></div><div className="keypad">{paletteKeys.flat().map((key, index) => <button key={`${key}-${index}`} aria-label={keyLabels[key] ?? `Insert ${key}`} className={key === "=" ? "key equal" : ["AC", "⌫"].includes(key) ? "key utility" : ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ", "sin", "cos", "tan", "ln", "log", "!", "π", "e", "τ", "abs", "mod", "%", "↑", "↑↑"].includes(key) ? "key function" : "key"} onClick={() => appendKey(key)}>{key}</button>)}</div><div className="shortcut-row"><span>Enter <b>save</b></span><span>Esc <b>clear</b></span><span>result click <b>inspect</b></span></div></div><div className="trail-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORY</p><h2>{history.length} calculations</h2></div><button className="quiet" onClick={() => { setHistory([]); setNextId(1); }}>Reset history</button></div><div className="history-list">{history.map((item) => { const itemResult = renderResult(item.value); return <article className="history-item" key={item.id}><div className="history-top"><span className="history-id selectable-text" aria-label={`History item ${item.id}`}>@history({item.id})</span><button className="use-button" aria-label={`Use History item ${item.id} in the active expression`} onClick={() => useHistory(item)}>Use</button></div><p className="history-expression selectable-text" aria-label={`History expression: ${item.expression}`}>{item.expression}</p><button className="history-result selectable-output" aria-label={resultLabel(itemResult, "Copy History result")} title={`${itemResult.full} · click to copy`} onClick={() => copyResult(itemResult.full)}>{renderResultContent(itemResult)}</button></article>; })}{!history.length && <p className="empty">History is clear. New committed calculations will appear here.</p>}</div></div></section>
    </section>
    {memoryOpen && memory && <div className="memory-overlay" role="dialog" aria-modal="true" aria-label="Memory details"><div className="memory-card" ref={memoryDialogRef}><div className="panel-heading"><div><p className="eyebrow">MEMORY</p><h2>Accumulated expression</h2></div><button className="quiet" ref={memoryCloseRef} onClick={closeMemory}>Close</button></div><p className="memory-expression selectable-text">{memory.expression}</p><button className="memory-answer selectable-output" aria-label={resultLabel(memoryDisplay, "Memory result")} title={memoryDisplay.full} onClick={() => { if (!hasTextSelection()) closeMemory(); }}>{renderResultContent(memoryDisplay)}</button><div className="memory-actions"><button className="use-button" onClick={recallMemory}>Recall into expression</button><button className="quiet" onClick={() => { setMemory(null); closeMemory(); }}>Clear memory</button></div></div></div>}
  </main>;
}
