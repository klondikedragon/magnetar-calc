import { tokenizeExpression } from "./expressionLanguage.js";

function ordered(history) { return [...history].reverse(); }

function referencesIn(expression) {
  return tokenizeExpression(expression)
    .filter((token) => token.type === "reference")
    .map((token) => token.value);
}

function sameReferences(left = [], right = []) {
  return left.length === right.length && left.every((item, index) => item.token === right[index].token && item.targetId === right[index].targetId);
}

function descriptionContext(history) {
  const chronological = ordered(history);
  return { chronological, byId: new Map(chronological.map((item) => [item.id, item])) };
}

function describeWithContext(context, entry) {
  const references = [];
  let blockedReason = null;
  for (const token of referencesIn(entry.expression)) {
    if (token === "@n") { references.push({ token, targetId: null }); continue; }
    const relative = token.match(/^@history\(-([1-9]\d*)\)$/);
    const stable = token.match(/^@history\(([1-9]\d*)\)$/);
    const target = relative
      ? context.chronological[context.chronological.length - Number(relative[1])]
      : stable ? context.byId.get(Number(stable[1])) : null;
    if (!target) blockedReason ??= `${token} is not available`;
    references.push({ token, targetId: target?.id ?? null });
  }
  return {
    ...entry,
    ordinal: context.chronological.length + 1,
    references,
    usesSequencePosition: references.some((reference) => reference.token === "@n"),
    blockedReason,
  };
}

export function describeHistoryEntry(history, entry) {
  return describeWithContext(descriptionContext(history), entry);
}

export function appendHistoryEntry(history, entry) {
  return appendHistoryEntries(history, [entry]);
}

export function appendHistoryEntries(history, entries) {
  if (!entries.length) return history;
  const context = descriptionContext(history);
  for (const entry of entries) {
    const described = describeWithContext(context, entry);
    const appended = { ...described, revision: 1, state: described.blockedReason ? "blocked" : "queued", value: null, error: described.blockedReason };
    context.chronological.push(appended);
    context.byId.set(appended.id, appended);
  }
  return context.chronological.reverse();
}

export function rebuildHistoryLedger(history) {
  const chronological = ordered(history);
  const rebuiltChronological = [];
  for (const entry of chronological) {
    const described = describeHistoryEntry(rebuiltChronological.slice().reverse(), entry);
    rebuiltChronological.push({ ...described, revision: entry.revision ?? 1, state: entry.state ?? "completed", error: entry.error ?? described.blockedReason ?? null });
  }
  return rebuiltChronological.reverse();
}

export function workerReferencesForEntry(history, entry) {
  return workerReferencesFromIndex(new Map(history.map((item) => [item.id, item])), entry);
}

function workerReferencesFromIndex(byId, entry) {
  const missing = entry.references.find((reference) => reference.targetId !== null && byId.get(reference.targetId)?.state !== "completed");
  if (missing) {
    const dependency = byId.get(missing.targetId);
    return dependency?.state === "queued" || dependency?.state === "computing" || dependency?.state === "dirty"
      ? { waiting: true, references: [] }
      : { blocked: `@history(${missing.targetId}) did not complete`, references: [] };
  }
  return {
    blocked: entry.blockedReason,
    references: entry.references.map((reference) => reference.token === "@n"
      ? [reference.token, String(entry.ordinal)]
      : [reference.token, byId.get(reference.targetId).value]),
  };
}

// The scheduler is deliberately pure: it makes no worker or UI decisions.
// It establishes the single legal next transition for the serial queue.
export function nextHistoryWork(history) {
  // A serial queue cannot pass a computing entry. If its worker disappears, the
  // app reconciles that entry back to queued before asking again; allowing a
  // later entry through would silently turn one queue into concurrent work.
  const entry = ordered(history).find((item) => item.state === "queued" || item.state === "dirty" || item.state === "computing");
  if (!entry) return { kind: "empty" };
  if (entry.state === "computing") return { kind: "computing", entry };
  const payload = workerReferencesForEntry(history, entry);
  if (payload.waiting) return { kind: "waiting", entry };
  if (payload.blocked) return { kind: "blocked", entry, error: payload.blocked };
  return { kind: "ready", entry, references: payload.references };
}

// Collect a contiguous ready prefix for one worker message. Entries which
// refer to an earlier pending History result deliberately stop the batch: they
// must observe that result after it has completed. Ordinary expressions and
// @n-only sequence entries, on the other hand, already have every input they
// need and can share a worker/cache without changing their semantics.
export function nextHistoryBatch(history, maximumSize = 64) {
  const chronology = ordered(history);
  const byId = new Map(history.map((item) => [item.id, item]));
  const firstEntry = chronology.find((item) => item.state === "queued" || item.state === "dirty" || item.state === "computing");
  if (!firstEntry) return { kind: "empty" };
  if (firstEntry.state === "computing") return { kind: "computing", entry: firstEntry };
  const firstIndex = chronology.findIndex((entry) => entry.id === firstEntry.id);
  const jobs = [];
  const scheduled = new Set();
  const externalValues = new Map();
  for (const entry of chronology.slice(firstIndex)) {
    if (jobs.length >= maximumSize) break;
    if (entry.state !== "queued" && entry.state !== "dirty") break;
    if (entry.blockedReason) {
      if (!jobs.length) return { kind: "blocked", entry, error: entry.blockedReason };
      break;
    }
    let unavailable = null;
    for (const reference of entry.references) {
      if (reference.targetId === null || scheduled.has(reference.targetId)) continue;
      const target = byId.get(reference.targetId);
      if (target?.state === "completed") externalValues.set(target.id, target.value);
      else unavailable = target?.state === "queued" || target?.state === "dirty" || target?.state === "computing"
        ? { kind: "waiting", entry }
        : { kind: "blocked", entry, error: `@history(${reference.targetId}) did not complete` };
      if (unavailable) break;
    }
    if (unavailable) {
      if (!jobs.length) return unavailable;
      break;
    }
    jobs.push({ entry, references: entry.references });
    scheduled.add(entry.id);
  }
  return { kind: "ready", entry: jobs[0].entry, jobs, externalValues: [...externalValues] };
}

export function transitionHistoryEntry(history, id, revision, update) {
  return history.map((entry) => entry.id === id && entry.revision === revision ? { ...entry, ...update } : entry);
}

// A worker may be stopped by navigation or development refresh without sending
// an error event. A computing entry is never terminal in that case: place it
// back in the serial queue so it can receive a fresh worker job.
export function recoverOrphanedHistoryWork(history) {
  return history.map((entry) => entry.state === "computing" ? { ...entry, state: "queued", error: null } : entry);
}

export function invalidateAfterHistoryDeletion(history, deletedId) {
  const prior = new Map(history.map((entry) => [entry.id, entry]));
  const remaining = history.filter((entry) => entry.id !== deletedId);
  const chronological = ordered(remaining);
  const rebuiltChronological = [];
  const dirty = new Set();
  for (const entry of chronological) {
    const rebuilt = describeHistoryEntry(rebuiltChronological.slice().reverse(), entry);
    const previous = prior.get(entry.id);
    const dependencyChanged = !sameReferences(previous?.references, rebuilt.references)
      || (previous?.usesSequencePosition && previous.ordinal !== rebuilt.ordinal);
    const dependsOnDirty = rebuilt.references.some((reference) => reference.targetId !== null && dirty.has(reference.targetId));
    const state = rebuilt.blockedReason ? "blocked" : (dependencyChanged || dependsOnDirty ? "dirty" : entry.state);
    const changed = state === "dirty" || state === "blocked";
    const next = { ...rebuilt, revision: changed ? (entry.revision ?? 1) + 1 : (entry.revision ?? 1), state, value: changed ? null : entry.value, error: rebuilt.blockedReason ?? (state === "dirty" ? null : entry.error) };
    if (state === "dirty" || state === "blocked") dirty.add(next.id);
    rebuiltChronological.push(next);
  }
  return rebuiltChronological.reverse();
}
