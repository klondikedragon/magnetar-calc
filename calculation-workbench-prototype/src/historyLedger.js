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

export function describeHistoryEntry(history, entry) {
  const before = ordered(history);
  const byId = new Map(before.map((item) => [item.id, item]));
  const references = [];
  let blockedReason = null;
  for (const token of referencesIn(entry.expression)) {
    if (token === "@n") { references.push({ token, targetId: null }); continue; }
    const relative = token.match(/^@history\(-([1-9]\d*)\)$/);
    const stable = token.match(/^@history\(([1-9]\d*)\)$/);
    const target = relative ? before[before.length - Number(relative[1])] : stable ? byId.get(Number(stable[1])) : null;
    if (!target) blockedReason ??= `${token} is not available`;
    references.push({ token, targetId: target?.id ?? null });
  }
  return {
    ...entry,
    ordinal: before.length + 1,
    references,
    usesSequencePosition: references.some((reference) => reference.token === "@n"),
    blockedReason,
  };
}

export function appendHistoryEntry(history, entry) {
  const described = describeHistoryEntry(history, entry);
  return [
    { ...described, revision: 1, state: described.blockedReason ? "blocked" : "queued", value: null, error: described.blockedReason },
    ...history,
  ];
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
  const byId = new Map(history.map((item) => [item.id, item]));
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
  const entry = ordered(history).find((item) => item.state === "queued" || item.state === "dirty");
  if (!entry) return { kind: "empty" };
  const payload = workerReferencesForEntry(history, entry);
  if (payload.waiting) return { kind: "waiting", entry };
  if (payload.blocked) return { kind: "blocked", entry, error: payload.blocked };
  return { kind: "ready", entry, references: payload.references };
}

export function transitionHistoryEntry(history, id, revision, update) {
  return history.map((entry) => entry.id === id && entry.revision === revision ? { ...entry, ...update } : entry);
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
