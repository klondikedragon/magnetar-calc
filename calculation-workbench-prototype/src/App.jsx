import { useEffect, useMemo, useRef, useState } from "react";
import { deserializeValue, evaluateAutomatically, formatAutomatically, inspectAutomatically, serializeValue } from "./engine";

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
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        expression, nextId,
        view: { base, precision, notation, activeMode },
        previewValue: serializeValue(previewValue),
        history: history.map((item) => ({ ...item, value: serializeValue(item.value) })),
        memory: memory ? { ...memory, value: serializeValue(memory.value) } : null,
      }));
    } catch { /* Storage is optional; the calculator remains usable without it. */ }
  }, [expression, base, precision, notation, activeMode, nextId, previewValue, history, memory]);
  const precisionLabel = useMemo(() => precision >= 1000 ? "1,000" : precision, [precision]);
  const paletteKeys = activeMode === "Number theory" ? numberTheoryKeys : keys;
  const preview = formatAutomatically(previewValue, { base, precision, notation });
  const inspection = inspectAutomatically(previewValue, { base, precision, notation });

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
    if (key === "=") return commit();
    if (key === "AC") { setExpression(""); setToast(""); return; }
    if (key === "⌫") return updatePreview(expression.slice(0, -1));
    if (key === "Ans") return updatePreview(`${expression}@history(${history[0]?.id ?? 1})`);
    if (key === "M+") return addToMemory();
    const insert = { "x²": "^2", "xʸ": "^", "√x": "√(", "ⁿ√x": "^(1/", "10ˣ": "10^", "eˣ": "e^", "!": "!", sin: "sin(", cos: "cos(", tan: "tan(", ln: "ln(", log: "log(", abs: "abs(" }[key] ?? key;
    updatePreview(`${expression}${insert}`);
  }

  async function copyFull(full) {
    try { await navigator.clipboard.writeText(full); setToast("Full precision copied"); setTimeout(() => setToast(""), 1500); }
    catch { setToast("Copy is available in the browser"); }
  }

  function useHistory(item) {
    updatePreview(item.expression);
    requestAnimationFrame(() => expressionRef.current?.focus());
  }

  function renderResult(value) { return formatAutomatically(value, { base, precision, notation }); }

  const memoryDisplay = memory ? renderResult(memory.value) : null;
  const renderResultContent = (formatted) => formatted.knuth
    ? <><span className="sign">{formatted.sign}</span><span className="knuth-output">{formatted.knuthBase} {formatted.knuthArrows}<sup>{formatted.knuthHeight}</sup></span></>
    : formatted.tower
    ? <><span className="sign">{formatted.sign}</span>{formatted.towerExpanded ? <span className="tower-expanded">{formatted.significand}</span> : <span className="tower-collapsed"><span>10</span><sup>⟦{formatted.towerDepth}⟧ {formatted.towerMagnitude}</sup></span>}</>
    : <><span className="sign">{formatted.sign}</span><span>{formatted.significand}</span>{formatted.exponent && <span className="result-exponent">× {base === 10 ? "10" : base}<sup>{formatted.exponent}</sup></span>}</>;
  function recallMemory() { if (memory?.expression) { updatePreview(`${expression}${expression ? " " : ""}(${memory.expression})`); requestAnimationFrame(() => expressionRef.current?.focus()); setMemoryOpen(false); } }
  return <main className="app-shell">
    <section className="workbench">
      <section className="calculation-stage" aria-label="Current calculation">
        <div className="stage-topline"><span>ACTIVE EXPRESSION</span><span className={expressionError ? "stage-hint expression-warning" : "stage-hint"}>{expressionError ? `⚠ ${expressionError}` : "Enter to save to History"}</span></div>
        <textarea ref={expressionRef} rows="1" aria-label="Expression" value={expression} onChange={(event) => updatePreview(event.target.value)} onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 8 * 28)}px`; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); updatePreview(""); } }} />
        <div className="result-line"><div className="result-wrap"><button className="equals-button" aria-label="Calculate expression" title="Calculate and save to History" onClick={commit}>=</button><button className="number-result" title={preview.full} onClick={() => setInspectorOpen((open) => !open)}>{renderResultContent(preview)}</button></div>{toast && <span className="toast" role="status">{toast}</span>}</div>
        {inspectorOpen && <div className="inspector"><div><span>engine</span><b>{inspection.engine ?? previewValue.engineLabel ?? "placeholder"}</b></div><div><span>representation</span><b>{inspection.representation ?? "native"}</b></div><div><span>precision</span><b>{inspection.precision ?? `${precisionLabel} digits`}</b></div><div><span>status</span><b>{inspection.precisionLost ? "magnitude-only" : inspection.exactness ?? "approximate"}</b></div><button onClick={() => copyFull(preview.full)}>Copy full precision</button></div>}
        <div className="result-meta"><span>significand <b>{preview.sign || "positive"} {preview.significand}</b></span><span>exponent <b>{preview.exponent || "0"}</b></span><span>{previewValue.engineLabel ?? "placeholder engine"} · click result to inspect</span></div>
      </section>
      <section className="control-strip" aria-label="Display controls"><div className="control"><label>DISPLAY BASE</label><div className="segmented">{[10, 2, 16].map((item) => <button key={item} onClick={() => setBase(item)} className={base === item ? "selected" : ""}>{item === 10 ? "Decimal" : item === 2 ? "Binary" : "Hex"}</button>)}</div></div><div className="control precision"><label>DISPLAY PRECISION <strong>{precisionLabel} digits</strong></label><input aria-label="Display precision" type="range" min="16" max="1000" step="1" value={precision} onChange={(event) => setPrecision(Number(event.target.value))} /><div><span>16</span><span>1,000</span></div></div><div className="control notation"><label>NOTATION</label><select value={notation} onChange={(event) => setNotation(event.target.value)}><option value="auto">Auto</option><option value="scientific">Scientific</option><option value="engineering">Engineering</option><option value="expanded">Expanded</option></select></div></section>
      <section className="desk"><div className="keypad-panel"><div className="panel-heading"><div><p className="eyebrow">INPUT PALETTE</p><select className="mode-select" aria-label="Input mode" value={activeMode} onChange={(event) => setActiveMode(event.target.value)}>{modes.map((mode) => <option key={mode}>{mode}</option>)}</select></div><div className="memory-strip">{memoryDisplay && <button className="memory-chip" title={`${memoryDisplay.full} · click to inspect memory`} onClick={() => setMemoryOpen(true)}>M {memoryDisplay.sign}{memoryDisplay.significand}{memoryDisplay.exponent && ` × 10^${memoryDisplay.exponent}`}</button>}<button onClick={() => setMemory(null)}>MC</button><button onClick={addToMemory}>M+</button><button onClick={recallMemory}>MR</button></div></div><div className="keypad">{paletteKeys.flat().map((key, index) => <button key={`${key}-${index}`} className={key === "=" ? "key equal" : ["AC", "⌫"].includes(key) ? "key utility" : ["x²", "xʸ", "√x", "ⁿ√x", "10ˣ", "eˣ", "sin", "cos", "tan", "ln", "log", "!", "π", "e", "τ", "abs", "mod", "%", "↑", "↑↑"].includes(key) ? "key function" : "key"} onClick={() => appendKey(key)}>{key}</button>)}</div><div className="shortcut-row"><span>Enter <b>save</b></span><span>Esc <b>clear</b></span><span>result click <b>inspect</b></span></div></div><div className="trail-panel"><div className="panel-heading"><div><p className="eyebrow">HISTORY</p><h2>{history.length} calculations</h2></div><button className="quiet" onClick={() => { setHistory([]); setNextId(1); }}>Reset history</button></div><div className="history-list">{history.map((item) => { const itemResult = renderResult(item.value); return <article className="history-item" key={item.id}><div className="history-top"><span className="history-id">@history({item.id})</span><button className="use-button" onClick={() => useHistory(item)}>Use</button></div><p className="history-expression">{item.expression}</p><button className="history-result" title={`${itemResult.full} · click to copy`} onClick={() => copyFull(itemResult.full)}>{renderResultContent(itemResult)}</button></article>; })}{!history.length && <p className="empty">History is clear. New committed calculations will appear here.</p>}</div></div></section>
    </section>
    {memoryOpen && memory && <div className="memory-overlay" role="dialog" aria-label="Memory details"><div className="memory-card"><div className="panel-heading"><div><p className="eyebrow">MEMORY</p><h2>Accumulated expression</h2></div><button className="quiet" onClick={() => setMemoryOpen(false)}>Close</button></div><p className="memory-expression">{memory.expression}</p><button className="memory-answer" title={memoryDisplay.full} onClick={() => setMemoryOpen(false)}>{renderResultContent(memoryDisplay)}</button><div className="memory-actions"><button className="use-button" onClick={recallMemory}>Recall into expression</button><button className="quiet" onClick={() => { setMemory(null); setMemoryOpen(false); }}>Clear memory</button></div></div></div>}
  </main>;
}
