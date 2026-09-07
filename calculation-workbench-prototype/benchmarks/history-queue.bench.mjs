import { performance } from "node:perf_hooks";
import { evaluateWithAnalysis } from "../src/engine.js";
import { appendHistoryEntry, nextHistoryWork, transitionHistoryEntry } from "../src/historyLedger.js";
import { yellowstoneTerm } from "../src/yellowstone.js";

const terms = Number(process.argv[2] ?? 1000);
if (!Number.isSafeInteger(terms) || terms < 1 || terms > 10_000) throw new Error("terms must be an integer from 1 through 10,000");

let history = [];
for (let id = 1; id <= terms; id += 1) history = appendHistoryEntry(history, { id, expression: "yellowstone(@n)" });

const started = performance.now();
let dispatched = 0;
while (true) {
  const work = nextHistoryWork(history);
  if (work.kind === "empty") break;
  if (work.kind !== "ready") throw new Error(`queue stalled in ${work.kind} state at @history(${work.entry.id})`);
  const references = new Map(work.references);
  const value = evaluateWithAnalysis(work.entry.expression, references, { precision: 48 });
  history = transitionHistoryEntry(history, work.entry.id, work.entry.revision, { state: "completed", value, error: null });
  dispatched += 1;
}
const elapsed = performance.now() - started;
const final = history[0]?.value?.exactInteger ?? history[0]?.value?.decimal?.toString?.();
const expected = String(yellowstoneTerm(terms));
if (dispatched !== terms || final !== expected) throw new Error(`queue correctness failure: dispatched ${dispatched}, final ${final}, expected ${expected}`);

console.log(JSON.stringify({ benchmark: "history-queue-non-ux", terms, dispatched, elapsedMs: Number(elapsed.toFixed(2)), perEntryMs: Number((elapsed / terms).toFixed(4)), final }, null, 2));
