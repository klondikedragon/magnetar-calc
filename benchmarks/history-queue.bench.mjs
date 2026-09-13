import { performance } from "node:perf_hooks";
import { appendHistoryEntries, nextHistoryBatch } from "../src/historyLedger.js";
import { evaluateHistoryJobs } from "../src/historyExecution.js";
import { yellowstoneTerm } from "../src/yellowstone.js";

const terms = Number(process.argv[2] ?? 1000);
if (!Number.isSafeInteger(terms) || terms < 1 || terms > 10_000) throw new Error("terms must be an integer from 1 through 10,000");

let history = [];
const enqueueStarted = performance.now();
history = appendHistoryEntries([], Array.from({ length: terms }, (_, index) => ({ id: index + 1, expression: "yellowstone(@n)" })));
const enqueueElapsed = performance.now() - enqueueStarted;

const started = performance.now();
let dispatched = 0;
let batches = 0;
while (true) {
  const work = nextHistoryBatch(history, 512);
  if (work.kind === "empty") break;
  if (work.kind !== "ready") throw new Error(`queue stalled in ${work.kind} state at @history(${work.entry.id})`);
  const jobs = work.jobs.map(({ entry, references }) => ({ id: entry.id, revision: entry.revision, expression: entry.expression, ordinal: entry.ordinal, references, options: { precision: 48 } }));
  const results = evaluateHistoryJobs(jobs, new Map(work.externalValues));
  const completed = new Map(results.filter((result) => result.type === "result").map((result) => [result.id, result.value]));
  if (completed.size !== results.length) throw new Error("queue calculation failed");
  history = history.map((entry) => completed.has(entry.id) ? { ...entry, state: "completed", value: completed.get(entry.id), error: null } : entry);
  dispatched += results.length;
  batches += 1;
}
const elapsed = performance.now() - started;
const final = history[0]?.value?.exactInteger ?? history[0]?.value?.decimal?.toString?.();
const expected = String(yellowstoneTerm(terms));
if (dispatched !== terms || final !== expected) throw new Error(`queue correctness failure: dispatched ${dispatched}, final ${final}, expected ${expected}`);

console.log(JSON.stringify({ benchmark: "history-queue-non-ux", terms, dispatched, batches, enqueueMs: Number(enqueueElapsed.toFixed(2)), elapsedMs: Number(elapsed.toFixed(2)), perEntryMs: Number((elapsed / terms).toFixed(4)), final }, null, 2));
