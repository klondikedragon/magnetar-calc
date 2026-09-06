import { exactParts, isExactValue } from "./exactValues.js";

const safeLinearLimit = 1_000_000_000_000;
const leadingDigits = 15;

function log10Integer(integer) {
  const absolute = integer < 0n ? -integer : integer;
  if (absolute === 0n) return null;
  const text = absolute.toString();
  const head = text.slice(0, leadingDigits);
  return (text.length - head.length) + Math.log10(Number(head));
}

function exactCoordinates(value) {
  const { numerator, denominator } = exactParts(value);
  if (numerator === 0n) return { sign: 0, linear: 0, log10: null };
  const sign = numerator < 0n ? -1 : 1;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const numeratorText = absoluteNumerator.toString();
  const denominatorText = denominator.toString();
  const linear = numeratorText.length <= 12 && denominatorText.length <= 12
    ? Number(absoluteNumerator) / Number(denominator) * sign
    : null;
  return { sign, linear, log10: log10Integer(absoluteNumerator) - log10Integer(denominator) };
}

function decimalCoordinates(decimal) {
  if (!decimal?.isFinite?.()) return null;
  if (decimal.isZero?.()) return { sign: 0, linear: 0, log10: null };
  const sign = decimal.isNegative?.() ? -1 : 1;
  const absolute = decimal.abs();
  const asNumber = absolute.toNumber();
  const linear = Number.isFinite(asNumber) && asNumber <= safeLinearLimit ? sign * asNumber : null;
  const logarithm = absolute.log?.(10);
  const log10 = logarithm?.toNumber?.();
  return { sign, linear, log10: Number.isFinite(log10) ? log10 : null };
}

function extendedScaleCoordinates(value) {
  if (value.sign === 0) return { sign: 0, linear: 0, log10: null };
  // Canvas coordinates are IEEE doubles. Refuse to present a position whose
  // scale cannot be represented meaningfully by that coordinate system.
  const scale = Number(value.scale);
  if (!Number.isSafeInteger(scale) || Math.abs(scale) > safeLinearLimit) return null;
  const coefficient = value.significand?.abs?.().toNumber?.();
  if (!Number.isFinite(coefficient) || coefficient <= 0) return null;
  return { sign: value.sign < 0 ? -1 : 1, linear: null, log10: scale + Math.log10(coefficient) };
}

function breakEternityCoordinates(value) {
  const decimal = value.decimal;
  if (!decimal || decimal.layer > 1) return null;
  if (decimal.sign === 0) return { sign: 0, linear: 0, log10: null };
  if (decimal.layer === 1) {
    const scale = Number(decimal.mag);
    return Number.isFinite(scale) ? { sign: decimal.sign < 0 ? -1 : 1, linear: null, log10: scale } : null;
  }
  const asNumber = decimal.toNumber?.();
  const absolute = decimal.abs?.();
  const log10 = absolute?.log10?.();
  return {
    sign: decimal.sign < 0 ? -1 : 1,
    linear: Number.isFinite(asNumber) && Math.abs(asNumber) <= safeLinearLimit ? asNumber : null,
    log10: Number.isFinite(Number(log10)) ? Number(log10) : null,
  };
}

function coordinatesFor(value) {
  if (isExactValue(value)) return exactCoordinates(value);
  if (value?.kind === "decimal.js") return decimalCoordinates(value.decimal);
  if (value?.kind === "extended-scale") return extendedScaleCoordinates(value);
  if (value?.kind === "break-eternity") return breakEternityCoordinates(value);
  if (value?.kind === "number" && Number.isFinite(value.number)) {
    const absolute = Math.abs(value.number);
    return { sign: Math.sign(value.number), linear: absolute <= safeLinearLimit ? value.number : null, log10: absolute > 0 ? Math.log10(absolute) : null };
  }
  return null;
}

function unavailableReason(value, coordinates) {
  if (["structural-power", "steinhaus-moser", "hierarchy"].includes(value?.kind)) return "structural value — not placed as a numeric point";
  if (value?.kind === "break-eternity" && value.decimal?.layer > 1) return "layered magnitude — not placed as a numeric point";
  if (value?.kind === "extended-scale") return "scale exceeds Canvas coordinate precision";
  if (coordinates?.sign < 0) return "negative value — unavailable on a logarithmic scale";
  if (coordinates?.sign === 0) return "zero — unavailable on a logarithmic scale";
  return "value has no safe numeric chart coordinate";
}

export function chartHistoryValues(history) {
  return [...history].reverse().map((item, index) => {
    const coordinates = coordinatesFor(item.value);
    return {
      item,
      position: index + 1,
      coordinates,
      reason: unavailableReason(item.value, coordinates),
    };
  });
}

export function automaticChartScale(points) {
  const numeric = points.filter((point) => point.coordinates);
  const allLinear = numeric.length > 0 && numeric.every((point) => point.coordinates.linear !== null);
  const allPositiveLog = numeric.length > 0 && numeric.every((point) => point.coordinates.sign > 0 && point.coordinates.log10 !== null);
  if (!allLinear && allPositiveLog) return "log";
  if (!allLinear) return "linear";
  if (!allPositiveLog) return "linear";
  const values = numeric.map((point) => Math.abs(point.coordinates.linear));
  const smallest = Math.min(...values);
  const largest = Math.max(...values);
  return smallest > 0 && largest / smallest >= 10_000 ? "log" : "linear";
}

export function prepareHistoryChart(history, scale = "auto") {
  const points = chartHistoryValues(history);
  const automaticScale = automaticChartScale(points);
  const selectedScale = scale === "auto" ? automaticScale : scale;
  const plotted = points.map((point) => {
    const y = selectedScale === "log" ? point.coordinates?.sign > 0 ? point.coordinates.log10 : null : point.coordinates?.linear ?? null;
    return { ...point, y };
  });
  const markers = plotted.filter((point) => point.y === null);
  return {
    points: plotted,
    markers,
    selectedScale,
    automaticScale,
    supportsLinear: points.some((point) => point.coordinates?.linear !== null),
    supportsLog: points.some((point) => point.coordinates?.sign > 0 && point.coordinates?.log10 !== null),
  };
}
